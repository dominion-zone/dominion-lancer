use std::str::FromStr;

use crate::sui::{WDigest, WSuiAddress, types::WStructTag};
use gluon::{
    Thread,
    base::types::ArcType,
    vm::{
        self,
        api::{Getable, Pushable, ValueRef, VmType},
        impl_getable_simple,
    },
};
use move_core_types::language_storage::StructTag;
use sui_json_rpc_types::Coin;
use sui_types::digests::TransactionDigest;
use sui_types::{
    base_types::{ObjectID, SequenceNumber},
    digests::{Digest, ObjectDigest},
    transaction::ObjectArg,
};

/*

*/
#[derive(Clone, Debug)]
pub struct WCoin(pub Coin);

impl VmType for WCoin {
    type Type = Self;
    fn make_type(vm: &Thread) -> ArcType {
        vm.find_type_info("lancer.rpc.types.Coin")
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
                let coin_type = WStructTag::from_value(
                    vm,
                    data.lookup_field(vm, "coin_type")
                        .expect("Failed to get coin_type"),
                )
                .0
                .to_canonical_string(true);
                let coin_object_id = WSuiAddress::from_value(
                    vm,
                    data.lookup_field(vm, "coin_object_id")
                        .expect("Failed to get coin_object_id"),
                )
                .0
                .into();
                let version = SequenceNumber::from_u64(u64::from_value(
                    vm,
                    data.lookup_field(vm, "version")
                        .expect("Failed to get version"),
                ));
                let digest = ObjectDigest::new(
                    WDigest::from_value(
                        vm,
                        data.lookup_field(vm, "digest")
                            .expect("Failed to get digest"),
                    )
                    .0
                    .into_inner(),
                );
                let balance = u64::from_value(
                    vm,
                    data.lookup_field(vm, "balance")
                        .expect("Failed to get balance"),
                );
                let previous_transaction = TransactionDigest::new(
                    WDigest::from_value(
                        vm,
                        data.lookup_field(vm, "previous_transaction")
                            .expect("Failed to get previous_transaction"),
                    )
                    .0
                    .into_inner(),
                );

                Self(Coin {
                    coin_type,
                    coin_object_id,
                    version,
                    digest,
                    balance,
                    previous_transaction,
                })
            }
            _ => panic!("ValueRef is not a lancer.rpc.Coin"),
        }
    }
}

impl<'vm> Pushable<'vm> for WCoin {
    fn vm_push(self, context: &mut vm::api::ActiveThread<'vm>) -> vm::Result<()> {
        WStructTag(
            StructTag::from_str(&self.0.coin_type)
                .map_err(|_| vm::Error::Message("Invalid coin type".to_string()))?,
        )
        .vm_push(context)?;
        WSuiAddress(self.0.coin_object_id.into()).vm_push(context)?;
        self.0.version.value().vm_push(context)?;
        WDigest(Digest::new(self.0.digest.into_inner())).vm_push(context)?;
        self.0.balance.vm_push(context)?;
        WDigest(Digest::new(self.0.previous_transaction.into_inner())).vm_push(context)?;
        let vm = context.thread();
        context.context().push_new_record(
            6,
            &[
                "coin_type",
                "coin_object_id",
                "version",
                "digest",
                "balance",
                "previous_transaction",
            ]
            .into_iter()
            .map(|s| vm.global_env().intern(s))
            .collect::<vm::Result<Vec<_>>>()?,
        )?;
        Ok(())
    }
}
