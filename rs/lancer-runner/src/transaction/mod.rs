use gluon::{
    Thread,
    import::{add_extern_module, add_extern_module_with_deps},
    primitive, record,
    vm::{self, ExternModule},
};
use gluon_codegen::{Trace, Userdata, VmType};
use serde::Serialize;
use sui_types::transaction::ProgrammableTransaction;

pub mod builder;

#[derive(Debug, Clone, Trace, VmType, Userdata)]
#[gluon(vm_type = "lancer.transaction.prim.Transaction")]
#[gluon_trace(skip)]
#[gluon_userdata(clone)]
pub struct WTransaction(pub ProgrammableTransaction);

impl WTransaction {
    pub fn serialize(&self) -> Result<serde_json::Value, String> {
        serde_json::to_value(&self.0).map_err(|e| e.to_string())
    }

    pub fn show(&self) -> String {
        format!("{:?}", &self.0)
    }
}

fn load(vm: &Thread) -> vm::Result<vm::ExternModule> {
    ExternModule::new(
        vm,
        record!(
            type Transaction => WTransaction,
            serialize => primitive!(1, "lancer.transaction.prim.serialize", WTransaction::serialize),
            show => primitive!(1, "lancer.transaction.prim.show", WTransaction::show),
        ),
    )
}

pub fn install(vm: &Thread) -> vm::Result<()> {
    vm.register_type::<WTransaction>("lancer.transaction.prim.Transaction", &[])?;

    add_extern_module_with_deps(
        vm,
        "lancer.transaction.prim",
        load,
        vec!["std.json".to_string()],
    );

    builder::install(vm)?;

    Ok(())
}
