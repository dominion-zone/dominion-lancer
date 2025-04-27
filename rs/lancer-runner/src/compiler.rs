use gluon::{
    Thread,
    import::add_extern_module,
    primitive, record,
    vm::{self, ExternModule},
};
use gluon_codegen::{Trace, Userdata, VmType};
use std::ops::Deref;
use sui_move_build::{BuildConfig, CompiledPackage};

use crate::sui::WSuiAddress;

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
    fn compile(path: &str) -> Result<Self, String> {
        let builder = BuildConfig::new_for_testing();
        let r = builder
            .build(path.as_ref())
            .map_err(|err| err.to_string())?;
        Ok(Self(r))
    }

    fn bytes(&self) -> Vec<Vec<u8>> {
        self.0.get_package_bytes(false)
    }

    fn dep_ids(&self) -> Vec<WSuiAddress> {
        self.0
            .get_published_dependencies_ids()
            .into_iter()
            .map(|id| WSuiAddress(id.into()))
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
