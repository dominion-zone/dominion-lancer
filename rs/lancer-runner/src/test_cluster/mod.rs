use crate::{
    rpc::{TransactionBlockResponsePtr, WTransactionBlockResponse, coin::WCoin},
    sui::{
        WSuiAddress,
        object::{ObjectPtr, WObject, WObjectInfo},
        types::WStructTag,
    },
    temp_wallet::TempWallet,
    transaction::TransactionRef,
};
use anyhow::Context;
use fastcrypto::bls12381::min_sig::DST_G1;
use gluon::{
    Thread,
    import::add_extern_module_with_deps,
    primitive, record,
    vm::{self, ExternModule, api::IO},
};
use gluon_codegen::{Trace, Userdata, VmType};
use move_binary_format::file_format::CompiledModule;
use move_bytecode_utils::module_cache::GetModule;
use move_core_types::language_storage::ModuleId;
use move_core_types::{
    account_address::AccountAddress,
    annotated_value::{MoveStruct, MoveStructLayout, MoveValue},
    language_storage::StructTag,
};
use std::{collections::HashMap, fmt::Debug, usize};
use std::{fmt, sync::Arc};
use sui_keys::keystore::AccountKeystore;
use sui_node::SuiNode;
use sui_types::storage::BackingPackageStore;
use sui_types::{
    base_types::{ObjectID, SuiAddress},
    crypto::{Signature, Signer, SuiKeyPair, get_key_pair_from_rng},
    gas_model::units_types::Gas,
    object::Object,
    programmable_transaction_builder::ProgrammableTransactionBuilder,
    transaction::{GasData, Transaction, TransactionData, TransactionKind},
};
use test_cluster::TestCluster;
use tokio::process::Command;
use tokio::sync::RwLock;

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
        pt: &TransactionRef,
        gas_budget: u64, // 500_000_000
        sender: WSuiAddress,
        additional_signers: Vec<WSuiAddress>,
    ) -> IO<TransactionBlockResponsePtr> {
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
            Ok::<_, String>(TransactionBlockResponsePtr(Arc::new(r)))
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
        unimplemented!();
        /*
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
        */
    }

    pub fn get_owned_objects(&self, owner: WSuiAddress) -> IO<Vec<WObjectInfo>> {
        self.0
            .fullnode_handle
            .sui_node
            .with(|node| {
                node.state()
                    .get_owner_objects(owner.0, None, usize::MAX, None)
                    .map(|v| v.into_iter().map(WObjectInfo).collect())
            })
            .map_err(|e| e.to_string())
            .into()
    }

    pub async fn get_owned_objects_recursive(&self, owner: WSuiAddress) -> IO<Vec<ObjectPtr>> {
        self.0
            .fullnode_handle
            .sui_node
            .with_async(async |node| {
                let roots = node
                    .state()
                    .get_owner_objects(owner.0, None, usize::MAX, None)?;
                let mut result = HashMap::new();
                for root in roots {
                    if !result.contains_key(&root.object_id) {
                        Box::pin(Self::get_children_recursive(
                            node,
                            &root.object_id,
                            &mut result,
                        ))
                        .await?;
                    }
                }
                Ok::<Vec<_>, anyhow::Error>(
                    result
                        .into_values()
                        .map(|v| ObjectPtr(Arc::new(v)))
                        .collect(),
                )
            })
            .await
            .map_err(|e| e.to_string())
            .into()
    }

    pub async fn get_object(&self, object_id: WSuiAddress) -> IO<WObject> {
        async {
            let r = self
                .0
                .get_object_from_fullnode_store(&ObjectID::from_address(object_id.0.into()))
                .await
                .ok_or("Failed to get object")?;
            Ok::<_, String>(WObject(Arc::new(r)))
        }
        .await
        .into()
    }

    /*
    async fn get_object_with_layout(
        &self,
        object_id: &ObjectID,
    ) -> anyhow::Result<(Object, Option<MoveStructLayout>)> {
        let obj = self
            .0
            .get_object_from_fullnode_store(object_id)
            .await
            .context("Failed to get object")?;
        let layout = self.0.fullnode_handle.sui_node.with(|node| {
            obj.get_layout(&ResolverWrapper(
                node.state().get_backing_package_store().clone(),
            ))
        })?;
        Ok((obj, layout))
    }*/

    async fn get_children_recursive(
        node: &SuiNode,
        object_id: &ObjectID,
        result: &mut HashMap<ObjectID, Object>,
    ) -> anyhow::Result<()> {
        let object = node
            .state()
            .get_object(object_id)
            .await
            .context("Failed to get object")?;
        result.insert(object.id(), object.clone());
        let layout = object.get_layout(&ResolverWrapper(
            node.state().get_backing_package_store().clone(),
        ))?;
        let layout = if let Some(layout) = layout {
            layout
        } else {
            return Ok(());
        };
        let wrapped = collect_uids(&object.data.try_as_move().unwrap().to_move_struct(&layout)?);
        for id in wrapped {
            for (key, _) in node
                .state()
                .get_dynamic_fields(id.into(), None, usize::MAX)?
            {
                if result.contains_key(&key) {
                    continue;
                }
                Box::pin(Self::get_children_recursive(node, &key, result)).await?;
            }

            for child in node
                .state()
                .get_owner_objects(id.into(), None, usize::MAX, None)?
            {
                if result.contains_key(&child.object_id) {
                    continue;
                }
                Box::pin(Self::get_children_recursive(node, &child.object_id, result)).await?;
            }
        }
        Ok(())
    }

    pub async fn get_object_recursive(&self, object_id: WSuiAddress) -> IO<Vec<ObjectPtr>> {
        async {
            let mut result = HashMap::new();
            self.0
                .fullnode_handle
                .sui_node
                .with_async(async |node| {
                    Self::get_children_recursive(
                        node,
                        &ObjectID::from_address(object_id.0.into()),
                        &mut result,
                    )
                    .await
                })
                .await?;
            Ok::<Vec<ObjectPtr>, anyhow::Error>(
                result
                    .into_values()
                    .map(|v| ObjectPtr(Arc::new(v)))
                    .collect(),
            )
        }
        .await
        .map_err(|e| e.to_string())
        .into()
    }

    pub fn get_all_live_objects(&self) -> IO<Vec<ObjectPtr>> {
        use sui_core::authority::authority_store_tables::LiveObject::Normal;
        use sui_core::global_state_hasher::GlobalStateHashStore;

        IO::Value(self.0.fullnode_handle.sui_node.with(|node| {
            node.state()
                .database_for_testing()
                .iter_cached_live_object_set_for_testing(false)
                .map(|o| match o {
                    Normal(o) => ObjectPtr(Arc::new(o)),
                    _ => unreachable!(),
                })
                .collect::<Vec<_>>()
        }))
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
            /*
            dump_db => primitive!(
                1,
                "lancer.test_cluster.prim.dump_db",
                async fn WTestCluster::dump_db),
            */
            get_owned_objects => primitive!(
                2,
                "lancer.test_cluster.prim.get_owned_objects",
                WTestCluster::get_owned_objects),
            get_owned_objects_recursive => primitive!(
                2,
                "lancer.test_cluster.prim.get_owned_objects_recursive",
                async fn WTestCluster::get_owned_objects_recursive),

            get_object => primitive!(
                2,
                "lancer.test_cluster.prim.get_object",
                async fn WTestCluster::get_object),
            get_object_recursive => primitive!(
                2,
                "lancer.test_cluster.prim.get_object_recursive",
                async fn WTestCluster::get_object_recursive),

            get_all_live_objects => primitive!(
                1,
                "lancer.test_cluster.prim.get_all_live_objects",
                WTestCluster::get_all_live_objects),
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
        vec![
            "lancer.rpc.types".to_string(),
            "lancer.sui.object.types".to_string(),
        ],
    );

    builder::install(vm)?;
    Ok(())
}

fn is_uid_tag(tag: &StructTag) -> bool {
    tag.address == AccountAddress::from_hex_literal("0x2").unwrap()
        && tag.module.as_str() == "object"
        && tag.name.as_str() == "UID"
        && tag.type_params.is_empty()
}

pub fn collect_uids(struct_: &MoveStruct) -> Vec<AccountAddress> {
    let mut result = Vec::new();
    collect_uids_recursive(struct_, &mut result);
    result
}

fn collect_uids_recursive(struct_: &MoveStruct, out: &mut Vec<AccountAddress>) {
    if is_uid_tag(&struct_.type_) {
        if let Some((_, MoveValue::Struct(id_struct))) =
            struct_.fields.iter().find(|(k, _)| k.as_str() == "id")
        {
            if let Some((_, MoveValue::Address(addr))) =
                id_struct.fields.iter().find(|(k, _)| k.as_str() == "bytes")
            {
                out.push(*addr);
                return;
            } else {
                panic!(
                    "UID struct does not contain 'bytes' field: {:?}",
                    id_struct.fields
                );
            }
        } else {
            panic!(
                "UID struct does not contain 'id' field: {:?}",
                struct_.fields
            );
        }
    }

    for (_, val) in &struct_.fields {
        match val {
            MoveValue::Struct(s) => collect_uids_recursive(s, out),
            MoveValue::Vector(vs) => {
                for item in vs {
                    if let MoveValue::Struct(s) = item {
                        collect_uids_recursive(s, out);
                    }
                }
            }
            _ => {}
        }
    }
}

struct ResolverWrapper(pub Arc<dyn BackingPackageStore + Send + Sync>);

impl GetModule for ResolverWrapper {
    type Error = anyhow::Error;

    type Item = CompiledModule;

    fn get_module_by_id(
        &self,
        module_id: &ModuleId,
    ) -> anyhow::Result<Option<Self::Item>, Self::Error> {
        Ok(self
            .0
            .get_package_object(&ObjectID::from(*module_id.address()))?
            .and_then(|package| {
                package
                    .move_package()
                    .serialized_module_map()
                    .get(module_id.name().as_str())
                    .map(|bytes| CompiledModule::deserialize_with_defaults(bytes).unwrap())
            }))
    }
}
