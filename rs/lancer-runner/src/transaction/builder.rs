use std::{fmt, str::FromStr};

use gluon::{
    base::types::ArcType, vm::{
        self,
        api::{Getable, Pushable, ValueRef, VmType, IO},
        impl_getable_simple,
    }, Thread
};
use gluon_codegen::{Trace, Userdata, VmType};
use serde::Serialize;
use sui_types::{programmable_transaction_builder::ProgrammableTransactionBuilder, Identifier};
use tokio::sync::RwLock;

use crate::sui::{types::WTypeTag, WSuiAddress};

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
        self.0
            .write()
            .await
            .as_mut()
            .map_or(IO::Exception("Already built".to_string()), |b| {
                match b.pure(value) {
                    Ok(r) => IO::Value(WArgument(r)),
                    Err(e) => return IO::Exception(e.to_string()),
                }
            })
    }

    pub async fn object_ref(&self, arg: WObjectArg) -> IO<WArgument> {
        self.0
            .write()
            .await
            .as_mut()
            .map_or(IO::Exception("Already built".to_string()), |b| {
                match b.obj(arg.0) {
                    Ok(r) => IO::Value(WArgument(r)),
                    Err(e) => return IO::Exception(e.to_string()),
                }
            })
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

    pub async fn publish_immutable(&self, modules: Vec<Vec<u8>>, dep_ids: Vec<WSuiAddress>) -> IO<()> {
        self.0
            .write()
            .await
            .as_mut()
            .map_or(IO::Exception("Already built".to_string()), |b| {
                b.publish_immutable(modules, dep_ids.into_iter().map(|id| id.0.into()).collect());
                IO::Value(())
            })
    }

    pub async fn move_call(
        &self,
        package: WSuiAddress,
        module: String,
        function: String,
        type_args: Vec<WTypeTag>,
        args: Vec<WArgument>,
    ) -> IO<()> {
        self.0
            .write()
            .await
            .as_mut()
            .map_or(IO::Exception("Already built".to_string()), |b| {
                b.programmable_move_call(
                    package.0.into(),
                    Identifier::from_str(&module).unwrap(),
                    Identifier::from_str(&function).unwrap(),
                    type_args.into_iter().map(|t| t.0).collect(),
                    args.into_iter().map(|arg| arg.0).collect(),
                );
                IO::Value(())
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