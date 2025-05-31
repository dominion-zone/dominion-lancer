use std::fmt::format;
use std::ops::Deref;
use std::path::Path;
use std::path::PathBuf;
use std::pin::Pin;
use std::str::FromStr;

use anyhow::Context;
use clap::Parser;
use move_binary_format::CompiledModule;
use move_bytecode_utils::module_cache::GetModule;
use move_bytecode_utils::module_cache::ModuleCache;
use move_core_types::account_address::AccountAddress;
use move_core_types::annotated_value::MoveStruct;
use move_core_types::annotated_value::MoveValue;
use move_core_types::identifier::IdentStr;
use move_core_types::language_storage::ModuleId;
use move_core_types::language_storage::StructTag;
use std::collections::HashSet;
use sui_core::authority::authority_store_tables::AuthorityPerpetualTables;
use sui_core::authority::authority_store_tables::LiveObject;
use sui_core::rpc_index::RpcIndexStore;
use sui_json_rpc_types::SuiData;
use sui_json_rpc_types::SuiObjectData;
use sui_json_rpc_types::SuiObjectDataOptions;
use sui_types::SYSTEM_PACKAGE_ADDRESSES;
use sui_types::TypeTag;
use sui_types::base_types::MoveObjectType;
use sui_types::base_types::ObjectID;
use sui_types::object::Data;
use sui_types::object::Object;
use sui_types::object::Owner;
use sui_types::storage::ObjectStore;
use tokio::fs;
use tokio::main;

pub struct Tables {
    pub perpetual: AuthorityPerpetualTables,
    pub indices: RpcIndexStore,
}

impl Deref for Tables {
    type Target = AuthorityPerpetualTables;

    fn deref(&self) -> &Self::Target {
        &self.perpetual
    }
}

impl GetModule for Tables {
    type Error = anyhow::Error;

    type Item = CompiledModule;

    fn get_module_by_id(&self, id: &ModuleId) -> anyhow::Result<Option<Self::Item>, Self::Error> {
        let p = self.perpetual.get_object(&id.address().clone().into());
        if let Some(p) = p {
            let p = p.data.try_as_package().context("Object is not a package")?;
            return Ok(p
                .get_module(id)
                .map(|bytes| CompiledModule::deserialize_with_defaults(&bytes).unwrap()));
        }
        Ok(None)
    }
}

#[derive(Parser, Debug)]
struct Args {
    id: ObjectID,
    #[arg(long)]
    db: PathBuf,
    #[arg(long)]
    parsed: bool,
    #[arg(long)]
    pretty: bool,
    #[arg(long)]
    recursive: bool,
}

fn is_uid_tag(tag: &StructTag) -> bool {
    tag.address == AccountAddress::from_hex_literal("0x2").unwrap()
        && tag.module.as_str() == "object"
        && tag.name.as_str() == "UID"
        && tag.type_params.is_empty()
}

/// Рекурсивно ищет UID и вытаскивает из них внутренний ID (Address)
pub fn collect_uids(struct_: &MoveStruct) -> Vec<AccountAddress> {
    let mut result = Vec::new();
    collect_uids_recursive(struct_, &mut result);
    result
}

fn collect_uids_recursive(struct_: &MoveStruct, out: &mut Vec<AccountAddress>) {
    if is_uid_tag(&struct_.type_) {
        if let Some((_, MoveValue::Struct(id_struct))) =
            struct_.fields.iter().find(|(k, _)| k.as_str() == "id")
        {
            if let Some((_, MoveValue::Address(addr))) =
                id_struct.fields.iter().find(|(k, _)| k.as_str() == "bytes")
            {
                out.push(*addr);
                return;
            } else {
                panic!(
                    "UID struct does not contain 'bytes' field: {:?}",
                    id_struct.fields
                );
            }
        } else {
            panic!(
                "UID struct does not contain 'id' field: {:?}",
                struct_.fields
            );
        }
    }

    for (_, val) in &struct_.fields {
        match val {
            MoveValue::Struct(s) => collect_uids_recursive(s, out),
            MoveValue::Vector(vs) => {
                for item in vs {
                    if let MoveValue::Struct(s) = item {
                        collect_uids_recursive(s, out);
                    }
                }
            }
            _ => {}
        }
    }
}

impl Tables {
    pub fn new(db: &Path) -> Self {
        let perpetual = AuthorityPerpetualTables::open(&db.join("store"), None);
        let indices = RpcIndexStore::new_without_init(db);
        Tables { perpetual, indices }
    }
    async fn children_recursive(
        &self,
        obj: Object,
        result: &mut Vec<Object>,
    ) -> anyhow::Result<()> {
        if let Some(layout) = obj.get_layout(self)? {
            let wrapped = collect_uids(&obj.data.try_as_move().unwrap().to_move_struct(&layout)?);
            for id in wrapped {
                for child in self.indices.owner_iter(id.into(), None, None)? {
                    let (child, info) = child?;
                    let child = self
                        .perpetual
                        .get_object_by_key(&child.object_id, info.version)
                        .context("Can not find child")?;
                    result.push(child.clone());
                    Box::pin(self.children_recursive(child, result)).await?;
                }
            }
        }
        Ok(())
    }
}

#[main]
async fn main() -> anyhow::Result<()> {
    let args = Args::parse();

    let perpetual_tables = Tables::new(&args.db);
    let obj = perpetual_tables
        .get_object(&args.id)
        .context("Failed to get object")?;
    let mut objects = Vec::new();
    objects.push(obj.clone());
    if args.recursive {
        perpetual_tables
            .children_recursive(obj.clone(), &mut objects)
            .await?;
    }
    if args.parsed {
        let rpc_objs = objects
            .iter()
            .map(|obj| {
                let layout = obj
                    .get_layout(&perpetual_tables)?
                    .context("Failed to get layout")?;
                Ok(SuiObjectData::try_from((
                    perpetual_tables
                        .get_latest_object_ref_or_tombstone(args.id.clone())
                        .unwrap()
                        .unwrap(),
                    obj.clone(),
                    Some(layout.clone()),
                    SuiObjectDataOptions::new()
                        .with_bcs()
                        .with_content()
                        .with_owner()
                        .with_type(),
                ))?)
            })
            .collect::<anyhow::Result<Vec<_>>>()?;

        if args.pretty {
            if args.recursive {
                println!("{}", serde_json::to_string_pretty(&rpc_objs).unwrap());
            } else {
                println!("{}", serde_json::to_string_pretty(&rpc_objs[0]).unwrap());
            }
        } else {
            if args.recursive {
                println!("{}", serde_json::to_string(&rpc_objs).unwrap());
            } else {
                println!("{}", serde_json::to_string(&rpc_objs[0]).unwrap());
            }
        }
    } else {
        if args.pretty {
            if args.recursive {
                println!("{}", serde_json::to_string_pretty(&objects).unwrap());
            } else {
                println!("{}", serde_json::to_string_pretty(&objects[0]).unwrap());
            }
        } else {
            if args.recursive {
                println!("{}", serde_json::to_string(&objects).unwrap());
            } else {
                println!("{}", serde_json::to_string(&objects[0]).unwrap());
            }
        }
    }

    return Ok(());
}
