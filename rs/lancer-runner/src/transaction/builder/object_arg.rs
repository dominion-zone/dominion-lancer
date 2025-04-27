use gluon::{
    Thread,
    base::types::ArcType,
    vm::{
        self,
        api::{Getable, Pushable, ValueRef, VmType},
        impl_getable_simple,
    },
};
use sui_types::{
    base_types::{ObjectID, SequenceNumber},
    digests::{Digest, ObjectDigest},
    transaction::ObjectArg,
};

use crate::sui::{WDigest, WSuiAddress};

/*
   // A Move object from fastpath.
   ImmOrOwnedObject(ObjectRef),
   // A Move object from consensus (historically consensus objects were always shared).
   // SharedObject::mutable controls whether caller asks for a mutable reference to shared object.
   SharedObject {
       id: ObjectID,
       initial_shared_version: SequenceNumber,
       mutable: bool,
   },
   // A Move object that can be received in this transaction.
   Receiving(ObjectRef),
*/
#[derive(Clone, Debug)]
pub struct WObjectArg(pub ObjectArg);

impl VmType for WObjectArg {
    type Type = Self;
    fn make_type(vm: &Thread) -> ArcType {
        vm.find_type_info("lancer.transaction.builder.types.ObjectArg")
            .unwrap()
            .clone()
            .into_type()
    }
}

impl<'vm, 'value> Getable<'vm, 'value> for WObjectArg {
    impl_getable_simple!();

    fn from_value(vm: &'vm Thread, value: vm::Variants<'value>) -> Self {
        match value.as_ref() {
            ValueRef::Data(data) => match data.tag() {
                0 => {
                    // A Move object from fastpath.
                    let (object_id, sequence_number, object_digest) =
                        <(WSuiAddress, u64, WDigest)>::from_value(
                            vm,
                            data.get_variant(0).expect("object_ref is missing"),
                        );
                    WObjectArg(ObjectArg::ImmOrOwnedObject((
                        object_id.0.into(),
                        SequenceNumber::from_u64(sequence_number),
                        ObjectDigest::new(object_digest.0.into_inner()),
                    )))
                }
                1 => {
                    // A Move object from consensus (historically consensus objects were always shared).
                    // SharedObject::mutable controls whether caller asks for a mutable reference to shared object.
                    let inner = data.get_variant(0).expect("shared_object is missing");
                    match inner.as_ref() {
                        ValueRef::Data(inner_data) => {
                            let id = ObjectID::from(
                                WSuiAddress::from_value(
                                    vm,
                                    inner_data.lookup_field(vm, "id").expect("id is missing"),
                                )
                                .0,
                            );
                            let initial_shared_version = SequenceNumber::from_u64(u64::from_value(
                                vm,
                                inner_data
                                    .lookup_field(vm, "initial_shared_version")
                                    .expect("initial_shared_version is missing"),
                            ));
                            let mutable = bool::from_value(
                                vm,
                                inner_data
                                    .lookup_field(vm, "mutable")
                                    .expect("mutable is missing"),
                            );
                            WObjectArg(ObjectArg::SharedObject {
                                id,
                                initial_shared_version,
                                mutable,
                            })
                        }
                        _ => panic!("shared_object is not a data variant"),
                    }
                }
                2 => {
                    // A Move object that can be received in this transaction.
                    let (object_id, sequence_number, object_digest) =
                        <(WSuiAddress, u64, WDigest)>::from_value(
                            vm,
                            data.get_variant(0).expect("object_ref is missing"),
                        );
                    WObjectArg(ObjectArg::Receiving((
                        object_id.0.into(),
                        SequenceNumber::from_u64(sequence_number),
                        ObjectDigest::new(object_digest.0.into_inner()),
                    )))
                }
                _ => panic!("ValueRef has a wrong tag: {}", data.tag()),
            },
            _ => panic!("ValueRef is not a lancer.transaction.builder.types.Argument"),
        }
    }
}

impl<'vm> Pushable<'vm> for WObjectArg {
    fn vm_push(self, context: &mut vm::api::ActiveThread<'vm>) -> vm::Result<()> {
        match self.0 {
            ObjectArg::ImmOrOwnedObject((id, version, digest)) => {
                (
                    WSuiAddress(id.into()),
                    version.value(),
                    WDigest(Digest::new(digest.into_inner())),
                )
                    .vm_push(context)?;
                context.context().push_new_data(0, 1)?;
            }
            ObjectArg::SharedObject {
                id,
                initial_shared_version,
                mutable,
            } => {
                WSuiAddress(id.into()).vm_push(context)?;
                initial_shared_version.value().vm_push(context)?;
                mutable.vm_push(context)?;
                let vm = context.thread();
                context.context().push_new_record(
                    3,
                    &["id", "initial_shared_version", "mutable"]
                        .into_iter()
                        .map(|s| vm.global_env().intern(s))
                        .collect::<vm::Result<Vec<_>>>()?,
                )?;
                context.context().push_new_data(1, 1)?;
            }
            ObjectArg::Receiving((id, version, digest)) => {
                (
                    WSuiAddress(id.into()),
                    version.value(),
                    WDigest(Digest::new(digest.into_inner())),
                )
                    .vm_push(context)?;
                context.context().push_new_data(2, 1)?;
            }
        }
        Ok(())
    }
}
