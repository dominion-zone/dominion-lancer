use gluon::{
    Thread,
    import::add_extern_module,
    primitive, record,
    vm::{
        self, ExternModule,
        api::{Collect, Getable, IO, Pushable, ValueRef, VmType},
        impl_getable_simple,
    },
};
use gluon_codegen::{Trace, Userdata, VmType};
use serde::de;
use std::{fmt, str::FromStr, sync::Arc};
use sui_types::{
    base_types::ObjectID,
    programmable_transaction_builder::ProgrammableTransactionBuilder,
    transaction::{Argument, ProgrammableTransaction},
};
use tokio::sync::RwLock;

use crate::sui::WObjectId;

type ExecResult<T> = std::result::Result<T, String>;

#[derive(Debug, Clone, Trace, VmType, Userdata)]
#[gluon(vm_type = "lancer.transaction.prim.Transaction")]
#[gluon_trace(skip)]
#[gluon_userdata(clone)]
pub struct WTransaction(pub ProgrammableTransaction);

#[derive(Trace, VmType, Userdata)]
#[gluon(vm_type = "lancer.transaction.prim.Builder")]
#[gluon_trace(skip)]
pub struct WBuilder(RwLock<Option<ProgrammableTransactionBuilder>>);

#[derive(Clone, Debug, VmType)]
#[gluon(vm_type = "lancer.transaction.Argument")]
pub struct WArgument(Argument);

impl<'vm, 'value> Getable<'vm, 'value> for WArgument {
    impl_getable_simple!();

    fn from_value(vm: &'vm Thread, value: vm::Variants<'value>) -> Self {
        match value.as_ref() {
            ValueRef::Data(data) => match data.tag() {
                0 => WArgument(Argument::GasCoin),
                1 => WArgument(Argument::Input(u16::from_value(
                    vm,
                    data.get_variant(0).unwrap(),
                ))),
                2 => WArgument(Argument::Result(u16::from_value(
                    vm,
                    data.get_variant(0).unwrap(),
                ))),
                3 => WArgument(Argument::NestedResult(
                    u16::from_value(vm, data.get_variant(0).unwrap()),
                    u16::from_value(vm, data.get_variant(1).unwrap()),
                )),
                _ => panic!("ValueRef has a wrong tag: {}", data.tag()),
            },
            _ => panic!("ValueRef is not a lancer.transaction.Argument"),
        }
    }
}

impl<'vm> Pushable<'vm> for WArgument {
    fn vm_push(self, context: &mut vm::api::ActiveThread<'vm>) -> vm::Result<()> {
        match self {
            WArgument(Argument::GasCoin) => {
                context.context().push_new_data(0, 0)?;
            }
            WArgument(Argument::Input(i)) => {
                i.vm_push(context)?;
                context.context().push_new_data(1, 1)?;
            }
            WArgument(Argument::Result(i)) => {
                i.vm_push(context)?;
                context.context().push_new_data(2, 1)?;
            }
            WArgument(Argument::NestedResult(i, j)) => {
                i.vm_push(context)?;
                j.vm_push(context)?;
                context.context().push_new_data(3, 2)?;
            }
        }
        Ok(())
    }
}

impl WBuilder {
    fn new() -> IO<Self> {
        let builder = ProgrammableTransactionBuilder::new();
        IO::Value(WBuilder(RwLock::new(Some(builder))))
    }

    async fn publish_upgradeable(
        &self,
        modules: Vec<Vec<u8>>,
        dep_ids: Vec<WObjectId>,
    ) -> IO<WArgument> {
        self.0
            .write()
            .await
            .as_mut()
            .map_or(IO::Exception("Already built".to_string()), |b| {
                IO::Value(WArgument(b.publish_upgradeable(
                    modules,
                    dep_ids.into_iter().map(|id| *id).collect(),
                )))
            })
    }

    async fn publish_immutable(
        &self,
        modules: Vec<Vec<u8>>,
        dep_ids: Vec<WObjectId>,
    ) -> IO<
    ()> {
        self.0
            .write()
            .await
            .as_mut()
            .map_or(IO::Exception("Already built".to_string()), |b| {
                b.publish_immutable(
                    modules,
                    dep_ids.into_iter().map(|id| *id).collect(),
                );
                IO::Value(())
            })
    }

    async fn finish(&self) -> IO<WTransaction> {
        self.0
            .write()
            .await
            .take()
            .map_or(IO::Exception("Already built".to_string()), |b| {
                IO::Value(WTransaction(b.finish()))
            })
    }
}

impl fmt::Debug for WBuilder {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "Builder({{..}})")
    }
}

fn load_transaction(vm: &Thread) -> vm::Result<vm::ExternModule> {
    ExternModule::new(
        vm,
        record!(
            type Builder => WBuilder,
            type Transaction => WTransaction,
            builder => primitive!(0, "lancer.transaction.prim.builder", WBuilder::new),
            publish_upgradeable => primitive!(
                3,
                "lancer.transaction.prim.publish_upgradeable",
                async fn WBuilder::publish_upgradeable),
            publish_immutable => primitive!(
                3,
                "lancer.transaction.prim.publish_immutable",
                async fn WBuilder::publish_immutable),
            finish => primitive!(1, "lancer.transaction.prim.finish", async fn WBuilder::finish),
        ),
    )
}

pub fn install_transaction(vm: &Thread) -> vm::Result<()> {
    vm.register_type::<WBuilder>("lancer.transaction.prim.Builder", &[])?;
    vm.register_type::<WArgument>("lancer.transaction.Argument", &[])?;
    vm.register_type::<WTransaction>("lancer.transaction.prim.Transaction", &[])?;

    add_extern_module(vm, "lancer.transaction.prim", load_transaction);
    Ok(())
}
