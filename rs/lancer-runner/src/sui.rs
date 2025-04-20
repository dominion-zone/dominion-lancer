use gluon::{
    Thread,
    import::add_extern_module,
    primitive, record,
    vm::{
        self, ExternModule,
        api::{Collect, Getable, IO, Pushable, ValueRef},
        impl_getable_simple,
    },
};
use gluon_codegen::{Trace, Userdata, VmType};
use std::{fmt, ops::Deref, str::FromStr};
use sui_move_build::{BuildConfig, CompiledPackage};
use sui_types::{base_types::{ObjectID, SuiAddress}, digests::Digest};
use fastcrypto::encoding::{Base58, Encoding, Hex};
type ExecResult<T> = std::result::Result<T, String>;

#[derive(Debug, Clone, VmType)]
#[gluon(vm_type = "lancer.sui.prim.object_id.ObjectID")]
pub struct WObjectId(pub ObjectID);

impl<'vm, 'value> Getable<'vm, 'value> for WObjectId {
    impl_getable_simple!();

    fn from_value(vm: &'vm Thread, value: vm::Variants<'value>) -> Self {
        match value.as_ref() {
            ValueRef::Array(data) => Self(ObjectID::new(
                data.iter()
                    .map(|v| u8::from_value(vm, v))
                    .collect::<Vec<u8>>()
                    .try_into()
                    .unwrap(),
            )),
            _ => panic!("ValueRef is not a lancer.sui.ObjectID"),
        }
    }
}

impl<'vm> Pushable<'vm> for WObjectId {
    fn vm_push(self, context: &mut vm::api::ActiveThread<'vm>) -> vm::Result<()> {
        context.context().push_new_alloc(self.0.as_slice())?;
        Ok(())
    }
}

impl Deref for WObjectId {
    type Target = ObjectID;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

impl WObjectId {
    fn from_str(s: &str) -> IO<Self> {
        match ObjectID::from_str(s) {
            Ok(id) => IO::Value(WObjectId(id)),
            Err(err) => IO::Exception(err.to_string()),
        }
    }

    fn to_string(self) -> String {
        self.0.to_hex_literal()
    }
}

#[derive(Debug, Clone, VmType)]
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
    fn from_str(s: &str) -> IO<Self> {
        match Base58::decode(s) {
            Ok(buffer) => {
                if buffer.len() != 32 {
                    return IO::Exception("Invalid digest length. Expected 32 bytes".to_string());
                }
                IO::Value(WDigest(Digest::new(buffer.try_into().unwrap())))
            }
            Err(err) => {
               IO::Exception(err.to_string())
            }
        }
    }

    fn to_string(self) -> String {
        self.0.to_string()
    }
}

#[derive(Debug, Clone, VmType)]
#[gluon(vm_type = "lancer.sui.prim.sui_address.SuiAddress")]
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
    fn from_str(s: &str) -> IO<Self> {
        match SuiAddress::from_str(s) {
            Ok(id) => IO::Value(WSuiAddress(id)),
            Err(err) => IO::Exception(err.to_string()),
        }
    }

    fn to_string(self) -> String {
        self.0.to_string()
    }
}

fn load_sui(vm: &Thread) -> vm::Result<vm::ExternModule> {
    ExternModule::new(
        vm,
        record!(
            object_id => record!(
                type ObjectID => WObjectId,
                from_string => primitive!(1, "lancer.sui.prim.object_id.from_string", WObjectId::from_str),
                to_string => primitive!(1, "lancer.sui.prim.object_id.to_string", WObjectId::to_string),
            ),
            digest => record!(
                type Digest => WDigest,
                from_string => primitive!(1, "lancer.sui.prim.digest_.from_string", WDigest::from_str),
                to_string => primitive!(1, "lancer.sui.prim.digest.to_string", WDigest::to_string),
            ),
            sui_address => record!(
                type SuiAddress => WSuiAddress,
                from_string => primitive!(1, "lancer.sui.prim.sui_address.from_string", WSuiAddress::from_str),
                to_string => primitive!(1, "lancer.sui.prim.sui_address.to_string", WSuiAddress::to_string),
            ),
        ),
    )
}

pub fn install_sui(vm: &Thread) -> vm::Result<()> {
    vm.register_type::<WObjectId>("lancer.sui.prim.object_id.ObjectID", &[])?;
    vm.register_type::<WDigest>("lancer.sui.prim.digest.Digest", &[])?;
    vm.register_type::<WSuiAddress>("lancer.sui.prim.sui_address.SuiAddress", &[])?;

    add_extern_module(vm, "lancer.sui.prim", load_sui);
    Ok(())
}
