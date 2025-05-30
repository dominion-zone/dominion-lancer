use std::{str::FromStr, sync::Arc};

use crate::sui::{WDigest, WSuiAddress, object::ObjectPtr, types::WStructTag};
use gluon::{
    base::types::ArcType, import::add_extern_module_with_deps, primitive, record, vm::{
        self,
        api::{Getable, Pushable, ValueRef, VmType},
        impl_getable_simple, ExternModule,
    }, Thread
};
use gluon_codegen::{Trace, Userdata, VmType};
use move_core_types::language_storage::StructTag;
use sui_json_rpc_types::{Coin, SuiObjectData};
use sui_types::{
    base_types::{ObjectID, SequenceNumber},
    digests::{Digest, ObjectDigest},
    transaction::ObjectArg,
};
use sui_types::{digests::TransactionDigest, object::Object};

#[derive(Debug, Clone, Trace, Userdata, VmType)]
#[gluon(vm_type = "lancer.rpc.object.prim.RpcObjectPtr")]
#[gluon_trace(skip)]
#[gluon_userdata(clone)]
pub struct RpcObjectPtr(pub SuiObjectData);

impl RpcObjectPtr {
    pub fn new(data: SuiObjectData) -> Self {
        Self(data)
    }

    pub fn serialize(&self) -> Result<serde_json::Value, String> {
        serde_json::to_value(&self.0)
            .map_err(|e| e.to_string())
    }

    pub fn deserialize(value: serde_json::Value) -> Result<Self, String> {
        serde_json::from_value(value)
            .map_err(|e| e.to_string())
            .map(Self)
    }

    pub fn to_object(&self) -> Result<ObjectPtr, String> {
        Ok(ObjectPtr(Arc::new(
            TryInto::<Object>::try_into(self.0.clone()).map_err(|e| e.to_string())?,
        )))
    }
}

fn load(vm: &Thread) -> vm::Result<vm::ExternModule> {
    ExternModule::new(
        vm,
        record!(
            type RpcObjectPtr => RpcObjectPtr,
            serialize_object => primitive!(
                1,
                "lancer.rpc.object.prim.serialize_object",
                RpcObjectPtr::serialize),
            deserialize_object => primitive!(
                1,
                "lancer.rpc.object.prim.deserialize_object",
                RpcObjectPtr::deserialize),
            to_object => primitive!(
                1,
                "lancer.rpc.object.prim.to_object",
                RpcObjectPtr::to_object
            )
        ),
    )
}

pub fn install(vm: &Thread) -> vm::Result<()> {
    vm.register_type::<RpcObjectPtr>("lancer.rpc.object.prim.RpcObjectPtr", &[])?;
    add_extern_module_with_deps(
        vm,
        "lancer.rpc.object.prim",
        load,
        vec![
            "std.json".to_string(),
        ],
    );
    Ok(())
}
