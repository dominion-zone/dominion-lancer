use std::{collections::HashMap, fmt, sync::Arc};

use gluon::{
    Thread,
    import::add_extern_module,
    primitive, record,
    vm::{self, ExternModule, api::IO},
};
use gluon_codegen::{Trace, Userdata, VmType};
use std::fmt::Debug;
use sui_types::{
    base_types::SuiAddress,
    crypto::{SuiKeyPair, get_key_pair_from_rng},
};
use test_cluster::TestClusterBuilder;
use tokio::sync::RwLock;

use crate::sui::WSuiAddress;

pub struct TestClusterBuilderInner {
    pub builder: TestClusterBuilder,
    pub keys: HashMap<SuiAddress, SuiKeyPair>,
}

#[derive(Clone, Trace, VmType, Userdata)]
#[gluon(vm_type = "lancer.temp_wallet.prim.TempWallet")]
#[gluon_trace(skip)]
#[gluon_userdata(clone)]
pub struct TempWallet(Arc<RwLock<HashMap<SuiAddress, SuiKeyPair>>>);

impl Debug for TempWallet {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("TempWallet").finish()
    }
}

impl Default for TempWallet {
    fn default() -> Self {
        Self(Arc::new(RwLock::new(HashMap::new())))
    }
}

impl TempWallet {
    pub fn new(_: ()) -> IO<Self> {
        IO::Value(Self::default())
    }

    pub async fn generate_keypair(&self) -> IO<WSuiAddress> {
        let (address, keypair) = get_key_pair_from_rng(&mut rand::rngs::OsRng);
        let keypair = SuiKeyPair::Ed25519(keypair);
        self.0.write().await.insert(address, keypair);
        IO::Value(WSuiAddress(address))
    }

    pub async fn get_keypair(&self, address: SuiAddress) -> Option<SuiKeyPair> {
        self.0.read().await.get(&address).map(|k| k.copy())
    }

    pub async fn get_keys(&self) -> Vec<WSuiAddress> {
        self.0
            .read()
            .await
            .keys()
            .map(|k| WSuiAddress(k.clone()))
            .collect::<Vec<_>>()
    }
}

fn load(vm: &Thread) -> vm::Result<vm::ExternModule> {
    ExternModule::new(
        vm,
        record!(
            type TempWallet => TempWallet,
            new => primitive!(1, "lancer.temp_wallet.prim.new", TempWallet::new),
            generate_keypair => primitive!(1, "lancer.temp_wallet.prim.generate_keypair", async fn TempWallet::generate_keypair),
            get_keys => primitive!(1, "lancer.temp_wallet.prim.get_keys", async fn TempWallet::get_keys),
        ),
    )
}

pub fn install(vm: &Thread) -> vm::Result<()> {
    vm.register_type::<TempWallet>("lancer.temp_wallet.prim.TempWallet", &[])?;

    add_extern_module(vm, "lancer.temp_wallet.prim", load);
    Ok(())
}
