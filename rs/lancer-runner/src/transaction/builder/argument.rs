use gluon::{
    Thread,
    base::types::ArcType,
    vm::{
        self,
        api::{Getable, Pushable, ValueRef, VmType},
        impl_getable_simple,
    },
};
use sui_types::transaction::Argument;

#[derive(Clone, Debug)]
pub struct WArgument(pub Argument);

impl VmType for WArgument {
    type Type = Self;
    fn make_type(vm: &Thread) -> ArcType {
        vm.find_type_info("lancer.transaction.builder.types.Argument")
            .unwrap()
            .clone()
            .into_type()
    }
}

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
            _ => panic!("ValueRef is not a lancer.transaction.builder.types.Argument"),
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
