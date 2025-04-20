use gluon::{
    Thread, ThreadExt,
    base::types::ArcType,
    import::{add_extern_module, add_extern_module_with_deps},
    primitive, record,
    vm::{
        self, ExternModule,
        api::{Collect, Getable, IO, Pushable, ValueRef, VmType},
        impl_getable_simple,
    },
};
use gluon_codegen::{Trace, Userdata, VmType};
use move_core_types::language_storage::StructTag;
use std::{fmt, ops::Deref, str::FromStr};
use sui_json_rpc_types::{ObjectChange, SuiTransactionBlockResponse};
use sui_move_build::{BuildConfig, CompiledPackage};
use sui_types::{
    Identifier, TypeTag,
    base_types::{ObjectID, SequenceNumber},
    digests::{Digest, ObjectDigest},
    object::{self, Owner},
};
use sui_types::{digests::TransactionDigest, object::Authenticator};

use crate::sui::{WDigest, WObjectId, WSuiAddress};

#[derive(Debug, Clone)]
pub struct WTypeTag(pub TypeTag);

impl VmType for WTypeTag {
    type Type = Self;
    fn make_type(vm: &Thread) -> ArcType {
        vm.find_type_info("lancer.rpc.types.TypeTag")
            .unwrap()
            .clone()
            .into_type()
    }
}
impl<'vm, 'value> Getable<'vm, 'value> for WTypeTag {
    impl_getable_simple!();

    fn from_value(vm: &'vm Thread, value: vm::Variants<'value>) -> Self {
        match value.as_ref() {
            ValueRef::Data(data) => Self(match data.tag() {
                0 => TypeTag::Bool,
                1 => TypeTag::U8,
                2 => TypeTag::U64,
                3 => TypeTag::U128,
                4 => TypeTag::Address,
                5 => TypeTag::Signer,
                6 => TypeTag::Vector(Box::new(
                    WTypeTag::from_value(vm, data.get_variant(0).unwrap()).0,
                )),
                7 => TypeTag::Struct(Box::new(WStructTag::from_value(
                    vm,
                    data.get_variant(0).unwrap(),
                ).0)),
                8 => TypeTag::U16,
                9 => TypeTag::U32,
                10 => TypeTag::U256,
                _ => panic!("ValueRef has a wrong tag: {}", data.tag()),
            }),
            _ => panic!("ValueRef is not a lancer.rpc.Owner"),
        }
    }
}
impl<'vm> Pushable<'vm> for WTypeTag {
    fn vm_push(self, context: &mut vm::api::ActiveThread<'vm>) -> vm::Result<()> {
        match self.0 {
            TypeTag::Bool => {
                context.context().push_new_data(0, 0)?;
            }
            TypeTag::U8 => {
                context.context().push_new_data(1, 0)?;
            }
            TypeTag::U64 => {
                context.context().push_new_data(2, 0)?;
            }
            TypeTag::U128 => {
                context.context().push_new_data(3, 0)?;
            }
            TypeTag::Address => {
                context.context().push_new_data(4, 0)?;
            }
            TypeTag::Signer => {
                context.context().push_new_data(5, 0)?;
            }
            TypeTag::Vector(type_tag) => {
                WTypeTag(*type_tag).vm_push(context)?;
                context.context().push_new_data(6, 1)?;
            }
            TypeTag::Struct(struct_tag) => {
                WStructTag(*struct_tag).vm_push(context)?;
                context.context().push_new_data(7, 1)?;
            }
            TypeTag::U16 => {
                context.context().push_new_data(8, 0)?;
            }
            TypeTag::U32 => {
                context.context().push_new_data(9, 0)?;
            }
            TypeTag::U256 => {
                context.context().push_new_data(10, 0)?;
            }
        }
        Ok(())
    }
}

impl Deref for WTypeTag {
    type Target = TypeTag;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

#[derive(Debug, Clone)]
pub struct WStructTag(pub StructTag);

impl VmType for WStructTag {
    type Type = Self;
    fn make_type(vm: &Thread) -> ArcType {
        vm.find_type_info("lancer.rpc.types.StructTag")
            .unwrap()
            .clone()
            .into_type()
    }
}
impl<'vm, 'value> Getable<'vm, 'value> for WStructTag {
    impl_getable_simple!();

    fn from_value(vm: &'vm Thread, value: vm::Variants<'value>) -> Self {
        match value.as_ref() {
            ValueRef::Data(data) => {
                let address = WSuiAddress::from_value(
                    vm,
                    data.lookup_field(vm, "address")
                        .expect("address field not found"),
                )
                .0;
                let module = String::from_value(
                    vm,
                    data.lookup_field(vm, "module")
                        .expect("module field not found"),
                );
                let name = String::from_value(
                    vm,
                    data.lookup_field(vm, "name").expect("name field not found"),
                );
                let type_params = Vec::<WTypeTag>::from_value(
                    vm,
                    data.lookup_field(vm, "type_params")
                        .expect("type_params field not found"),
                );
                Self(StructTag {
                    address: address.into(),
                    module: Identifier::from_str(&module).unwrap(),
                    name: Identifier::from_str(&name).unwrap(),
                    type_params: type_params.into_iter().map(|x| x.0).collect(),
                })
            }
            _ => panic!("ValueRef is not a lancer.rpc.Owner"),
        }
    }
}

impl<'vm> Pushable<'vm> for WStructTag {
    fn vm_push(self, context: &mut vm::api::ActiveThread<'vm>) -> vm::Result<()> {
        WSuiAddress(self.0.address.into()).vm_push(context)?;
        self.0.module.to_string().vm_push(context)?;
        self.0.name.to_string().vm_push(context)?;
        self.0
            .type_params
            .iter()
            .map(|x| WTypeTag(x.clone()))
            .collect::<Vec<_>>()
            .vm_push(context)?;
        let vm = context.thread();
        context.context().push_new_record(
            4,
            &["address", "module", "name", "type_params"]
                .into_iter()
                .map(|s| vm.global_env().intern(s))
                .collect::<vm::Result<Vec<_>>>()?,
        )?;
        Ok(())
    }
}

impl Deref for WStructTag {
    type Target = StructTag;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}