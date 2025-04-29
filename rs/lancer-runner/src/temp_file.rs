use std::{
    collections::{HashMap, HashSet},
    fmt,
    path::{Path, PathBuf},
    sync::Arc,
};

use async_tempfile::{TempDir, TempFile};
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
    crypto::{Signature, Signer, SuiKeyPair, get_key_pair_from_rng},
};
use test_cluster::TestClusterBuilder;
use tokio::sync::RwLock;

#[derive(Debug, Trace, VmType, Userdata)]
#[gluon(vm_type = "lancer.temp_file.prim.TempDir")]
#[gluon_trace(skip)]
pub struct WTempDir(RwLock<Option<TempDir>>);

impl WTempDir {
    pub async fn new(_: ()) -> IO<Self> {
        TempDir::new()
            .await
            .map_err(|e| e.to_string())
            .map(|dir| Self(RwLock::new(Some(dir))))
            .into()
    }

    pub async fn new_with_name(name: String) -> IO<Self> {
        TempDir::new_with_name(name)
            .await
            .map_err(|e| e.to_string())
            .map(|dir| Self(RwLock::new(Some(dir))))
            .into()
    }

    pub async fn new_in(root_dir: &Path) -> IO<Self> {
        TempDir::new_in(root_dir)
            .await
            .map_err(|e| e.to_string())
            .map(|dir| Self(RwLock::new(Some(dir))))
            .into()
    }

    pub async fn new_with_name_in(name: String, root_dir: &Path) -> IO<Self> {
        TempDir::new_with_name_in(name, root_dir)
            .await
            .map_err(|e| e.to_string())
            .map(|dir| Self(RwLock::new(Some(dir))))
            .into()
    }

    pub async fn dir_path(&self) -> IO<PathBuf> {
        self.0
            .read()
            .await
            .as_ref()
            .ok_or("Dropped".to_string())
            .map(|dir| dir.dir_path().to_owned())
            .into()
    }

    pub async fn drop(&self) -> IO<()> {
        (async {
            let tmp_file = self
                .0
                .write()
                .await
                .take()
                .ok_or("Already dropped".to_string())?;
            tmp_file.drop_async().await;
            Ok::<(), String>(())
        })
        .await
        .into()
    }
}

fn load(vm: &Thread) -> vm::Result<vm::ExternModule> {
    ExternModule::new(
        vm,
        record!(
            type TempDir => WTempDir,
            new => primitive!(1, "lancer.temp_file.prim.new", async fn WTempDir::new),
            new_with_name => primitive!(1, "lancer.temp_file.prim.new_with_name", async fn WTempDir::new_with_name),
            new_in => primitive!(1, "lancer.temp_file.prim.new_in", async fn WTempDir::new_in),
            new_with_name_in => primitive!(2, "lancer.temp_file.prim.new_with_name_in", async fn WTempDir::new_with_name_in),
            dir_path => primitive!(1, "lancer.temp_file.prim.dir_path", async fn WTempDir::dir_path),
            drop => primitive!(1, "lancer.temp_file.prim.drop", async fn WTempDir::drop),
        ),
    )
}

pub fn install(vm: &Thread) -> vm::Result<()> {
    vm.register_type::<WTempDir>("lancer.temp_file.prim.TempDir", &[])?;

    add_extern_module(vm, "lancer.temp_file.prim", load);
    Ok(())
}
