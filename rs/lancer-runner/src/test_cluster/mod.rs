use fastcrypto::bls12381::min_sig::DST_G1;
use gluon::{
    Thread,
    import::add_extern_module_with_deps,
    primitive, record,
    vm::{self, ExternModule, api::IO},
};
use gluon_codegen::{Trace, Userdata, VmType};
use std::fmt;
use std::fmt::Debug;
use sui_types::{
    base_types::SuiAddress,
    crypto::{Signature, Signer, SuiKeyPair, get_key_pair_from_rng},
    gas_model::units_types::Gas,
    programmable_transaction_builder::ProgrammableTransactionBuilder,
    transaction::{GasData, Transaction, TransactionData, TransactionKind},
};
use test_cluster::TestCluster;
use tokio::process::Command;
use tokio::sync::RwLock;

use crate::{
    rpc::{WTransactionBlockResponse, coin::WCoin},
    sui::{WSuiAddress, types::WStructTag},
    temp_wallet::TempWallet,
    transaction::WTransaction,
};
use sui_keys::keystore::AccountKeystore;

pub mod builder;

#[derive(Trace, VmType, Userdata)]
#[gluon(vm_type = "lancer.test_cluster.prim.TestCluster")]
#[gluon_trace(skip)]
pub struct WTestCluster(TestCluster);

impl Debug for WTestCluster {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("WTestCluster").finish()
    }
}

impl WTestCluster {
    pub(crate) fn new(cluster: TestCluster) -> Self {
        Self(cluster)
    }

    async fn start(&self) -> IO<()> {
        async {
            if self.0.swarm.validator_nodes().next().unwrap().is_running() {
                return Err("Cluster is already running".to_string());
            }
            self.0.start_all_validators().await;
            Ok::<_, String>(())
        }
        .await
        .into()
    }

    pub fn is_running(&self) -> bool {
        self.0.swarm.validator_nodes().next().unwrap().is_running()
    }

    async fn execute_tx(
        &self,
        temp_wallet: &TempWallet,
        pt: &WTransaction,
        gas_budget: u64, // 500_000_000
        sender: WSuiAddress,
        additional_signers: Vec<WSuiAddress>,
    ) -> IO<WTransactionBlockResponse> {
        async {
            if !self.0.swarm.validator_nodes().next().unwrap().is_running() {
                return Err("Cluster is not running".to_string());
            }

            let gas_price = self.0.get_reference_gas_price().await;

            // Generate a fresh keypair for the transaction gas sponsor
            // to make sure the script may not use the SUI coin provided
            // for anything else
            let (sponsor_address, sponsor_keypair) = get_key_pair_from_rng(&mut rand::rngs::OsRng);
            let sponsor_keypair = SuiKeyPair::Ed25519(sponsor_keypair);

            let gas = self
                .0
                .fund_address_and_return_gas(gas_price, Some(gas_budget), sponsor_address)
                .await;

            // create the transaction data that will be sent to the network
            let tx_data = TransactionData::new_with_gas_data(
                TransactionKind::programmable(pt.0.clone()),
                sender.0,
                GasData {
                    payment: vec![gas],
                    owner: sponsor_address,
                    price: gas_price,
                    budget: gas_budget,
                },
            );
            let mut addresses = vec![sender.0];
            for additional_signer in additional_signers {
                addresses.push(additional_signer.0);
            }
            let tx = temp_wallet
                .with_keipairs(addresses.iter(), |keypairs| {
                    let mut signers: Vec<&dyn Signer<Signature>> = vec![&sponsor_keypair];
                    signers.extend(&keypairs);
                    Transaction::from_data_and_signer(tx_data, signers)
                })
                .await?;

            let r = self.0.execute_transaction(tx).await;
            {
                let (another_sponsor, gas) = self
                    .0
                    .wallet
                    .get_one_gas_object()
                    .await
                    .map_err(|e| e.to_string())?
                    .ok_or("No gas".to_string())?;
                // Cleanup the blockchain (next time we will generate a new keypair for the sponsor)
                let mut b = ProgrammableTransactionBuilder::new();
                b.pay_all_sui(self.0.get_address_0());
                let tx_data = TransactionData::new_with_gas_data(
                    TransactionKind::programmable(b.finish()),
                    sponsor_address,
                    GasData {
                        payment: vec![gas],
                        owner: another_sponsor,
                        price: gas_price,
                        budget: 500_000_000,
                    },
                );
                let tx = Transaction::from_data_and_signer(
                    tx_data,
                    vec![
                        &sponsor_keypair,
                        self.0
                            .wallet
                            .config
                            .keystore
                            .get_key(&another_sponsor)
                            .unwrap(),
                    ],
                );
                self.0.execute_transaction(tx).await;
            }
            Ok::<_, String>(WTransactionBlockResponse(r))
        }
        .await
        .into()
    }

    async fn get_coins(&self, coin_type: WStructTag, owner: WSuiAddress) -> IO<Vec<WCoin>> {
        async {
            let coin_type = coin_type.0.to_canonical_string(true);
            let mut coins = vec![];
            let mut cursor = None;
            loop {
                let page = self
                    .0
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

    async fn get_balance(&self, coin_type: WStructTag, owner: WSuiAddress) -> IO<u64> {
        async {
            let coin_type = coin_type.0.to_canonical_string(true);
            let balance = self
                .0
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
            let url = self
                .0
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
            if !self.0.swarm.validator_nodes().next().unwrap().is_running() {
                return Err("Cluster is not running".to_string());
            }
            self.0.stop_all_validators().await;
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
                WTestCluster::is_running),
            execute_tx => primitive!(
                6,
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
