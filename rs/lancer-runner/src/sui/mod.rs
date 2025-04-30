use fastcrypto::encoding::{Base58, Encoding, Hex};
use gluon::{
    Thread,
    import::{add_extern_module, add_extern_module_with_deps},
    primitive, record,
    vm::{
        self, ExternModule,
        api::{Collect, Getable, Pushable, ValueRef},
        impl_getable_simple,
    },
};
use gluon_codegen::{Trace, Userdata, VmType};
use serde::Serialize;
use std::{fmt, ops::Deref, str::FromStr};
use sui_move_build::{BuildConfig, CompiledPackage};
use sui_types::{
    base_types::{ObjectID, SuiAddress},
    digests::Digest,
};
type ExecResult<T> = std::result::Result<T, String>;

pub mod types;
pub mod object;

#[derive(Debug, Clone, VmType, PartialEq, Eq)]
#[gluon(vm_type = "lancer.sui.prim.digest.Digest")]
pub struct WDigest(pub Digest);

impl<'vm, 'value> Getable<'vm, 'value> for WDigest {
    impl_getable_simple!();

    fn from_value(vm: &'vm Thread, value: vm::Variants<'value>) -> Self {
        match value.as_ref() {
            ValueRef::Array(data) => Self(Digest::new(
                data.iter()
                    .map(|v| u8::from_value(vm, v))
                    .collect::<Vec<u8>>()
                    .try_into()
                    .unwrap(),
            )),
            _ => panic!("ValueRef is not a lancer.sui.Digest"),
        }
    }
}

impl<'vm> Pushable<'vm> for WDigest {
    fn vm_push(self, context: &mut vm::api::ActiveThread<'vm>) -> vm::Result<()> {
        context
            .context()
            .push_new_alloc(self.0.inner().as_slice())?;
        Ok(())
    }
}

impl Deref for WDigest {
    type Target = Digest;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

impl WDigest {
    fn from_str(s: &str) -> Result<Self, String> {
        match Base58::decode(s) {
            Ok(buffer) => {
                if buffer.len() != 32 {
                    return Err("Invalid digest length. Expected 32 bytes".to_string());
                }
                Ok(WDigest(Digest::new(buffer.try_into().unwrap())))
            }
            Err(err) => Err(err.to_string()),
        }
    }

    fn to_string(self) -> String {
        self.0.to_string()
    }
}

#[derive(Debug, Clone, VmType, PartialEq, Eq, Serialize, PartialOrd, Ord)]
#[gluon(vm_type = "lancer.sui.prim.sui_address.SuiAddress")]
#[serde(transparent)]
pub struct WSuiAddress(pub SuiAddress);

impl<'vm, 'value> Getable<'vm, 'value> for WSuiAddress {
    impl_getable_simple!();

    fn from_value(vm: &'vm Thread, value: vm::Variants<'value>) -> Self {
        match value.as_ref() {
            ValueRef::Array(data) => Self(
                SuiAddress::from_bytes(
                    &data
                        .iter()
                        .map(|v| u8::from_value(vm, v))
                        .collect::<Vec<u8>>(),
                )
                .expect("Invalid SuiAddress"),
            ),
            _ => panic!("ValueRef is not a lancer.sui.SuiAddress"),
        }
    }
}
impl<'vm> Pushable<'vm> for WSuiAddress {
    fn vm_push(self, context: &mut vm::api::ActiveThread<'vm>) -> vm::Result<()> {
        context.context().push_new_alloc(self.0.as_ref())?;
        Ok(())
    }
}
impl Deref for WSuiAddress {
    type Target = SuiAddress;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}
impl WSuiAddress {
    fn from_str(s: &str) -> Result<Self, String> {
        match SuiAddress::from_str(s) {
            Ok(id) => Ok(WSuiAddress(id)),
            Err(err) => Err(err.to_string()),
        }
    }

    fn to_string(self) -> String {
        self.0.to_string()
    }
}

fn load(vm: &Thread) -> vm::Result<vm::ExternModule> {
    ExternModule::new(
        vm,
        record!(
            digest => record!(
                type Digest => WDigest,
                from_string => primitive!(1, "lancer.sui.prim.digest_.from_string", WDigest::from_str),
                to_string => primitive!(1, "lancer.sui.prim.digest.to_string", WDigest::to_string),
                eq => primitive!(2, "lancer.sui.prim.digest.eq", |a: WDigest, b: WDigest| a == b),
            ),
            sui_address => record!(
                type SuiAddress => WSuiAddress,
                from_string => primitive!(1, "lancer.sui.prim.sui_address.from_string", WSuiAddress::from_str),
                to_string => primitive!(1, "lancer.sui.prim.sui_address.to_string", WSuiAddress::to_string),
                eq => primitive!(2, "lancer.sui.prim.sui_address.eq", |a: WSuiAddress, b: WSuiAddress| a == b),
            ),
        ),
    )
}

pub fn install(vm: &Thread) -> vm::Result<()> {
    vm.register_type::<WDigest>("lancer.sui.prim.digest.Digest", &[])?;
    vm.register_type::<WSuiAddress>("lancer.sui.prim.sui_address.SuiAddress", &[])?;

    add_extern_module_with_deps(
        vm,
        "lancer.sui.prim",
        load,
        vec!["std.types".to_string()],
    );

    object::install(vm)?;

    Ok(())
}
