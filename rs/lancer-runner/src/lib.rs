#![allow(non_local_definitions)]

use std::{
    collections::{HashMap, HashSet},
    f32::consts::E,
    fmt,
    mem::{self, MaybeUninit},
    sync::Arc,
};

use anyhow::bail;
use compiler::install_compiler;
use fastcrypto::hash::Hash;
use gluon::{
    Thread,
    import::{add_extern_module, add_extern_module_with_deps},
    primitive, record,
    vm::{
        self, ExternModule,
        api::{Getable, IO, Opaque, OpaqueRef, OpaqueValue},
    },
};
use gluon_codegen::{Trace, Userdata, VmType};
use move_core_types::parsing::address;
use rpc::{WTransactionBlockResponse, coin::WCoin, install_rpc};
use serde::{Deserialize, Serialize};
use std::fmt::Debug;
use sui::{WSuiAddress, install_sui, types::WStructTag};
use sui_json_rpc_types::SuiTransactionBlockResponse;
use sui_types::{
    base_types::{ObjectID, SuiAddress},
    crypto::{SuiKeyPair, get_key_pair_from_rng},
    execution::ExecutionResult,
    object::Object,
    transaction::{Transaction, TransactionData},
};
use take_mut::take;
use test_cluster::{TestCluster, TestClusterBuilder};
use tokio::process::Command;
use tokio::sync::{Mutex, RwLock, mpsc};
use transaction::{install_transaction, transaction::WTransaction};

pub mod compiler;
pub mod rpc;
pub mod sui;
pub mod transaction;

type ExecResult<T> = std::result::Result<T, String>;

pub enum TestClusterStage {
    Builder(TestClusterBuilder),
    Pending,
    Running(TestCluster),
}

impl TestClusterStage {
    async fn start(&mut self) -> ExecResult<()> {
        if matches!(self, TestClusterStage::Builder(_)) {
            let builder = match mem::replace(self, TestClusterStage::Pending) {
                TestClusterStage::Builder(builder) => builder,
                _ => unreachable!(),
            };
            let cluster = builder.build().await;
            cluster.start_all_validators().await;
            *self = TestClusterStage::Running(cluster);
            Ok(())
        } else {
            Err("Test cluster is already running".to_string())
        }
    }

    async fn start_if_needed(&mut self) -> ExecResult<&mut TestCluster> {
        if matches!(self, TestClusterStage::Builder(_)) {
            self.start().await?;
        }
        Ok(self.cluster().unwrap())
    }

    fn cluster(&mut self) -> ExecResult<&mut TestCluster> {
        if let TestClusterStage::Running(cluster) = self {
            Ok(cluster)
        } else {
            Err("Test cluster is not running".to_string())
        }
    }

    fn into_inner(self) -> ExecResult<TestCluster> {
        if let TestClusterStage::Running(cluster) = self {
            Ok(cluster)
        } else {
            Err("Test cluster is not running".to_string())
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Reporting {
    Public,
    Partial {
        owned_by: HashSet<SuiAddress>,
        objects: HashSet<ObjectID>,
    },
    HidingObjects(HashSet<ObjectID>),
}

pub struct PreparationDump {
    pub sql: String,
    pub sender: SuiAddress,
    pub available_private_keys: HashSet<SuiAddress>,
}

pub enum Lancer {
    Unintialized,
    Prepare {
        test_cluster: TestClusterStage,
        keys: HashMap<SuiAddress, SuiKeyPair>,
        dump_sender: mpsc::Sender<PreparationDump>,
    },
    Run {
        test_cluster: TestCluster,
        reporting: Reporting,
        keys: HashMap<SuiAddress, SuiKeyPair>,
    },
    Dropped,
}

impl Default for Lancer {
    fn default() -> Self {
        Self::Unintialized
    }
}

impl Debug for Lancer {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Lancer::Unintialized => write!(f, "Lancer::Unintialized"),
            Lancer::Prepare { .. } => write!(f, "Lancer::Prepare"),
            Lancer::Run { .. } => write!(f, "Lancer::Run"),
            Lancer::Dropped => write!(f, "Lancer::Dropped"),
        }
    }
}

async fn dump_db(test_cluster: &TestCluster) -> ExecResult<String> {
    let url = test_cluster
        .indexer_handle
        .as_ref()
        .unwrap()
        .database
        .database()
        .url();
    let output = Command::new("pg_dump")
        .arg(&url.to_string())
        .arg("-a")
        .output()
        .await
        .map_err(|e| e.to_string())?;
    if !output.status.success() {
        return Err(format!(
            "pg_dump failed: {}",
            std::str::from_utf8(&output.stderr).unwrap_or("unknown error")
        ));
    }
    let output = String::from_utf8(output.stdout).map_err(|e| e.to_string())?;
    Ok(output)
}

impl Lancer {
    fn initialize(&mut self, dump_sender: mpsc::Sender<PreparationDump>) -> ExecResult<()> {
        if !matches!(self, Lancer::Unintialized) {
            return Err("Lancer is already initialized".to_string());
        }
        *self = Self::Prepare {
            test_cluster: TestClusterStage::Builder(
                TestClusterBuilder::new().with_indexer_backed_rpc(),
            ),
            keys: HashMap::new(),
            dump_sender,
        };
        Ok(())
    }

    fn wallet_index(&self) -> usize {
        match self {
            Lancer::Unintialized => unreachable!(),
            Lancer::Prepare { .. } => 1,
            Lancer::Run { .. } => 2,
            Lancer::Dropped => unreachable!(),
        }
    }

    async fn test_cluster(&mut self) -> ExecResult<&mut TestCluster> {
        match self {
            Lancer::Unintialized => Err("Lancer is not initialized".to_string()),
            Lancer::Prepare { test_cluster, .. } => test_cluster.start_if_needed().await,
            Lancer::Run { test_cluster, .. } => Ok(test_cluster),
            Lancer::Dropped => Err("Lancer is dropped".to_string()),
        }
    }

    fn keypair(&self, address: SuiAddress) -> ExecResult<&SuiKeyPair> {
        match self {
            Lancer::Unintialized => Err("Lancer is not initialized".to_string()),
            Lancer::Prepare { keys, .. } => keys
                .get(&address)
                .ok_or_else(|| format!("Keypair not found for address: {}", address)),
            Lancer::Run { keys, .. } => keys
                .get(&address)
                .ok_or_else(|| format!("Keypair not found for address: {}", address)),
            Lancer::Dropped => Err("Lancer is dropped".to_string()),
        }
    }

    fn current_wallet(&self) -> Option<WSuiAddress> {
        match self {
            Lancer::Unintialized => None,
            Lancer::Prepare { test_cluster, .. } => match test_cluster {
                TestClusterStage::Builder(_) => None,
                TestClusterStage::Pending => None,
                TestClusterStage::Running(test_cluster) => Some(WSuiAddress(
                    test_cluster.get_addresses()[self.wallet_index()],
                )),
            },
            Lancer::Run { test_cluster, .. } => Some(WSuiAddress(
                test_cluster.get_addresses()[self.wallet_index()],
            )),
            Lancer::Dropped => None,
        }
    }

    async fn start(&mut self) -> ExecResult<()> {
        if let Lancer::Prepare { test_cluster, .. } = self {
            test_cluster.start().await
        } else {
            Err("Test cluster is already running".to_string())
        }
    }

    async fn execute(
        &mut self,
        pt: &WTransaction,
        sender: Option<WSuiAddress>,
    ) -> ExecResult<WTransactionBlockResponse> {
        let wallet_index = self.wallet_index();
        // let is_preparing = matches!(self, Lancer::Prepare { .. });
        let test_cluster = self.test_cluster().await?;
        let gas_budget = 500_000_000;
        let gas_price = test_cluster.get_reference_gas_price().await;
        let sender_provided = sender.is_some();
        let (sender, gas) = if let Some(sender) = sender {
            let gas = test_cluster
                .wallet()
                .get_one_gas_object_owned_by_address(sender.0)
                .await
                .map_err(|e| e.to_string())?;
            let gas = if let Some(gas) = gas {
                gas
            } else {
                test_cluster
                    .fund_address_and_return_gas(gas_price, Some(gas_budget), sender.0)
                    .await
            };
            (sender.0, gas)
        } else {
            let sender = test_cluster.get_addresses()[wallet_index];
            (
                sender,
                test_cluster
                    .wallet()
                    .get_one_gas_object_owned_by_address(sender)
                    .await
                    .map_err(|e| e.to_string())?
                    .ok_or("No gas object".to_string())?,
            )
        };
        // create the transaction data that will be sent to the network
        let tx_data = TransactionData::new_programmable(
            sender,
            vec![gas],
            pt.0.clone(),
            gas_budget,
            gas_price,
        );
        let tx = if sender_provided {
            let keypair = self.keypair(sender)?;
            Transaction::from_data_and_signer(tx_data, vec![keypair])
        } else {
            self.test_cluster()
                .await?
                .wallet()
                .sign_transaction(&tx_data)
        };
        let r = self.test_cluster().await?.execute_transaction(tx).await;
        if r.status_ok().unwrap() {
            Ok(WTransactionBlockResponse(r))
        } else {
            Err(r.errors.join(", "))
        }
    }

    async fn commit(&mut self) -> ExecResult<()> {
        let current_wallet = self.current_wallet();
        match self {
            Lancer::Prepare {
                test_cluster,
                dump_sender,
                keys,
                ..
            } => {
                let test_cluster = test_cluster.start_if_needed().await?;
                let sql = dump_db(test_cluster).await?;
                dump_sender
                    .send(PreparationDump {
                        sql,
                        sender: current_wallet.unwrap().0,
                        available_private_keys: HashSet::from_iter(keys.keys().cloned()),
                    })
                    .await
                    .map_err(|e| e.to_string())?;
            }
            _ => {
                return Err("Test cluster is not in preparation state".to_string());
            }
        }
        take(self, |lancer| {
            if let Lancer::Prepare { test_cluster, .. } = lancer {
                let test_cluster = test_cluster.into_inner().unwrap();
                Lancer::Run {
                    test_cluster,
                    reporting: Reporting::Public,
                    keys: HashMap::new(),
                }
            } else {
                unreachable!()
            }
        });
        Ok(())
    }

    async fn generate_keypair(&mut self) -> ExecResult<WSuiAddress> {
        let (address, keypair) = get_key_pair_from_rng(&mut rand::rngs::OsRng);
        let keypair = SuiKeyPair::Ed25519(keypair);
        match self {
            Lancer::Unintialized => {
                return Err("Lancer is not initialized".to_string());
            }
            Lancer::Prepare { keys, .. } => {
                keys.insert(address, keypair);
            }
            Lancer::Run { keys, .. } => {
                keys.insert(address, keypair);
            }
            Lancer::Dropped => {
                return Err("Lancer is dropped".to_string());
            }
        }
        Ok(WSuiAddress(address))
    }

    async fn get_coins(
        &mut self,
        coin_type: WStructTag,
        owner: WSuiAddress,
    ) -> ExecResult<Vec<WCoin>> {
        let coin_type = coin_type.0.to_canonical_string(true);
        let test_cluster = self.test_cluster().await.unwrap();
        let mut coins = vec![];
        let mut cursor = None;
        loop {
            let page = test_cluster
                .sui_client()
                .coin_read_api()
                .get_coins(owner.0, Some(coin_type.clone()), cursor, None)
                .await
                .map_err(|e| e.to_string())?;
            coins.extend(page.data);
            if !page.has_next_page {
                break;
            }
            cursor = page.next_cursor;
        }
        Ok(coins.into_iter().map(|x| WCoin(x)).collect())
    }

    async fn get_balance(&mut self, coin_type: WStructTag, owner: WSuiAddress) -> ExecResult<u64> {
        let coin_type = coin_type.0.to_canonical_string(true);
        let test_cluster = self.test_cluster().await.unwrap();
        let balance = test_cluster
            .fullnode_handle
            .sui_client
            .coin_read_api()
            .get_balance(owner.0, Some(coin_type))
            .await
            .map_err(|e| e.to_string())?;
        Ok(balance.total_balance as u64)
    }

    fn set_reporting(&mut self, reporting: Reporting) -> ExecResult<()> {
        match self {
            Lancer::Unintialized => {
                return Err("Lancer is not initialized".to_string());
            }
            Lancer::Prepare { .. } => {
                return Err("Test cluster is not running".to_string());
            }
            Lancer::Run { reporting: r, .. } => {
                *r = reporting;
            }
            Lancer::Dropped => {
                return Err("Lancer is dropped".to_string());
            }
        }
        Ok(())
    }

    fn borrow_reporting(&self) -> ExecResult<&Reporting> {
        match self {
            Lancer::Unintialized => {
                return Err("Lancer is not initialized".to_string());
            }
            Lancer::Prepare { .. } => {
                return Err("Test cluster is not running".to_string());
            }
            Lancer::Run { reporting, .. } => Ok(&reporting),
            Lancer::Dropped => {
                return Err("Lancer is dropped".to_string());
            }
        }
    }

    fn borrow_reporting_mut(&mut self) -> ExecResult<&mut Reporting> {
        match self {
            Lancer::Unintialized => {
                return Err("Lancer is not initialized".to_string());
            }
            Lancer::Prepare { .. } => {
                return Err("Test cluster is not running".to_string());
            }
            Lancer::Run { reporting, .. } => Ok(reporting),
            Lancer::Dropped => {
                return Err("Lancer is dropped".to_string());
            }
        }
    }

    async fn stop(&mut self) -> ExecResult<FinalReport> {
        let current_wallet = self.current_wallet();
        let report = match self {
            Lancer::Unintialized => {
                return Err("Lancer is not initialized".to_string());
            }
            Lancer::Prepare { .. } => {
                return Err("Test cluster is not running".to_string());
            }
            Lancer::Run {
                test_cluster,
                reporting,
                keys,
                ..
            } => {
                let private_sql = dump_db(test_cluster).await?;
                let public_report: Vec<Object> = match reporting {
                    Reporting::Public => {
                        vec![]
                    }
                    Reporting::Partial { owned_by, objects } => {
                        let mut public_report: Vec<Object> = vec![];
                        for address in owned_by.iter() {
                            let mut cursor = None;
                            loop {
                                let page = test_cluster
                                    .fullnode_handle
                                    .sui_client
                                    .read_api()
                                    .get_owned_objects(address.clone(), None, cursor, None)
                                    .await
                                    .map_err(|e| e.to_string())?;
                                for r in page.data {
                                    public_report.push(
                                        test_cluster
                                            .get_object_from_fullnode_store(&r.object_id().unwrap())
                                            .await
                                            .ok_or("Failed to get object")?,
                                    );
                                }
                                if !page.has_next_page {
                                    break;
                                }
                                cursor = page.next_cursor;
                            }
                        }
                        for id in objects.iter() {
                            public_report.push(
                                test_cluster
                                    .get_object_from_fullnode_store(id)
                                    .await
                                    .ok_or("Failed to get object")?,
                            );
                        }
                        public_report
                    }
                    Reporting::HidingObjects(object_ids) => todo!("Implement hiding objects"),
                };
                test_cluster.stop_all_validators().await;
                FinalReport {
                    reporting: Reporting::Public,
                    public_report,
                    sql: private_sql,
                    sender: current_wallet.unwrap().0,
                    available_private_keys: HashSet::from_iter(keys.keys().cloned()),
                }
            }
            Lancer::Dropped => {
                return Err("Lancer is dropped".to_string());
            }
        };
        *self = Lancer::Dropped;
        Ok(report)
    }
}

pub struct FinalReport {
    pub reporting: Reporting,
    pub public_report: Vec<Object>,
    pub sql: String,
    pub sender: SuiAddress,
    pub available_private_keys: HashSet<SuiAddress>,
}

#[derive(Clone, Debug, Trace, VmType, Userdata)]
#[gluon(vm_type = "lancer.prim.LancerInitializeArgs")]
#[gluon_trace(skip)]
#[gluon_userdata(clone)]
pub struct LancerInitializeArgs {
    pub dump_sender: mpsc::Sender<PreparationDump>,
}

#[derive(Clone, Debug, Trace, VmType, Userdata, Default)]
#[gluon(vm_type = "lancer.prim.Lancer")]
#[gluon_trace(skip)]
#[gluon_userdata(clone)]
pub struct LancerRef(Arc<RwLock<Lancer>>);

impl LancerRef {
    pub async fn initialize(&self, args: &LancerInitializeArgs) -> IO<()> {
        self.0
            .write()
            .await
            .initialize(args.dump_sender.clone())
            .into()
    }

    async fn start(&self) -> IO<()> {
        self.0.write().await.start().await.into()
    }

    async fn current_wallet(&self) -> Option<WSuiAddress> {
        self.0.read().await.current_wallet()
    }

    async fn commit(&self) -> IO<()> {
        self.0.write().await.commit().await.into()
    }

    async fn execute(
        &self,
        pt: &WTransaction,
        sender: Option<WSuiAddress>,
    ) -> IO<WTransactionBlockResponse> {
        self.0.write().await.execute(pt, sender).await.into()
    }

    async fn generate_keypair(&self) -> IO<WSuiAddress> {
        self.0.write().await.generate_keypair().await.into()
    }

    async fn get_coins(&self, coin_type: WStructTag, owner: WSuiAddress) -> IO<Vec<WCoin>> {
        self.0
            .write()
            .await
            .get_coins(coin_type, owner)
            .await
            .into()
    }

    async fn get_balance(&self, coin_type: WStructTag, owner: WSuiAddress) -> IO<u64> {
        self.0
            .write()
            .await
            .get_balance(coin_type, owner)
            .await
            .into()
    }

    pub async fn report_public(&self) -> IO<()> {
        self.0.write().await.set_reporting(Reporting::Public).into()
    }

    pub async fn report_owner_by(&self, owner: Option<WSuiAddress>) -> IO<()> {
        let owner = owner.unwrap_or(self.current_wallet().await.unwrap()).0;
        let mut inner = self.0.write().await;
        if matches!(inner.borrow_reporting(), Ok(Reporting::Partial { .. })) {
            if let Ok(Reporting::Partial { owned_by, .. }) = inner.borrow_reporting_mut() {
                owned_by.insert(owner);
                IO::Value(())
            } else {
                unreachable!()
            }
        } else {
            inner
                .set_reporting(Reporting::Partial {
                    owned_by: HashSet::from([owner]),
                    objects: HashSet::new(),
                })
                .into()
        }
    }

    pub async fn report_objects(&self, new_objects: Vec<WSuiAddress>) -> IO<()> {
        let new_objects = new_objects.into_iter().map(|x| x.0.into());
        let mut inner = self.0.write().await;
        if matches!(inner.borrow_reporting(), Ok(Reporting::Partial { .. })) {
            if let Ok(Reporting::Partial { objects, .. }) = inner.borrow_reporting_mut() {
                objects.extend(new_objects);
                IO::Value(())
            } else {
                unreachable!()
            }
        } else {
            inner
                .set_reporting(Reporting::Partial {
                    owned_by: HashSet::new(),
                    objects: HashSet::from_iter(new_objects),
                })
                .into()
        }
    }

    pub async fn hiding_objects(&self, objects: Vec<WSuiAddress>) -> IO<()> {
        let objects = objects.into_iter().map(|x| x.0.into());
        let mut inner = self.0.write().await;
        if matches!(inner.borrow_reporting(), Ok(Reporting::HidingObjects(_))) {
            if let Ok(Reporting::HidingObjects(target)) = inner.borrow_reporting_mut() {
                target.extend(objects);
                IO::Value(())
            } else {
                unreachable!()
            }
        } else {
            inner
                .set_reporting(Reporting::HidingObjects(HashSet::from_iter(objects)))
                .into()
        }
    }

    pub async fn stop(&self) -> IO<FinalReport> {
        self.0.write().await.stop().await.into()
    }
}

fn load_lancer(vm: &Thread) -> vm::Result<vm::ExternModule> {
    ExternModule::new(
        vm,
        record!(
            lancer => LancerRef::default(),
            type Lancer => LancerRef,
            initialize => primitive!(
                2,
                "lancer.prim.initialize",
                async fn LancerRef::initialize),
            current_wallet => primitive!(
                1,
                "lancer.prim.current_wallet",
                async fn LancerRef::current_wallet),
            start => primitive!(1, "lancer.prim.start", async fn LancerRef::start),
            commit => primitive!(1, "lancer.prim.commit", async fn LancerRef::commit),
            execute => primitive!(
                3,
                "lancer.prim.execute",
                async fn LancerRef::execute),
            generate_keypair => primitive!(
                1,
                "lancer.prim.generate_keypair",
                async fn LancerRef::generate_keypair),
            get_coins => primitive!(
                3,
                "lancer.prim.get_coins",
                async fn LancerRef::get_coins),
            get_balance => primitive!(
                3,
                "lancer.prim.get_balance",
                async fn LancerRef::get_balance),
            report_public => primitive!(
                1,
                "lancer.prim.report_public",
                async fn LancerRef::report_public),
            report_owner_by => primitive!(
                2,
                "lancer.prim.report_owner_by",
                async fn LancerRef::report_owner_by),
            report_objects => primitive!(
                2,
                "lancer.prim.report_objects",
                async fn LancerRef::report_objects),
            hiding_objects => primitive!(
                2,
                "lancer.prim.hiding_objects",
                async fn LancerRef::hiding_objects),
        ),
    )
}

pub fn install_lancer(vm: &Thread) -> vm::Result<()> {
    install_sui(vm)?;
    install_compiler(vm)?;
    install_transaction(vm)?;
    install_rpc(vm)?;

    vm.register_type::<LancerRef>("lancer.prim.Lancer", &[])?;
    vm.register_type::<LancerInitializeArgs>("lancer.prim.LancerInitializeArgs", &[])?;

    add_extern_module_with_deps(
        vm,
        "lancer.prim",
        load_lancer,
        vec!["lancer.rpc.types".to_string()],
    );
    Ok(())
}
