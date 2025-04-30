use std::{collections::BTreeMap, fmt::Debug, str::FromStr, sync::Arc};

use crate::rpc::WOwner;
use gluon::{
    Thread, ThreadExt,
    base::types::ArcType,
    import::{add_extern_module, add_extern_module_with_deps},
    primitive, record,
    vm::{
        self, ExternModule,
        api::{Collect, Getable, Pushable, ValueRef, VmType},
        impl_getable_simple,
    },
};
use gluon_codegen::{Trace, Userdata, VmType};
use move_core_types::language_storage::StructTag;
use sui_types::{
    base_types::{ObjectID, ObjectInfo, ObjectType, SequenceNumber},
    digests::{Digest, ObjectDigest, TransactionDigest},
    move_package::{MovePackage, TypeOrigin, UpgradeInfo},
    object::{Data as ObjectData, MoveObject, Object, ObjectInner},
};

use super::{
    WDigest, WSuiAddress,
    types::{WStructTag, WTypeTag},
};

pub struct WMoveObject(pub MoveObject);

impl VmType for WMoveObject {
    type Type = Self;
    fn make_type(vm: &Thread) -> ArcType {
        vm.find_type_info("lancer.sui.object.types.MoveObject")
            .unwrap()
            .clone()
            .into_type()
    }
}

impl<'vm, 'value> Getable<'vm, 'value> for WMoveObject {
    impl_getable_simple!();

    fn from_value(vm: &'vm Thread, value: vm::Variants<'value>) -> Self {
        match value.as_ref() {
            ValueRef::Data(data) => {
                let type_ = WStructTag::from_value(
                    vm,
                    data.lookup_field(vm, "type_")
                        .expect("type_ field not found"),
                );
                let version = SequenceNumber::from_u64(u64::from_value(
                    vm,
                    data.lookup_field(vm, "version")
                        .expect("version field not found"),
                ));
                let contents = Vec::<u8>::from_value(
                    vm,
                    data.lookup_field(vm, "contents")
                        .expect("contents field not found"),
                );
                Self(
                    unsafe {
                        MoveObject::new_from_execution_with_limit(
                            type_.0.into(),
                            true, // for historical reasons
                            version,
                            contents.into(),
                            u64::MAX,
                        )
                    }
                    .unwrap(),
                )
            }
            _ => panic!("ValueRef is not a lancer.sui.object.types.MoveObject"),
        }
    }
}

impl<'vm> Pushable<'vm> for WMoveObject {
    fn vm_push(self, context: &mut vm::api::ActiveThread<'vm>) -> vm::Result<()> {
        WStructTag(self.0.type_().clone().into()).vm_push(context)?;
        self.0.version().value().vm_push(context)?;
        self.0.contents().vm_push(context)?;
        let env = context.thread().global_env();
        context.context().push_new_record(
            3,
            &["type_", "version", "contents"]
                .into_iter()
                .map(|s| env.intern(s))
                .collect::<vm::Result<Vec<_>>>()?,
        )?;
        Ok(())
    }
}

/*
    pub module_name: String,
    pub datatype_name: String,
    pub package: ObjectID,
*/
pub struct WTypeOrigin(pub TypeOrigin);

impl VmType for WTypeOrigin {
    type Type = Self;
    fn make_type(vm: &Thread) -> ArcType {
        vm.find_type_info("lancer.sui.object.types.TypeOrigin")
            .unwrap()
            .clone()
            .into_type()
    }
}

impl<'vm, 'value> Getable<'vm, 'value> for WTypeOrigin {
    impl_getable_simple!();

    fn from_value(vm: &'vm Thread, value: vm::Variants<'value>) -> Self {
        match value.as_ref() {
            ValueRef::Data(data) => {
                let module_name = String::from_value(
                    vm,
                    data.lookup_field(vm, "module_name")
                        .expect("module_name field not found"),
                );
                let datatype_name = String::from_value(
                    vm,
                    data.lookup_field(vm, "datatype_name")
                        .expect("datatype_name field not found"),
                );
                let package = WSuiAddress::from_value(
                    vm,
                    data.lookup_field(vm, "package")
                        .expect("package field not found"),
                )
                .0;
                Self(TypeOrigin {
                    module_name,
                    datatype_name,
                    package: package.into(),
                })
            }
            _ => panic!("ValueRef is not a lancer.sui.object.types.TypeOrigin"),
        }
    }
}

impl<'vm> Pushable<'vm> for WTypeOrigin {
    fn vm_push(self, context: &mut vm::api::ActiveThread<'vm>) -> vm::Result<()> {
        self.0.module_name.vm_push(context)?;
        self.0.datatype_name.vm_push(context)?;
        self.0.package.as_ref().vm_push(context)?;
        let env = context.thread().global_env();
        context.context().push_new_record(
            3,
            &["module_name", "datatype_name", "package"]
                .into_iter()
                .map(|s| env.intern(s))
                .collect::<vm::Result<Vec<_>>>()?,
        )?;
        Ok(())
    }
}
/*
    /// ID of the upgraded packages
    pub upgraded_id: ObjectID,
    /// Version of the upgraded package
    pub upgraded_version: SequenceNumber,
*/
pub struct WUpgradeInfo(pub UpgradeInfo);

impl VmType for WUpgradeInfo {
    type Type = Self;
    fn make_type(vm: &Thread) -> ArcType {
        vm.find_type_info("lancer.sui.object.types.UpgradeInfo")
            .unwrap()
            .clone()
            .into_type()
    }
}

impl<'vm, 'value> Getable<'vm, 'value> for WUpgradeInfo {
    impl_getable_simple!();

    fn from_value(vm: &'vm Thread, value: vm::Variants<'value>) -> Self {
        match value.as_ref() {
            ValueRef::Data(data) => {
                let upgraded_id = WSuiAddress::from_value(
                    vm,
                    data.lookup_field(vm, "upgraded_id")
                        .expect("upgraded_id field not found"),
                )
                .0;
                let upgraded_version = SequenceNumber::from_u64(u64::from_value(
                    vm,
                    data.lookup_field(vm, "upgraded_version")
                        .expect("upgraded_version field not found"),
                ));
                Self(UpgradeInfo {
                    upgraded_id: upgraded_id.into(),
                    upgraded_version,
                })
            }
            _ => panic!("ValueRef is not a lancer.sui.object.types.UpgradeInfo"),
        }
    }
}

impl<'vm> Pushable<'vm> for WUpgradeInfo {
    fn vm_push(self, context: &mut vm::api::ActiveThread<'vm>) -> vm::Result<()> {
        self.0.upgraded_id.as_ref().vm_push(context)?;
        self.0.upgraded_version.value().vm_push(context)?;
        let env = context.thread().global_env();
        context.context().push_new_record(
            2,
            &["upgraded_id", "upgraded_version"]
                .into_iter()
                .map(|s| env.intern(s))
                .collect::<vm::Result<Vec<_>>>()?,
        )?;
        Ok(())
    }
}

/*
    id: ObjectID,
    version: SequenceNumber,
    // TODO use session cache
    module_map: BTreeMap<String, Vec<u8>>,

    /// Maps struct/module to a package version where it was first defined, stored as a vector for
    /// simple serialization and deserialization.
    type_origin_table: Vec<TypeOrigin>,

    // For each dependency, maps original package ID to the info about the (upgraded) dependency
    // version that this package is using
    linkage_table: BTreeMap<ObjectID, UpgradeInfo>,
*/
pub struct WMovePackage(pub MovePackage);

impl VmType for WMovePackage {
    type Type = Self;
    fn make_type(vm: &Thread) -> ArcType {
        vm.find_type_info("lancer.sui.object.types.MovePackage")
            .unwrap()
            .clone()
            .into_type()
    }
}

impl<'vm, 'value> Getable<'vm, 'value> for WMovePackage {
    impl_getable_simple!();

    fn from_value(vm: &'vm Thread, value: vm::Variants<'value>) -> Self {
        match value.as_ref() {
            ValueRef::Data(data) => {
                let id = WSuiAddress::from_value(
                    vm,
                    data.lookup_field(vm, "id").expect("id field not found"),
                )
                .0;
                let version = SequenceNumber::from_u64(u64::from_value(
                    vm,
                    data.lookup_field(vm, "version")
                        .expect("version field not found"),
                ));
                let module_map = BTreeMap::<String, Vec<u8>>::from_value(
                    vm,
                    data.lookup_field(vm, "module_map")
                        .expect("module_map field not found"),
                );
                let type_origin_table = Vec::<WTypeOrigin>::from_value(
                    vm,
                    data.lookup_field(vm, "type_origin_table")
                        .expect("type_origin_table field not found"),
                );
                let linkage_table = BTreeMap::<String, WUpgradeInfo>::from_value(
                    vm,
                    data.lookup_field(vm, "linkage_table")
                        .expect("linkage_table field not found"),
                );
                Self(
                    MovePackage::new(
                        id.into(),
                        version,
                        module_map,
                        u64::MAX,
                        type_origin_table.into_iter().map(|x| x.0).collect(),
                        linkage_table
                            .into_iter()
                            .map(|(k, v)| (ObjectID::from_str(&k).unwrap(), v.0))
                            .collect(),
                    )
                    .unwrap(),
                )
            }
            _ => panic!("ValueRef is not a lancer.sui.object.types.MovePackage"),
        }
    }
}

impl<'vm> Pushable<'vm> for WMovePackage {
    fn vm_push(self, context: &mut vm::api::ActiveThread<'vm>) -> vm::Result<()> {
        self.0.id().as_ref().vm_push(context)?;
        self.0.version().value().vm_push(context)?;
        self.0.serialized_module_map().clone().vm_push(context)?;
        self.0
            .type_origin_table()
            .iter()
            .map(|v| WTypeOrigin(v.clone()))
            .collect::<Vec<_>>()
            .vm_push(context)?;
        self.0
            .linkage_table()
            .iter()
            .map(|(k, v)| (k.to_string(), WUpgradeInfo(v.clone())))
            .collect::<BTreeMap<_, _>>()
            .vm_push(context)?;

        let env = context.thread().global_env();
        context.context().push_new_record(
            5,
            &[
                "id",
                "version",
                "module_map",
                "type_origin_table",
                "linkage_table",
            ]
            .into_iter()
            .map(|s| env.intern(s))
            .collect::<vm::Result<Vec<_>>>()?,
        )?;
        Ok(())
    }
}

pub struct WObjectData(pub ObjectData);

impl VmType for WObjectData {
    type Type = Self;
    fn make_type(vm: &Thread) -> ArcType {
        vm.find_type_info("lancer.sui.object.types.ObjectData")
            .unwrap()
            .clone()
            .into_type()
    }
}

impl<'vm, 'value> Getable<'vm, 'value> for WObjectData {
    impl_getable_simple!();

    fn from_value(vm: &'vm Thread, value: vm::Variants<'value>) -> Self {
        match value.as_ref() {
            ValueRef::Data(data) => match data.tag() {
                0 => Self(ObjectData::Move(
                    WMoveObject::from_value(vm, data.get_variant(0).unwrap()).0,
                )),
                1 => Self(ObjectData::Package(
                    WMovePackage::from_value(vm, data.get_variant(0).unwrap()).0,
                )),
                _ => panic!("Unknown ObjectData variant"),
            },
            _ => panic!("ValueRef is not a lancer.sui.object.types.ObjectData"),
        }
    }
}

impl<'vm> Pushable<'vm> for WObjectData {
    fn vm_push(self, context: &mut vm::api::ActiveThread<'vm>) -> vm::Result<()> {
        match self.0 {
            ObjectData::Move(move_object) => {
                WMoveObject(move_object).vm_push(context)?;
                context.context().push_new_data(0, 1)?;
            }
            ObjectData::Package(move_package) => {
                WMovePackage(move_package).vm_push(context)?;
                context.context().push_new_data(1, 1)?;
            }
        }
        Ok(())
    }
}

pub struct WObject(pub Arc<Object>);

impl VmType for WObject {
    type Type = Self;
    fn make_type(vm: &Thread) -> ArcType {
        vm.find_type_info("lancer.sui.object.types.Object")
            .unwrap()
            .clone()
            .into_type()
    }
}

impl<'vm, 'value> Getable<'vm, 'value> for WObject {
    impl_getable_simple!();

    fn from_value(vm: &'vm Thread, value: vm::Variants<'value>) -> Self {
        match value.as_ref() {
            ValueRef::Data(data) => {
                let object_data = WObjectData::from_value(
                    vm,
                    data.lookup_field(vm, "data").expect("data field not found"),
                )
                .0;
                let owner = WOwner::from_value(
                    vm,
                    data.lookup_field(vm, "owner")
                        .expect("owner field not found"),
                )
                .0;
                let previous_transaction = TransactionDigest::new(
                    WDigest::from_value(
                        vm,
                        data.lookup_field(vm, "previous_transaction")
                            .expect("previous_transaction field not found"),
                    )
                    .0
                    .into_inner(),
                );
                let storage_rebate = u64::from_value(
                    vm,
                    data.lookup_field(vm, "storage_rebate")
                        .expect("storage_rebate field not found"),
                );

                Self(Arc::new(
                    ObjectInner {
                        data: object_data,
                        owner,
                        previous_transaction,
                        storage_rebate,
                    }
                    .into(),
                ))
            }
            _ => panic!("ValueRef is not a lancer.sui.object.types.Object"),
        }
    }
}

impl<'vm> Pushable<'vm> for WObject {
    fn vm_push(self, context: &mut vm::api::ActiveThread<'vm>) -> vm::Result<()> {
        WObjectData(self.0.data.clone()).vm_push(context)?;
        WOwner(self.0.owner().clone()).vm_push(context)?;
        WDigest(Digest::new(self.0.previous_transaction.into_inner())).vm_push(context)?;
        self.0.storage_rebate.vm_push(context)?;
        let env = context.thread().global_env();
        context.context().push_new_record(
            4,
            &["data", "owner", "previous_transaction", "storage_rebate"]
                .into_iter()
                .map(|s| env.intern(s))
                .collect::<vm::Result<Vec<_>>>()?,
        )?;
        Ok(())
    }
}

#[derive(Clone, Trace, Userdata, VmType)]
#[gluon(vm_type = "lancer.sui.object.prim.ObjectPtr")]
#[gluon_trace(skip)]
#[gluon_userdata(clone)]
pub struct ObjectPtr(pub Arc<Object>);

impl Debug for ObjectPtr {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        self.0.fmt(f)
    }
}

impl ObjectPtr {
    pub fn serialize(&self) -> Result<serde_json::Value, String> {
        serde_json::to_value(self.0.as_ref()).map_err(|e| e.to_string())
    }

    pub fn show(&self) -> String {
        format!("{:?}", self.0.as_ref())
    }

    pub fn inner(&self) -> WObject {
        WObject(self.0.clone())
    }

    pub fn from_inner(object: WObject) -> Self {
        Self(object.0.clone())
    }

    pub fn id(&self) -> WSuiAddress {
        WSuiAddress(self.0.id().into())
    }

    pub fn is_package(&self) -> bool {
        self.0.is_package()
    }

    pub fn struct_tag(&self) -> Option<WStructTag> {
        self.0.struct_tag().map(|x| WStructTag(x))
    }

    pub fn owner(&self) -> WOwner {
        WOwner(self.0.owner().clone())
    }
}

impl From<ObjectPtr> for WObject {
    fn from(object: ObjectPtr) -> Self {
        WObject(object.0.clone())
    }
}

impl From<WObject> for ObjectPtr {
    fn from(object: WObject) -> Self {
        ObjectPtr(object.0.clone())
    }
}

/*
pub enum ObjectType {
    /// Move package containing one or more bytecode modules
    Package,
    /// A Move struct of the given type
    Struct(MoveObjectType),
}
*/
pub struct WObjectType(pub ObjectType);

impl VmType for WObjectType {
    type Type = Self;
    fn make_type(vm: &Thread) -> ArcType {
        vm.find_type_info("lancer.sui.object.types.ObjectType")
            .unwrap()
            .clone()
            .into_type()
    }
}

impl<'vm, 'value> Getable<'vm, 'value> for WObjectType {
    impl_getable_simple!();

    fn from_value(vm: &'vm Thread, value: vm::Variants<'value>) -> Self {
        match value.as_ref() {
            ValueRef::Data(data) => match data.tag() {
                0 => return Self(ObjectType::Package),
                1 => {
                    let type_ =
                        WStructTag::from_value(vm, data.get_variant(0).expect("type not found"));
                    Self(ObjectType::Struct(type_.0.into()))
                }
                _ => panic!("Unknown ObjectType variant"),
            },
            _ => panic!("ValueRef is not a lancer.sui.object.types.ObjectType"),
        }
    }
}

impl<'vm> Pushable<'vm> for WObjectType {
    fn vm_push(self, context: &mut vm::api::ActiveThread<'vm>) -> vm::Result<()> {
        match self.0 {
            ObjectType::Package => {
                context.context().push_new_data(0, 0)?;
            }
            ObjectType::Struct(type_) => {
                WStructTag(type_.into()).vm_push(context)?;
                context.context().push_new_data(1, 1)?;
            }
        }
        Ok(())
    }
}

/*
pub struct ObjectInfo {
    pub object_id: ObjectID,
    pub version: SequenceNumber,
    pub digest: ObjectDigest,
    pub type_: ObjectType,
    pub owner: Owner,
    pub previous_transaction: TransactionDigest,
}
*/
pub struct WObjectInfo(pub ObjectInfo);

impl WObjectInfo {
    pub fn serialize(self) -> Result<serde_json::Value, String> {
        serde_json::to_value(self.0).map_err(|e| e.to_string())
    }
}

impl VmType for WObjectInfo {
    type Type = Self;
    fn make_type(vm: &Thread) -> ArcType {
        vm.find_type_info("lancer.sui.object.types.ObjectInfo")
            .unwrap()
            .clone()
            .into_type()
    }
}

impl<'vm, 'value> Getable<'vm, 'value> for WObjectInfo {
    impl_getable_simple!();

    fn from_value(vm: &'vm Thread, value: vm::Variants<'value>) -> Self {
        match value.as_ref() {
            ValueRef::Data(data) => {
                let object_id = WSuiAddress::from_value(
                    vm,
                    data.lookup_field(vm, "object_id")
                        .expect("object_id field not found"),
                )
                .0;
                let version = SequenceNumber::from_u64(u64::from_value(
                    vm,
                    data.lookup_field(vm, "version")
                        .expect("version field not found"),
                ));
                let digest = ObjectDigest::new(
                    WDigest::from_value(
                        vm,
                        data.lookup_field(vm, "digest")
                            .expect("digest field not found"),
                    )
                    .0
                    .into_inner(),
                );
                let type_ = WObjectType::from_value(
                    vm,
                    data.lookup_field(vm, "type_")
                        .expect("type_ field not found"),
                )
                .0;
                let owner = WOwner::from_value(
                    vm,
                    data.lookup_field(vm, "owner")
                        .expect("owner field not found"),
                )
                .0;
                let previous_transaction = TransactionDigest::new(
                    WDigest::from_value(
                        vm,
                        data.lookup_field(vm, "previous_transaction")
                            .expect("previous_transaction field not found"),
                    )
                    .0
                    .into_inner(),
                );
                Self(ObjectInfo {
                    object_id: object_id.into(),
                    version,
                    digest,
                    type_,
                    owner,
                    previous_transaction,
                })
            }
            _ => panic!("ValueRef is not a lancer.sui.object.types.ObjectInfo"),
        }
    }
}

impl<'vm> Pushable<'vm> for WObjectInfo {
    fn vm_push(self, context: &mut vm::api::ActiveThread<'vm>) -> vm::Result<()> {
        self.0.object_id.as_ref().vm_push(context)?;
        self.0.version.value().vm_push(context)?;
        WDigest(Digest::new(self.0.digest.into_inner())).vm_push(context)?;
        WObjectType(self.0.type_.clone()).vm_push(context)?;
        WOwner(self.0.owner.clone()).vm_push(context)?;
        WDigest(Digest::new(self.0.previous_transaction.into_inner())).vm_push(context)?;
        let env = context.thread().global_env();
        context.context().push_new_record(
            6,
            &[
                "object_id",
                "version",
                "digest",
                "type_",
                "owner",
                "previous_transaction",
            ]
            .into_iter()
            .map(|s| env.intern(s))
            .collect::<vm::Result<Vec<_>>>()?,
        )?;
        Ok(())
    }
}

fn load(vm: &Thread) -> vm::Result<vm::ExternModule> {
    ExternModule::new(
        vm,
        record!(
            type ObjectPtr => ObjectPtr,
            serialize_object => primitive!(
                1,
                "lancer.sui.object.prim.serialize_object",
                ObjectPtr::serialize),
            show_object => primitive!(
                1,
                "lancer.sui.object.prim.show_object",
                ObjectPtr::show),
            inner_object => primitive!(
                1,
                "lancer.sui.object.prim.inner_object",
                ObjectPtr::inner),
            from_inner_object => primitive!(
                1,
                "lancer.sui.object.prim.from_inner_object",
                ObjectPtr::from_inner),
            serialize_object_info => primitive!(
                1,
                "lancer.sui.object.prim.serialize_object_info",
                WObjectInfo::serialize),
            object_id => primitive!(
                1,
                "lancer.sui.object.prim.object_id",
                ObjectPtr::id),
            object_is_package => primitive!(
                1,
                "lancer.sui.object.prim.object_is_package",
                ObjectPtr::is_package),
            object_struct_tag => primitive!(
                1,
                "lancer.sui.object.prim.object_struct_tag",
                ObjectPtr::struct_tag),
            object_owner => primitive!(
                1,
                "lancer.sui.object.prim.object_owner",
                ObjectPtr::owner),
        ),
    )
}

pub fn install(vm: &Thread) -> vm::Result<()> {
    vm.register_type::<ObjectPtr>("lancer.sui.object.prim.ObjectPtr", &[])?;
    add_extern_module_with_deps(
        vm,
        "lancer.sui.object.prim",
        load,
        vec![
            "std.json".to_string(),
            "lancer.sui.object.types".to_string(),
        ],
    );
    Ok(())
}
