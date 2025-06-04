use std::{fmt, str::FromStr};

use anyhow::Context;
use argument::WArgument;
use gluon::{
    Thread,
    import::add_extern_module_with_deps,
    primitive, record,
    vm::{
        self, ExternModule,
        api::{IO, UserdataValue},
    },
};
use gluon_codegen::{Trace, Userdata, VmType};
use move_core_types::u256::U256;
use object_arg::WObjectArg;
use serde::Serialize;
use std::error::Error as StdError;
use sui_types::{
    Identifier, base_types::SequenceNumber, digests::ObjectDigest,
    programmable_transaction_builder::ProgrammableTransactionBuilder, transaction::Command,
};
use tokio::sync::RwLock;

use crate::{
    sui::{WDigest, WSuiAddress, types::WTypeTag},
    types::uint::UInt,
};

use super::TransactionRef;

pub mod argument;
pub mod object_arg;

#[derive(Trace, VmType, Userdata)]
#[gluon(vm_type = "lancer.transaction.builder.prim.TransactionBuilder")]
#[gluon_trace(skip)]
pub struct WTransactionBuilder(RwLock<Option<ProgrammableTransactionBuilder>>);

impl WTransactionBuilder {
    pub fn new() -> IO<Self> {
        let builder = ProgrammableTransactionBuilder::new();
        IO::Value(WTransactionBuilder(RwLock::new(Some(builder))))
    }

    pub async fn pure<T: Serialize>(&self, value: T) -> IO<WArgument> {
        async {
            let r = self
                .0
                .write()
                .await
                .as_mut()
                .ok_or("Already built".to_string())?
                .pure(value)
                .map_err(|e| e.to_string())?;
            Ok::<_, String>(WArgument(r))
        }
        .await
        .into()
    }

    pub async fn uint<T: TryFrom<UInt, Error: Into<anyhow::Error>> + Serialize>(
        &self,
        value: UserdataValue<UInt>,
    ) -> IO<WArgument> {
        async {
            let r = self
                .0
                .write()
                .await
                .as_mut()
                .context("Already built")?
                .pure::<T>(value.0.try_into().map_err(Into::into)?)?;
            Ok::<_, anyhow::Error>(WArgument(r))
        }
        .await
        .map_err(|e| e.to_string())
        .into()
    }

    pub async fn object_ref(&self, arg: WObjectArg) -> IO<WArgument> {
        async {
            let r = self
                .0
                .write()
                .await
                .as_mut()
                .context("Already built")?
                .obj(arg.0)?;
            Ok::<_, anyhow::Error>(WArgument(r))
        }
        .await
        .map_err(|e| e.to_string())
        .into()
    }

    pub async fn publish_upgradeable(
        &self,
        modules: Vec<Vec<u8>>,
        dep_ids: Vec<WSuiAddress>,
    ) -> IO<WArgument> {
        async {
            let r = self
                .0
                .write()
                .await
                .as_mut()
                .ok_or("Already built".to_string())?
                .publish_upgradeable(modules, dep_ids.into_iter().map(|id| id.0.into()).collect());

            Ok::<_, String>(WArgument(r))
        }
        .await
        .into()
    }

    pub async fn publish_immutable(
        &self,
        modules: Vec<Vec<u8>>,
        dep_ids: Vec<WSuiAddress>,
    ) -> IO<()> {
        async {
            self.0
                .write()
                .await
                .as_mut()
                .ok_or("Already built".to_string())?
                .publish_immutable(modules, dep_ids.into_iter().map(|id| id.0.into()).collect());

            Ok::<_, String>(())
        }
        .await
        .into()
    }

    pub async fn move_call(
        &self,
        package: WSuiAddress,
        module: String,
        function: String,
        type_args: Vec<WTypeTag>,
        args: Vec<WArgument>,
    ) -> IO<WArgument> {
        async {
            let r = self
                .0
                .write()
                .await
                .as_mut()
                .ok_or("Already built".to_string())?
                .programmable_move_call(
                    package.0.into(),
                    Identifier::from_str(&module).unwrap(),
                    Identifier::from_str(&function).unwrap(),
                    type_args.into_iter().map(|t| t.0).collect(),
                    args.into_iter().map(|arg| arg.0).collect(),
                );
            Ok::<_, String>(WArgument(r))
        }
        .await
        .into()
    }

    pub async fn split_coin(&self, coin: WArgument, amounts: Vec<WArgument>) -> IO<WArgument> {
        async {
            let r = self
                .0
                .write()
                .await
                .as_mut()
                .ok_or("Already built".to_string())?
                .command(Command::SplitCoins(
                    coin.0,
                    amounts.into_iter().map(|a| a.0).collect(),
                ));
            Ok::<_, String>(WArgument(r))
        }
        .await
        .into()
    }

    pub async fn pay(
        &self,
        coins: Vec<(WSuiAddress, u64, WDigest)>,
        amounts: Vec<u64>,
        recipients: Vec<WSuiAddress>,
    ) -> IO<()> {
        async {
            self.0
                .write()
                .await
                .as_mut()
                .ok_or("Already built".to_string())?
                .pay(
                    coins
                        .into_iter()
                        .map(|(id, version, digest)| {
                            (
                                id.0.into(),
                                SequenceNumber::from_u64(version),
                                ObjectDigest::new(digest.0.into_inner()),
                            )
                        })
                        .collect(),
                    recipients.into_iter().map(|r| r.0.into()).collect(),
                    amounts,
                )
                .map_err(|e| e.to_string())?;
            Ok::<_, String>(())
        }
        .await
        .into()
    }

    pub async fn finish(&self) -> IO<TransactionRef> {
        async {
            let r = self
                .0
                .write()
                .await
                .take()
                .ok_or("Already built".to_string())?
                .finish();
            Ok::<_, String>(TransactionRef(r))
        }
        .await
        .into()
    }
}

impl fmt::Debug for WTransactionBuilder {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("TransactionBuilder").finish()
    }
}

fn load(vm: &Thread) -> vm::Result<vm::ExternModule> {
    ExternModule::new(
        vm,
        record!(
            type TransactionBuilder => WTransactionBuilder,
            new => primitive!(0, "lancer.transaction.builder.prim.new", WTransactionBuilder::new),
            u8 => primitive!(2, "lancer.transaction.builder.prim.u8", async fn WTransactionBuilder::pure::<u8>),
            u16 => primitive!(2, "lancer.transaction.builder.prim.u16", async fn WTransactionBuilder::pure::<u16>),
            u32 => primitive!(2, "lancer.transaction.builder.prim.u32", async fn WTransactionBuilder::pure::<u32>),
            u64 => primitive!(2, "lancer.transaction.builder.prim.u64", async fn WTransactionBuilder::uint::<u64>),
            u128 => primitive!(2, "lancer.transaction.builder.prim.u128", async fn WTransactionBuilder::uint::<u128>),
            u256 => primitive!(2, "lancer.transaction.builder.prim.u256", async fn WTransactionBuilder::uint::<U256>),
            bool => primitive!(2, "lancer.transaction.builder.prim.bool", async fn WTransactionBuilder::pure::<bool>),
            address => primitive!(2, "lancer.transaction.builder.prim.address", async fn WTransactionBuilder::pure::<WSuiAddress>),
            object_ref => primitive!(2, "lancer.transaction.builder.prim.object_ref", async fn WTransactionBuilder::object_ref),
            publish_upgradeable => primitive!(
                3,
                "lancer.transaction.builder.prim.publish_upgradeable",
                async fn WTransactionBuilder::publish_upgradeable),
            publish_immutable => primitive!(
                3,
                "lancer.transaction.builder.prim.publish_immutable",
                async fn WTransactionBuilder::publish_immutable),
            move_call => primitive!(6, "lancer.transaction.builder.prim.move_call", async fn WTransactionBuilder::move_call),
            pay => primitive!(4, "lancer.transaction.builder.prim.pay", async fn WTransactionBuilder::pay),
            split_coin => primitive!(3, "lancer.transaction.builder.prim.split_coin", async fn WTransactionBuilder::split_coin),
            finish => primitive!(1, "lancer.transaction.builder.prim.finish", async fn WTransactionBuilder::finish),
        ),
    )
}

pub fn install(vm: &Thread) -> vm::Result<()> {
    vm.register_type::<WTransactionBuilder>(
        "lancer.transaction.builder.prim.TransactionBuilder",
        &[],
    )?;

    add_extern_module_with_deps(
        vm,
        "lancer.transaction.builder.prim",
        load,
        vec![
            "lancer.transaction.builder.types".to_string(),
            "lancer.sui.types".to_string(),
        ],
    );
    Ok(())
}
