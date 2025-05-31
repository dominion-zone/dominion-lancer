use gluon::{
    Thread,
    base::types::ArcType,
    vm::{
        self,
        api::{Getable, Pushable, ValueRef, VmType},
        impl_getable_simple,
    },
};
use sui_types::coin::Coin;

use crate::sui::WSuiAddress;

pub struct WCoin(Coin);

impl VmType for WCoin {
    type Type = Self;
    fn make_type(vm: &Thread) -> ArcType {
        vm.find_type_info("lancer.framework.types.Coin")
            .unwrap()
            .clone()
            .into_type()
    }
}

impl<'vm, 'value> Getable<'vm, 'value> for WCoin {
    impl_getable_simple!();

    fn from_value(vm: &'vm Thread, value: vm::Variants<'value>) -> Self {
        match value.as_ref() {
            ValueRef::Data(data) => {
                let id = data.lookup_field(vm, "id").expect("Failed to get id");
                let id = if let ValueRef::Data(id) = id.as_ref() {
                    WSuiAddress::from_value(
                        vm,
                        id.lookup_field(vm, "id").expect("Failed to get id"),
                    )
                    .0
                    .into()
                } else {
                    panic!("Expected sui.address.SuiAddress for id")
                };

                let balance = data
                    .lookup_field(vm, "balance")
                    .expect("Failed to get balance");
                let balance = if let ValueRef::Data(balance) = balance.as_ref() {
                    u64::from_value(
                        vm,
                        balance
                            .lookup_field(vm, "value")
                            .expect("Failed to get balance value"),
                    )
                } else {
                    panic!("Expected u64 for balance")
                };

                Self(Coin::new(id, balance))
            }
            _ => panic!("ValueRef is not a lancer.framework.Coin"),
        }
    }
}

impl<'vm> Pushable<'vm> for WCoin {
    fn vm_push(self, context: &mut vm::api::ActiveThread<'vm>) -> vm::Result<()> {
        let vm = context.thread();
        let id_ident = vm.global_env().intern("id")?;
        WSuiAddress(self.0.id().clone().into()).vm_push(context)?;
        context.context().push_new_record(1, &[id_ident])?;
        self.0.value().vm_push(context)?;
        let value_ident = vm.global_env().intern("value")?;
        context.context().push_new_record(1, &[value_ident])?;

        let id_ident = vm.global_env().intern("id")?;
        let balance_ident = vm.global_env().intern("balance")?;

        context
            .context()
            .push_new_record(2, &[id_ident, balance_ident])?;
        Ok(())
    }
}

impl WCoin {
    pub fn to_bytes(self) -> Vec<u8> {
        self.0.to_bcs_bytes()
    }

    pub fn id(self) -> WSuiAddress {
        WSuiAddress(self.0.id().clone().into())
    }

    pub fn value(self) -> u64 {
        self.0.value()
    }
}
