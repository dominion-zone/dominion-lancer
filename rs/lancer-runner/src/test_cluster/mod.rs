use gluon::{
    Thread,
    import::add_extern_module_with_deps,
    primitive, record,
    vm::{self, ExternModule, api::IO},
};
use gluon_codegen::{Trace, Userdata, VmType};
use std::fmt;
use std::fmt::Debug;
use sui_types::transaction::{Transaction, TransactionData};
use test_cluster::TestCluster;
use tokio::process::Command;
use tokio::sync::RwLock;

use crate::{
    rpc::{WTransactionBlockResponse, coin::WCoin},
    sui::{WSuiAddress, types::WStructTag},
    temp_wallet::TempWallet,
    transaction::WTransaction,
};

pub mod builder;

#[derive(Trace, VmType, Userdata)]
#[gluon(vm_type = "lancer.test_cluster.prim.TestCluster")]
#[gluon_trace(skip)]
pub struct WTestCluster(pub RwLock<TestCluster>);

impl Debug for WTestCluster {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("WTestCluster").finish()
    }
}

impl WTestCluster {
    pub(crate) fn new(cluster: TestCluster) -> Self {
        Self(RwLock::new(cluster))
    }

    async fn start(&self) -> IO<()> {
        async {
            let lock = self.0.read().await;
            if lock.swarm.validator_nodes().next().unwrap().is_running() {
                return Err("Cluster is already running".to_string());
            }
            lock.start_all_validators().await;
            Ok::<_, String>(())
        }
        .await
        .into()
    }

    pub async fn is_running(&self) -> bool {
        let lock = self.0.read().await;
        lock.swarm.validator_nodes().next().unwrap().is_running()
    }

    async fn execute_tx(
        &self,
        wallet_index: usize,
        temp_wallet: &TempWallet,
        pt: &WTransaction,
        sender: Option<WSuiAddress>,
    ) -> IO<WTransactionBlockResponse> {
        async {
            let mut lock = self.0.write().await;
            if !lock.swarm.validator_nodes().next().unwrap().is_running() {
                return Err("Cluster is not running".to_string());
            }
            let gas_budget = 500_000_000;
            let gas_price = lock.get_reference_gas_price().await;
            let sender_provided = sender.is_some();
            let (sender, gas) = if let Some(sender) = sender {
                let gas = lock
                    .wallet()
                    .get_one_gas_object_owned_by_address(sender.0)
                    .await
                    .map_err(|e| e.to_string())?;
                let gas = if let Some(gas) = gas {
                    gas
                } else {
                    lock.fund_address_and_return_gas(gas_price, Some(gas_budget), sender.0)
                        .await
                };
                (sender.0, gas)
            } else {
                let sender = lock.get_addresses()[wallet_index];
                (
                    sender,
                    lock.wallet()
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
                let keypair = temp_wallet
                    .get_keypair(sender)
                    .await
                    .ok_or("Key not found")?;
                Transaction::from_data_and_signer(tx_data, vec![&keypair])
            } else {
                lock.wallet().sign_transaction(&tx_data)
            };
            let r = lock.execute_transaction(tx).await;
            if r.status_ok().unwrap() {
                Ok::<_, String>(WTransactionBlockResponse(r))
            } else {
                Err(r.errors.join(", "))
            }
        }
        .await
        .into()
    }

    async fn get_coins(&mut self, coin_type: WStructTag, owner: WSuiAddress) -> IO<Vec<WCoin>> {
        async {
            let coin_type = coin_type.0.to_canonical_string(true);
            let lock = self.0.read().await;
            let mut coins = vec![];
            let mut cursor = None;
            loop {
                let page = lock
                    .fullnode_handle
                    .sui_client
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
            Ok::<_, String>(coins.into_iter().map(|x| WCoin(x)).collect())
        }
        .await
        .into()
    }

    async fn get_balance(&mut self, coin_type: WStructTag, owner: WSuiAddress) -> IO<u64> {
        async {
            let coin_type = coin_type.0.to_canonical_string(true);
            let lock = self.0.read().await;
            let balance = lock
                .fullnode_handle
                .sui_client
                .coin_read_api()
                .get_balance(owner.0, Some(coin_type))
                .await
                .map_err(|e| e.to_string())?;
            Ok::<_, String>(balance.total_balance as u64)
        }
        .await
        .into()
    }

    pub(crate) async fn dump_db(&self) -> IO<String> {
        async {
            let lock = self.0.read().await;
            let url = lock
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
            Ok::<_, String>(output)
        }
        .await
        .into()
    }

    async fn stop(&self) -> IO<()> {
        async {
            let lock = self.0.read().await;
            if !lock.swarm.validator_nodes().next().unwrap().is_running() {
                return Err("Cluster is not running".to_string());
            }
            lock.stop_all_validators().await;
            Ok::<_, String>(())
        }
        .await
        .into()
    }
}

fn load(vm: &Thread) -> vm::Result<vm::ExternModule> {
    ExternModule::new(
        vm,
        record!(
            type TestCluster => WTestCluster,
            start => primitive!(1, "lancer.test_cluster.prim.start", async fn WTestCluster::start),
            is_running => primitive!(
                1,
                "lancer.test_cluster.prim.is_running",
                async fn WTestCluster::is_running),
            execute_tx => primitive!(
                5,
                "lancer.test_cluster.prim.execute_tx",
                async fn WTestCluster::execute_tx),
            get_coins => primitive!(
                3,
                "lancer.test_cluster.prim.get_coins",
                async fn WTestCluster::get_coins),
            get_balance => primitive!(
                3,
                "lancer.test_cluster.prim.get_balance",
                async fn WTestCluster::get_balance),
            dump_db => primitive!(
                1,
                "lancer.test_cluster.prim.dump_db",
                async fn WTestCluster::dump_db),
            stop => primitive!(
                1,
                "lancer.test_cluster.prim.stop",
                async fn WTestCluster::stop),
        ),
    )
}

pub fn install(vm: &Thread) -> vm::Result<()> {
    vm.register_type::<WTestCluster>("lancer.test_cluster.prim.TestCluster", &[])?;

    add_extern_module_with_deps(
        vm,
        "lancer.test_cluster.prim",
        load,
        vec!["lancer.rpc.types".to_string()],
    );

    builder::install(vm)?;
    Ok(())
}
