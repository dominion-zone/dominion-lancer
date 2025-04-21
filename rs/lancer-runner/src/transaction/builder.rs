use std::{fmt, str::FromStr};

use gluon::{
    Thread,
    base::types::ArcType,
    vm::{
        self,
        api::{Getable, IO, Pushable, ValueRef, VmType},
        impl_getable_simple,
    },
};
use gluon_codegen::{Trace, Userdata, VmType};
use serde::Serialize;
use sui_types::{
    Identifier, base_types::SequenceNumber, digests::ObjectDigest,
    programmable_transaction_builder::ProgrammableTransactionBuilder,
};
use tokio::sync::RwLock;

use crate::sui::{WDigest, WSuiAddress, types::WTypeTag};

use super::{argument::WArgument, object_arg::WObjectArg, transaction::WTransaction};

#[derive(Trace, VmType, Userdata)]
#[gluon(vm_type = "lancer.transaction.prim.Builder")]
#[gluon_trace(skip)]
pub struct WBuilder(RwLock<Option<ProgrammableTransactionBuilder>>);

impl WBuilder {
    pub fn new() -> IO<Self> {
        let builder = ProgrammableTransactionBuilder::new();
        IO::Value(WBuilder(RwLock::new(Some(builder))))
    }

    pub async fn pure<T: Serialize>(&self, value: T) -> IO<WArgument> {
        self.0.write().await.as_mut().map_or(
            IO::Exception("Already built".to_string()),
            |b| match b.pure(value) {
                Ok(r) => IO::Value(WArgument(r)),
                Err(e) => return IO::Exception(e.to_string()),
            },
        )
    }

    pub async fn object_ref(&self, arg: WObjectArg) -> IO<WArgument> {
        self.0.write().await.as_mut().map_or(
            IO::Exception("Already built".to_string()),
            |b| match b.obj(arg.0) {
                Ok(r) => IO::Value(WArgument(r)),
                Err(e) => return IO::Exception(e.to_string()),
            },
        )
    }

    pub async fn publish_upgradeable(
        &self,
        modules: Vec<Vec<u8>>,
        dep_ids: Vec<WSuiAddress>,
    ) -> IO<WArgument> {
        self.0
            .write()
            .await
            .as_mut()
            .map_or(IO::Exception("Already built".to_string()), |b| {
                IO::Value(WArgument(b.publish_upgradeable(
                    modules,
                    dep_ids.into_iter().map(|id| id.0.into()).collect(),
                )))
            })
    }

    pub async fn publish_immutable(
        &self,
        modules: Vec<Vec<u8>>,
        dep_ids: Vec<WSuiAddress>,
    ) -> IO<()> {
        self.0
            .write()
            .await
            .as_mut()
            .map_or(IO::Exception("Already built".to_string()), |b| {
                b.publish_immutable(modules, dep_ids.into_iter().map(|id| id.0.into()).collect());
                IO::Value(())
            })
    }

    pub async fn pay(
        &self,
        coins: Vec<(WSuiAddress, u64, WDigest)>,
        amounts: Vec<u64>,
        recipients: Vec<WSuiAddress>,
    ) -> IO<()> {
        self.0.write().await.as_mut().map_or(
            IO::Exception("Already built".to_string()),
            |b| match b.pay(
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
            ) {
                Ok(_) => IO::Value(()),
                Err(e) => IO::Exception(e.to_string()),
            },
        )
    }

    pub async fn move_call(
        &self,
        package: WSuiAddress,
        module: String,
        function: String,
        type_args: Vec<WTypeTag>,
        args: Vec<WArgument>,
    ) -> IO<WArgument> {
        self.0
            .write()
            .await
            .as_mut()
            .map_or(IO::Exception("Already built".to_string()), |b| {
                IO::Value(WArgument(b.programmable_move_call(
                    package.0.into(),
                    Identifier::from_str(&module).unwrap(),
                    Identifier::from_str(&function).unwrap(),
                    type_args.into_iter().map(|t| t.0).collect(),
                    args.into_iter().map(|arg| arg.0).collect(),
                )))
            })
    }

    pub async fn finish(&self) -> IO<WTransaction> {
        self.0
            .write()
            .await
            .take()
            .map_or(IO::Exception("Already built".to_string()), |b| {
                IO::Value(WTransaction(b.finish()))
            })
    }
}

impl fmt::Debug for WBuilder {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "Builder({{..}})")
    }
}
