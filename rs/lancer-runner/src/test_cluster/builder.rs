use std::fmt;

use gluon::{
    Thread,
    import::add_extern_module,
    primitive, record,
    vm::{self, ExternModule, api::IO},
};
use gluon_codegen::{Trace, Userdata, VmType};
use std::fmt::Debug;
use test_cluster::TestClusterBuilder;
use tokio::sync::RwLock;
use sui_swarm_config::genesis_config::GenesisConfig;
use crate::test_cluster::WTestCluster;

#[derive(Trace, VmType, Userdata, Default)]
#[gluon(vm_type = "lancer.test_cluster.builder.prim.TestClusterBuilder")]
#[gluon_trace(skip)]
pub struct WTestClusterBuilder(RwLock<Option<TestClusterBuilder>>);

impl Debug for WTestClusterBuilder {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("TestClusterBuilder").finish()
    }
}

impl WTestClusterBuilder {
    pub fn new() -> Self {
        let builder = TestClusterBuilder::new()
            // .with_indexer_backed_rpc()
            .set_genesis_config(GenesisConfig::custom_genesis(1, 1));
        Self(RwLock::new(Some(builder)))
    }

    pub async fn build(&self) -> IO<WTestCluster> {
        async {
            let cluster = self
                .0
                .write()
                .await
                .take()
                .ok_or("Already built".to_string())?
                .build()
                .await;

            cluster.start_all_validators().await;

            Ok::<_, String>(WTestCluster::new(cluster))
        }
        .await
        .into()
    }
}

fn load(vm: &Thread) -> vm::Result<vm::ExternModule> {
    ExternModule::new(
        vm,
        record!(
            type TestClusterBuilder => WTestClusterBuilder,
            build => primitive!(
                1,
                "lancer.test_cluster.builder.prim.build",
                async fn WTestClusterBuilder::build),
        ),
    )
}

pub fn install(vm: &Thread) -> vm::Result<()> {
    vm.register_type::<WTestClusterBuilder>(
        "lancer.test_cluster.builder.prim.TestClusterBuilder",
        &[],
    )?;

    add_extern_module(vm, "lancer.test_cluster.builder.prim", load);
    Ok(())
}
