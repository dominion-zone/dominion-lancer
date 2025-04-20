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
use std::{fmt, ops::Deref, str::FromStr};
use sui_json_rpc_types::{ObjectChange, SuiTransactionBlockResponse};
use sui_move_build::{BuildConfig, CompiledPackage};
use sui_types::{
    base_types::{ObjectID, SequenceNumber},
    digests::{Digest, ObjectDigest},
    object::{self, Owner},
};
use sui_types::{digests::TransactionDigest, object::Authenticator};
use types::WStructTag;

use crate::sui::{WDigest, WObjectId, WSuiAddress};

pub mod types;

type ExecResult<T> = std::result::Result<T, String>;

#[derive(Debug, Clone)]
pub struct WTransactionBlockResponse(pub SuiTransactionBlockResponse);

impl VmType for WTransactionBlockResponse {
    type Type = Self;
    fn make_type(vm: &Thread) -> ArcType {
        vm.find_type_info("lancer.rpc.types.TransactionBlockResponse")
            .unwrap()
            .clone()
            .into_type()
    }
}

impl<'vm, 'value> Getable<'vm, 'value> for WTransactionBlockResponse {
    impl_getable_simple!();

    fn from_value(vm: &'vm Thread, value: vm::Variants<'value>) -> Self {
        match value.as_ref() {
            ValueRef::Data(data) => {
                let digest = WDigest::from_value(
                    vm,
                    data.lookup_field(vm, "digest").expect("digest is missing"),
                );
                let raw_transaction = data
                    .lookup_field(vm, "raw_transaction")
                    .map_or(vec![], |f| Vec::<u8>::from_value(vm, f));

                let object_changes = Some(
                    Vec::<WObjectChange>::from_value(
                        vm,
                        data.lookup_field(vm, "object_changes")
                            .expect("object_changes is missing"),
                    )
                    .into_iter()
                    .map(|v| v.0)
                    .collect::<Vec<ObjectChange>>(),
                );
                /*
                /// Transaction input data
                #[serde(skip_serializing_if = "Option::is_none")]
                pub transaction: Option<SuiTransactionBlock>,
                /// BCS encoded [SenderSignedData] that includes input object references
                /// returns empty array if `show_raw_transaction` is false
                #[serde_as(as = "Base64")]
                #[schemars(with = "Base64")]
                #[serde(skip_serializing_if = "Vec::is_empty", default)]
                pub raw_transaction: Vec<u8>,
                #[serde(skip_serializing_if = "Option::is_none")]
                pub effects: Option<SuiTransactionBlockEffects>,
                #[serde(skip_serializing_if = "Option::is_none")]
                pub events: Option<SuiTransactionBlockEvents>,
                #[serde(skip_serializing_if = "Option::is_none")]
                pub object_changes: Option<Vec<ObjectChange>>,
                #[serde(skip_serializing_if = "Option::is_none")]
                pub balance_changes: Option<Vec<BalanceChange>>,
                #[serde(default, skip_serializing_if = "Option::is_none")]
                #[schemars(with = "Option<BigInt<u64>>")]
                #[serde_as(as = "Option<BigInt<u64>>")]
                pub timestamp_ms: Option<u64>,
                #[serde(default, skip_serializing_if = "Option::is_none")]
                pub confirmed_local_execution: Option<bool>,
                /// The checkpoint number when this transaction was included and hence finalized.
                /// This is only returned in the read api, not in the transaction execution api.
                #[schemars(with = "Option<BigInt<u64>>")]
                #[serde_as(as = "Option<BigInt<u64>>")]
                #[serde(skip_serializing_if = "Option::is_none")]
                pub checkpoint: Option<CheckpointSequenceNumber>,
                #[serde(skip_serializing_if = "Vec::is_empty", default)]
                pub errors: Vec<String>,
                #[serde(skip_serializing_if = "Vec::is_empty", default)]
                pub raw_effects
                */
                Self(SuiTransactionBlockResponse {
                    digest: TransactionDigest::new(digest.0.into_inner()),
                    transaction: None,
                    raw_transaction,
                    effects: None,
                    events: None,
                    object_changes,
                    balance_changes: None,
                    timestamp_ms: None,
                    confirmed_local_execution: None,
                    checkpoint: None,
                    errors: vec![],
                    raw_effects: vec![],
                })
            }
            _ => panic!("ValueRef is not a lancer.rpc.TransactionBlockResponse"),
        }
    }
}

impl<'vm> Pushable<'vm> for WTransactionBlockResponse {
    fn vm_push(self, context: &mut vm::api::ActiveThread<'vm>) -> vm::Result<()> {
        WDigest(Digest::from(self.0.digest.into_inner())).vm_push(context)?;
        self.0.raw_transaction.vm_push(context)?;
        self.0
            .object_changes
            .unwrap_or_default()
            .into_iter()
            .map(|c| WObjectChange(c))
            .collect::<Vec<_>>()
            .vm_push(context)?;
        let vm = context.thread();
        context.context().push_new_record(
            3,
            &["digest", "raw_transaction", "object_changes"]
                .into_iter()
                .map(|s| vm.global_env().intern(s))
                .collect::<vm::Result<Vec<_>>>()?,
        )?;
        Ok(())
    }
}

impl Deref for WTransactionBlockResponse {
    type Target = SuiTransactionBlockResponse;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

#[derive(Debug, Clone)]
pub struct WOwner(pub Owner);

impl VmType for WOwner {
    type Type = Self;
    fn make_type(vm: &Thread) -> ArcType {
        vm.find_type_info("lancer.rpc.types.Owner")
            .unwrap()
            .clone()
            .into_type()
    }
}
impl<'vm, 'value> Getable<'vm, 'value> for WOwner {
    impl_getable_simple!();

    fn from_value(vm: &'vm Thread, value: vm::Variants<'value>) -> Self {
        match value.as_ref() {
            ValueRef::Data(data) => Self(match data.tag() {
                0 => {
                    // Object is exclusively owned by a single address, and is mutable.
                    Owner::AddressOwner(WSuiAddress::from_value(vm, data.get_variant(0).unwrap()).0)
                }
                1 => {
                    // Object is exclusively owned by a single object, and is mutable.
                    // The object ID is converted to SuiAddress as SuiAddress is universal.
                    Owner::ObjectOwner(WSuiAddress::from_value(vm, data.get_variant(0).unwrap()).0)
                }
                2 => {
                    // Object is shared, can be used by any address, and is mutable.
                    let inner = data.get_variant(0).unwrap();
                    match inner.as_ref() {
                        ValueRef::Data(data) => {
                            let initial_shared_version = SequenceNumber::from_u64(u64::from_value(
                                vm,
                                data.lookup_field(vm, "initial_shared_version")
                                    .expect("initial_shared_version is missing"),
                            ));
                            Owner::Shared {
                                // The version at which the object became shared
                                initial_shared_version,
                            }
                        }
                        _ => panic!("ValueRef is not a lancer.rpc.Owner"),
                    }
                }
                3 => {
                    // Object is immutable, and hence ownership doesn't matter.
                    Owner::Immutable
                }
                4 => {
                    // Object is sequenced via consensus. Ownership is managed by the configured authenticator.
                    let inner = data.get_variant(0).unwrap();
                    match inner.as_ref() {
                        ValueRef::Data(data) => {
                            let start_version = SequenceNumber::from_u64(u64::from_value(
                                vm,
                                data.lookup_field(vm, "initial_shared_version")
                                    .expect("initial_shared_version is missing"),
                            ));
                            let authenticator = WSuiAddress::from_value(
                                vm,
                                data.lookup_field(vm, "authenticator")
                                    .expect("authenticator is missing"),
                            )
                            .0;
                            Owner::ConsensusV2 {
                                start_version,
                                authenticator: Box::new(Authenticator::SingleOwner(authenticator)),
                            }
                        }
                        _ => panic!("ValueRef is not a lancer.rpc.Owner"),
                    }
                }
                _ => panic!("ValueRef has a wrong tag: {}", data.tag()),
            }),
            _ => panic!("ValueRef is not a lancer.rpc.Owner"),
        }
    }
}
impl<'vm> Pushable<'vm> for WOwner {
    fn vm_push(self, context: &mut vm::api::ActiveThread<'vm>) -> vm::Result<()> {
        match self.0 {
            Owner::AddressOwner(address) => {
                WSuiAddress(address).vm_push(context)?;
                context.context().push_new_data(0, 1)?;
            }
            Owner::ObjectOwner(address) => {
                WSuiAddress(address).vm_push(context)?;
                context.context().push_new_data(1, 1)?;
            }
            Owner::Shared {
                initial_shared_version,
            } => {
                initial_shared_version.value().vm_push(context)?;
                context.context().push_new_data(2, 1)?;
            }
            Owner::Immutable => {
                context.context().push_new_data(3, 0)?;
            }
            Owner::ConsensusV2 {
                start_version,
                authenticator,
            } => {
                start_version.value().vm_push(context)?;
                WSuiAddress(authenticator.as_single_owner().clone()).vm_push(context)?;
                let env = context.thread().global_env();
                context.context().push_new_record(
                    2,
                    &["start_version", "authenticator"]
                        .into_iter()
                        .map(|s| env.intern(s))
                        .collect::<vm::Result<Vec<_>>>()?,
                )?;
                context.context().push_new_data(4, 1)?;
            }
        }
        Ok(())
    }
}

#[derive(Debug, Clone)]
pub struct WObjectChange(ObjectChange);

impl VmType for WObjectChange {
    type Type = Self;
    fn make_type(vm: &Thread) -> ArcType {
        vm.find_type_info("lancer.rpc.types.ObjectChange")
            .unwrap()
            .clone()
            .into_type()
    }
}

impl<'vm, 'value> Getable<'vm, 'value> for WObjectChange {
    impl_getable_simple!();

    fn from_value(vm: &'vm Thread, value: vm::Variants<'value>) -> Self {
        match value.as_ref() {
            ValueRef::Data(data) => {
                let inner = match data.get_variant(0).unwrap().as_ref() {
                    ValueRef::Data(data) => data,
                    _ => panic!("ValueRef is not a lancer.rpc.ObjectChange"),
                };
                Self(match data.tag() {
                    0 => {
                        let package_id = WObjectId::from_value(
                            vm,
                            inner
                                .lookup_field(vm, "package_id")
                                .expect("package_id is missing"),
                        )
                        .0;
                        let version = SequenceNumber::from_u64(u64::from_value(
                            vm,
                            inner
                                .lookup_field(vm, "version")
                                .expect("version is missing"),
                        ));
                        let digest = WDigest::from_value(
                            vm,
                            inner.lookup_field(vm, "digest").expect("digest is missing"),
                        )
                        .0;
                        let modules = Collect::from_value(
                            vm,
                            inner
                                .lookup_field(vm, "modules")
                                .expect("modules is missing"),
                        )
                        .collect();
                        ObjectChange::Published {
                            package_id,
                            version,
                            digest: ObjectDigest::new(digest.into_inner()),
                            modules,
                        }
                    }
                    1 => {
                        let sender = WSuiAddress::from_value(
                            vm,
                            inner.lookup_field(vm, "sender").expect("sender is missing"),
                        )
                        .0;
                        let recipient = WOwner::from_value(
                            vm,
                            inner
                                .lookup_field(vm, "recipient")
                                .expect("recipient is missing"),
                        )
                        .0;
                        let object_type = WStructTag::from_value(
                            vm,
                            inner
                                .lookup_field(vm, "object_type")
                                .expect("object_type is missing"),
                        )
                        .0;
                        let object_id = WObjectId::from_value(
                            vm,
                            inner
                                .lookup_field(vm, "object_id")
                                .expect("object_id is missing"),
                        )
                        .0;
                        let version = SequenceNumber::from_u64(u64::from_value(
                            vm,
                            inner
                                .lookup_field(vm, "version")
                                .expect("version is missing"),
                        ));
                        let digest = ObjectDigest::new(
                            WDigest::from_value(
                                vm,
                                inner.lookup_field(vm, "digest").expect("digest is missing"),
                            )
                            .0
                            .into_inner(),
                        );
                        ObjectChange::Transferred {
                            sender,
                            recipient,
                            object_type,
                            object_id,
                            version,
                            digest,
                        }
                    }
                    2 => {
                        let sender = WSuiAddress::from_value(
                            vm,
                            inner.lookup_field(vm, "sender").expect("sender is missing"),
                        )
                        .0;

                        let owner = WOwner::from_value(
                            vm,
                            inner.lookup_field(vm, "owner").expect("owner is missing"),
                        )
                        .0;
                        let object_type = WStructTag::from_value(
                            vm,
                            inner
                                .lookup_field(vm, "object_type")
                                .expect("object_type is missing"),
                        )
                        .0;
                        let object_id = WObjectId::from_value(
                            vm,
                            inner
                                .lookup_field(vm, "object_id")
                                .expect("object_id is missing"),
                        )
                        .0;
                        let version = SequenceNumber::from_u64(u64::from_value(
                            vm,
                            inner
                                .lookup_field(vm, "version")
                                .expect("version is missing"),
                        ));
                        let previous_version = SequenceNumber::from_u64(u64::from_value(
                            vm,
                            inner
                                .lookup_field(vm, "previous_version")
                                .expect("previous_version is missing"),
                        ));
                        let digest = ObjectDigest::new(
                            WDigest::from_value(
                                vm,
                                inner.lookup_field(vm, "digest").expect("digest is missing"),
                            )
                            .0
                            .into_inner(),
                        );
                        ObjectChange::Mutated {
                            sender,
                            owner,
                            object_type,
                            object_id,
                            version,
                            previous_version,
                            digest,
                        }
                    }
                    3 => {
                        let sender = WSuiAddress::from_value(
                            vm,
                            inner.lookup_field(vm, "sender").expect("sender is missing"),
                        )
                        .0;
                        let object_type = WStructTag::from_value(
                            vm,
                            inner
                                .lookup_field(vm, "object_type")
                                .expect("object_type is missing"),
                        )
                        .0;
                        let object_id = WObjectId::from_value(
                            vm,
                            inner
                                .lookup_field(vm, "object_id")
                                .expect("object_id is missing"),
                        )
                        .0;
                        let version = SequenceNumber::from_u64(u64::from_value(
                            vm,
                            inner
                                .lookup_field(vm, "version")
                                .expect("version is missing"),
                        ));

                        ObjectChange::Deleted {
                            sender,
                            object_type,
                            object_id,
                            version,
                        }
                    }
                    4 => {
                        let sender = WSuiAddress::from_value(
                            vm,
                            inner.lookup_field(vm, "sender").expect("sender is missing"),
                        )
                        .0;
                        let object_type = WStructTag::from_value(
                            vm,
                            inner
                                .lookup_field(vm, "object_type")
                                .expect("object_type is missing"),
                        )
                        .0;
                        let object_id = WObjectId::from_value(
                            vm,
                            inner
                                .lookup_field(vm, "object_id")
                                .expect("object_id is missing"),
                        )
                        .0;
                        let version = SequenceNumber::from_u64(u64::from_value(
                            vm,
                            inner
                                .lookup_field(vm, "version")
                                .expect("version is missing"),
                        ));
                        ObjectChange::Wrapped {
                            sender,
                            object_type,
                            object_id,
                            version,
                        }
                    }
                    5 => {
                        let sender = WSuiAddress::from_value(
                            vm,
                            inner.lookup_field(vm, "sender").expect("sender is missing"),
                        )
                        .0;
                        let owner = WOwner::from_value(
                            vm,
                            inner.lookup_field(vm, "owner").expect("owner is missing"),
                        )
                        .0;
                        let object_type = WStructTag::from_value(
                            vm,
                            inner
                                .lookup_field(vm, "object_type")
                                .expect("object_type is missing"),
                        )
                        .0;
                        let object_id = WObjectId::from_value(
                            vm,
                            inner
                                .lookup_field(vm, "object_id")
                                .expect("object_id is missing"),
                        )
                        .0;
                        let version = SequenceNumber::from_u64(u64::from_value(
                            vm,
                            inner
                                .lookup_field(vm, "version")
                                .expect("version is missing"),
                        ));
                        let digest = ObjectDigest::new(
                            WDigest::from_value(
                                vm,
                                inner.lookup_field(vm, "digest").expect("digest is missing"),
                            )
                            .0
                            .into_inner(),
                        );

                        ObjectChange::Created {
                            sender,
                            owner,
                            object_type,
                            object_id,
                            version,
                            digest,
                        }
                    }
                    _ => panic!("ValueRef has a wrong tag: {}", data.tag()),
                })
                /*
                let digest = WDigest::from_value(
                    vm,
                    data.lookup_field(vm, "digest").expect("digest is missing"),
                );
                */
            }
            _ => panic!("ValueRef is not a lancer.rpc.TransactionBlockResponse"),
        }
    }
}

impl<'vm> Pushable<'vm> for WObjectChange {
    fn vm_push(self, context: &mut vm::api::ActiveThread<'vm>) -> vm::Result<()> {
        let vm = context.thread();
        match self.0 {
            ObjectChange::Published {
                package_id,
                version,
                digest,
                modules,
            } => {
                WObjectId(package_id).vm_push(context)?;
                version.value().vm_push(context)?;
                WDigest(Digest::new(digest.into_inner())).vm_push(context)?;
                modules.vm_push(context)?;
                context.context().push_new_record(
                    4,
                    &["package_id", "version", "digest", "modules"]
                        .into_iter()
                        .map(|s| vm.global_env().intern(s))
                        .collect::<vm::Result<Vec<_>>>()?,
                )?;
                context.context().push_new_data(0, 1)?;
            }
            ObjectChange::Transferred {
                sender,
                recipient,
                object_type,
                object_id,
                version,
                digest,
            } => {
                WSuiAddress(sender).vm_push(context)?;
                WOwner(recipient).vm_push(context)?;
                WStructTag(object_type).vm_push(context)?;
                WObjectId(object_id).vm_push(context)?;
                version.value().vm_push(context)?;
                WDigest(Digest::new(digest.into_inner())).vm_push(context)?;
                context.context().push_new_record(
                    6,
                    &[
                        "sender",
                        "recipient",
                        "object_type",
                        "object_id",
                        "version",
                        "digest",
                    ]
                    .into_iter()
                    .map(|s| vm.global_env().intern(s))
                    .collect::<vm::Result<Vec<_>>>()?,
                )?;
                context.context().push_new_data(1, 1)?;
            }
            ObjectChange::Mutated {
                sender,
                owner,
                object_type,
                object_id,
                version,
                previous_version,
                digest,
            } => {
                WSuiAddress(sender).vm_push(context)?;
                WOwner(owner).vm_push(context)?;
                WStructTag(object_type).vm_push(context)?;
                WObjectId(object_id).vm_push(context)?;
                version.value().vm_push(context)?;
                previous_version.value().vm_push(context)?;
                WDigest(Digest::new(digest.into_inner())).vm_push(context)?;
                context.context().push_new_record(
                    7,
                    &[
                        "sender",
                        "owner",
                        "object_type",
                        "object_id",
                        "version",
                        "previous_version",
                        "digest",
                    ]
                    .into_iter()
                    .map(|s| vm.global_env().intern(s))
                    .collect::<vm::Result<Vec<_>>>()?,
                )?;
                context.context().push_new_data(2, 1)?;
            },
            ObjectChange::Deleted {
                sender,
                object_type,
                object_id,
                version,
            } => {
                WSuiAddress(sender).vm_push(context)?;
                WStructTag(object_type).vm_push(context)?;
                WObjectId(object_id).vm_push(context)?;
                version.value().vm_push(context)?;
                context.context().push_new_record(
                    4,
                    &["sender", "object_type", "object_id", "version"]
                        .into_iter()
                        .map(|s| vm.global_env().intern(s))
                        .collect::<vm::Result<Vec<_>>>()?,
                )?;
                context.context().push_new_data(3, 1)?;
            },
            ObjectChange::Wrapped {
                sender,
                object_type,
                object_id,
                version,
            } => {
                WSuiAddress(sender).vm_push(context)?;
                WStructTag(object_type).vm_push(context)?;
                WObjectId(object_id).vm_push(context)?;
                version.value().vm_push(context)?;
                context.context().push_new_record(
                    4,
                    &["sender", "object_type", "object_id", "version"]
                        .into_iter()
                        .map(|s| vm.global_env().intern(s))
                        .collect::<vm::Result<Vec<_>>>()?,
                )?;
                context.context().push_new_data(4, 1)?;
            },
            ObjectChange::Created {
                sender,
                owner,
                object_type,
                object_id,
                version,
                digest,
            } => {
                WSuiAddress(sender).vm_push(context)?;
                WOwner(owner).vm_push(context)?;
                WStructTag(object_type).vm_push(context)?;
                WObjectId(object_id).vm_push(context)?;
                version.value().vm_push(context)?;
                WDigest(Digest::new(digest.into_inner())).vm_push(context)?;
                context.context().push_new_record(
                    6,
                    &[
                        "sender",
                        "owner",
                        "object_type",
                        "object_id",
                        "version",
                        "digest",
                    ]
                    .into_iter()
                    .map(|s| vm.global_env().intern(s))
                    .collect::<vm::Result<Vec<_>>>()?,
                )?;
                context.context().push_new_data(5, 1)?;
            },
        }
        Ok(())
    }
}

impl Deref for WObjectChange {
    type Target = ObjectChange;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

fn load_rpc(vm: &Thread) -> vm::Result<vm::ExternModule> {
    ExternModule::new(
        vm,
        record!(
            type TransactionBlockResponse => WTransactionBlockResponse,
        ),
    )
}

pub fn install_rpc(vm: &Thread) -> vm::Result<()> {
    // vm.register_type::<WTransactionBlockResponse>("lancer.rpc.TransactionBlockResponse", &[])?;
    add_extern_module_with_deps(
        vm,
        "lancer.rpc.prim",
        load_rpc,
        vec!["lancer.rpc.types".to_string()],
    );
    Ok(())
}
