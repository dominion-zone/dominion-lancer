use gluon::{
    Thread,
    import::add_extern_module,
    primitive, record,
    vm::{self, ExternModule, api::IO},
};
use gluon_codegen::{Trace, Userdata, VmType};
use std::{fmt, ops::Deref};
use sui_move_build::{BuildConfig, CompiledPackage};

use crate::sui::WObjectId;

type ExecResult<T> = std::result::Result<T, String>;

#[derive(Debug, Clone, Trace, VmType, Userdata)]
#[gluon(vm_type = "lancer.compiler.prim.Package")]
#[gluon_trace(skip)]
#[gluon_userdata(clone)]
pub struct WPackage(CompiledPackage);

impl Deref for WPackage {
    type Target = CompiledPackage;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

impl WPackage {
    fn compile(path: &str) -> IO<Self> {
        let builder = BuildConfig::new_for_testing();
        match builder.build(path.as_ref()) {
            Ok(package) => IO::Value(WPackage(package)),
            Err(err) => IO::Exception(err.to_string()),
        }
    }

    fn bytes(&self) -> Vec<Vec<u8>> {
        self.0.get_package_bytes(false)
    }

    fn dep_ids(&self) -> Vec<WObjectId> {
        self.0.get_published_dependencies_ids().into_iter()
            .map(|id| WObjectId(id))
            .collect()
    }
}

fn load_compiler(vm: &Thread) -> vm::Result<vm::ExternModule> {
    ExternModule::new(
        vm,
        record!(
            type Package => WPackage,
            compile => primitive!(1, "lancer.compiler.prim.compile", WPackage::compile),
            bytes => primitive!(1, "lancer.compiler.prim.bytes", WPackage::bytes),
            dep_ids => primitive!(1, "lancer.compiler.prim.dep_ids", WPackage::dep_ids),
        ),
    )
}

pub fn install_compiler(vm: &Thread) -> vm::Result<()> {
    vm.register_type::<WPackage>("lancer.compiler.prim.Package", &[])?;

    add_extern_module(vm, "lancer.compiler.prim", load_compiler);
    Ok(())
}
