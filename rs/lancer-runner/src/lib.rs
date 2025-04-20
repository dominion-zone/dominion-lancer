use std::{
    collections::HashSet,
    f32::consts::E,
    fmt,
    mem::{self, MaybeUninit},
    sync::Arc,
};

use anyhow::bail;
use compiler::install_compiler;
use gluon::{
    import::{add_extern_module, add_extern_module_with_deps}, primitive, record, vm::{
        self, api::{Getable, Opaque, OpaqueRef, OpaqueValue, IO}, ExternModule
    }, Thread
};
use gluon_codegen::{Trace, Userdata, VmType};
use rpc::{WTransactionBlockResponse, install_rpc};
use std::fmt::Debug;
use sui::install_sui;
use sui_json_rpc_types::SuiTransactionBlockResponse;
use sui_types::{
    base_types::ObjectID,
    object::Object,
    transaction::{Transaction, TransactionData},
};
use take_mut::take;
use test_cluster::{TestCluster, TestClusterBuilder};
use tokio::sync::{Mutex, RwLock};
use transaction::{WTransaction, install_transaction};

pub mod compiler;
pub mod rpc;
pub mod sui;
pub mod transaction;

type ExecResult<T> = std::result::Result<T, String>;

enum TestClusterStage {
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

enum Lancer {
    Prepare {
        test_cluster: TestClusterStage,
        affected_objects: HashSet<ObjectID>,
    },
    Run {
        prepared_objects: Vec<Object>,
        test_cluster: TestCluster,
        reported_objects: HashSet<ObjectID>,
    },
}

impl Debug for Lancer {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Lancer::Prepare { .. } => write!(f, "Lancer::Prepare"),
            Lancer::Run { .. } => write!(f, "Lancer::Run"),
        }
    }
}

impl Default for Lancer {
    fn default() -> Self {
        Lancer::Prepare {
            test_cluster: TestClusterStage::Builder(TestClusterBuilder::new()),
            affected_objects: HashSet::new(),
        }
    }
}

impl Lancer {
    async fn test_cluster(&mut self) -> ExecResult<&mut TestCluster> {
        match self {
            Lancer::Prepare { test_cluster, .. } => test_cluster.start_if_needed().await,
            Lancer::Run { test_cluster, .. } => Ok(test_cluster),
        }
    }

    async fn start(&mut self) -> ExecResult<()> {
        if let Lancer::Prepare { test_cluster, .. } = self {
            test_cluster.start().await
        } else {
            Err("Test cluster is already running".to_string())
        }
    }

    async fn execute(&mut self, pt: &WTransaction) -> ExecResult<WTransactionBlockResponse> {
        let test_cluster = self.test_cluster().await?;
        let gas_budget = 500_000_000;
        let gas_price = test_cluster.get_reference_gas_price().await;
        let (sender, gas) = test_cluster
            .wallet()
            .get_one_gas_object()
            .await
            .map_err(|e| e.to_string())?
            .ok_or("No gas object".to_string())?;
        // create the transaction data that will be sent to the network
        let tx_data = TransactionData::new_programmable(
            sender,
            vec![gas],
            pt.0.clone(),
            gas_budget,
            gas_price,
        );
        let r = test_cluster.sign_and_execute_transaction(&tx_data).await;
        if r.status_ok().unwrap() {
            Ok(WTransactionBlockResponse(r))
        } else {
            Err(r.errors.join(", "))
        }
    }

    async fn commit(&mut self) -> ExecResult<()> {
        let prepared_objects = if let Lancer::Prepare {
            test_cluster,
            affected_objects,
        } = self
        {
            let test_cluster = test_cluster.start_if_needed().await?;
            let mut prepared_objects = Vec::with_capacity(affected_objects.len());
            for id in affected_objects.iter() {
                test_cluster
                    .get_object_from_fullnode_store(id)
                    .await
                    .map(|o| prepared_objects.push(o));
            }
            prepared_objects
        } else {
            return Err("Test cluster is not in preparation state".to_string());
        };
        take(self, |lancer| {
            if let Lancer::Prepare { test_cluster, .. } = lancer {
                Lancer::Run {
                    prepared_objects,
                    test_cluster: test_cluster.into_inner().unwrap(),
                    reported_objects: HashSet::new(),
                }
            } else {
                unreachable!()
            }
        });
        Ok(())
    }
}

#[derive(Clone, Debug, Trace, VmType, Userdata)]
#[gluon(vm_type = "lancer.prim.Lancer")]
#[gluon_trace(skip)]
#[gluon_userdata(clone)]
struct LancerRef(Arc<RwLock<Lancer>>);

impl LancerRef {
    async fn start(&self) -> IO<()> {
        self.0.write().await.start().await.into()
    }

    async fn commit(&self) -> IO<()> {
        self.0.write().await.commit().await.into()
    }

    async fn execute(&self, pt: &WTransaction) -> IO<WTransactionBlockResponse> {
        self.0.write().await.execute(pt).await.into()
    }
}

impl Default for LancerRef {
    fn default() -> Self {
        LancerRef(Arc::new(RwLock::new(Lancer::default())))
    }
}

fn load_lancer(vm: &Thread) -> vm::Result<vm::ExternModule> {
    ExternModule::new(
        vm,
        record!(
            type Lancer => LancerRef,
            lancer => LancerRef::default(),
            start => primitive!(1, "lancer.prim.start", async fn LancerRef::start),
            commit => primitive!(1, "lancer.prim.commit", async fn LancerRef::commit),
            execute => primitive!(
                2,
                "lancer.prim.execute",
                async fn LancerRef::execute),
        ),
    )
}

pub fn install_lancer(vm: &Thread) -> vm::Result<()> {
    install_sui(vm)?;
    install_compiler(vm)?;
    install_transaction(vm)?;
    install_rpc(vm)?;

    vm.register_type::<LancerRef>("lancer.prim.Lancer", &[])?;

    add_extern_module_with_deps(
        vm,
        "lancer.prim",
        load_lancer,
        vec!["lancer.rpc.types".to_string()],
    );
    Ok(())
}
