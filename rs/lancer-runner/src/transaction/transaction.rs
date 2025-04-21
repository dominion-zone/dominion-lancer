use gluon_codegen::{Trace, Userdata, VmType};
use sui_types::transaction::ProgrammableTransaction;

#[derive(Debug, Clone, Trace, VmType, Userdata)]
#[gluon(vm_type = "lancer.transaction.prim.Transaction")]
#[gluon_trace(skip)]
#[gluon_userdata(clone)]
pub struct WTransaction(pub ProgrammableTransaction);
