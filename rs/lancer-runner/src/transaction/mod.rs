use gluon::{
    Thread,
    import::add_extern_module,
    primitive, record,
    vm::{self, ExternModule},
};
use gluon_codegen::{Trace, Userdata, VmType};
use sui_types::transaction::ProgrammableTransaction;

pub mod builder;


#[derive(Debug, Clone, Trace, VmType, Userdata)]
#[gluon(vm_type = "lancer.transaction.prim.Transaction")]
#[gluon_trace(skip)]
#[gluon_userdata(clone)]
pub struct WTransaction(pub ProgrammableTransaction);


fn load(vm: &Thread) -> vm::Result<vm::ExternModule> {
    ExternModule::new(
        vm,
        record!(
            type Transaction => WTransaction,
        ),
    )
}

pub fn install(vm: &Thread) -> vm::Result<()> {
    vm.register_type::<WTransaction>("lancer.transaction.prim.Transaction", &[])?;

    add_extern_module(vm, "lancer.transaction.prim", load);

    builder::install(vm)?;

    Ok(())
}
