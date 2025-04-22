#![allow(non_local_definitions)]

use std::time::Duration;

use anyhow::Result;
use gluon::RootedThread;
use gluon::vm::api::Hole;
use gluon::vm::api::OpaqueValue;
use gluon::vm::api::Pushable;
use gluon::vm::api::VmType;
use gluon::{
    ThreadExt, new_vm_async,
    vm::{
        api::{FunctionRef, FutureResult, IO, UserdataValue},
        thread::ThreadInternal,
    },
};
use lancer_runner::PreparationDump;
use lancer_runner::{LancerInitializeArgs, LancerRef, install_lancer};
use tokio::fs;
use tokio::{sync::mpsc, time::sleep};

#[tokio::main]
async fn main() -> Result<()> {
    let vm = new_vm_async().await;
    vm.run_io(true);
    install_lancer(&vm)?;
    vm.run_expr_async::<OpaqueValue<RootedThread, Hole>>("import", "import! lancer.prim")
        .await?;
    let (preparation_dump_sender, mut preparation_dump_receiver) = mpsc::channel::<PreparationDump>(1);
    let preparation_dump_uploader = tokio::spawn(async move {
        let dump = preparation_dump_receiver.recv().await.unwrap();
        fs::write("/tmp/preparation.sql", dump.sql.as_bytes())
            .await
            .unwrap();
    });
    let lancer: UserdataValue<LancerRef> = vm.get_global("lancer.prim.lancer")?;
    {
        let mut initialize: FunctionRef<fn(LancerRef, LancerInitializeArgs) -> IO<()>> =
            vm.get_global("lancer.prim.initialize")?;
        initialize
            .call_async(
                lancer.0.clone(),
                LancerInitializeArgs {
                    dump_sender: preparation_dump_sender,
                },
            )
            .await?;
    }
    vm.load_file_async("script.glu").await?;
    // let lancer: UserdataValue<LancerRef> = vm.get_global("lancer.prim.lancer")?;
    // sleep(Duration::from_secs(100000)).await;
    if let IO::Value(final_report) = lancer.0.stop().await {
        fs::write("/tmp/final.sql", final_report.private_sql.as_bytes())
            .await
            .unwrap();
    }
    preparation_dump_uploader.await?;
    Ok(())
}

/*
#[tokio::main]
async fn main() -> Result<()> {
    let builder = TestClusterBuilder::new();

    let package: Object = serde_json::from_slice(&read("test.json").await?)?;

    let move_build_config = BuildConfig::new_for_testing();
    let compiled_modules = move_build_config.build("../../sui/dummy_pool".as_ref())?;
    // let deps = compiled_modules.get_published_dependencies_ids();
    let modules = compiled_modules.into_modules();
    // let modules_bytes = compiled_modules.get_package_bytes(false);
    let o = Object::new_package_for_testing(
        &modules,
        Digest::genesis_marker(),
        BuiltInFramework::genesis_move_packages(),
    )?;

    let builder = builder.with_objects([package, o]);

    let mut cluster = builder.build().await;
    cluster.start_all_validators().await;
    let (sender, gas) = cluster.wallet().get_one_gas_object().await?.context("No gas object")?;

    {
        let move_build_config = BuildConfig::new_for_testing();
        let compiled_modules = move_build_config.build("../../sui/dummy_pool_hack".as_ref())?;
        // let deps = compiled_modules.get_published_dependencies_ids();
        // let modules = compiled_modules.into_modules();
        let modules_bytes = compiled_modules.get_package_bytes(false);

    }

    /*
    let tx_kind = cluster
        .sui_client()
        .transaction_builder()
        .publish_tx_kind(
            cluster.get_address_0(),
            modules_bytes,
            vec![
                ObjectID::from_hex_literal("0x1").unwrap(),
                ObjectID::from_hex_literal("0x2").unwrap(),
            ],
        )
        .await?;

    let tx_data = cluster
        .sui_client()
        .transaction_builder()
        .tx_data(
            cluster.get_address_0(),
            tx_kind,
            gas_data.budget,
            gas_data.price,
            vec![gas_data.object.0],
            None,
        )
        .await?;

    let sig = keystore.sign_secure(&tx_data.sender(), &tx_data, Intent::sui_transaction())?;

    let res = client
        .quorum_driver_api()
        .execute_transaction_block(
            Transaction::from_data(tx_data, vec![sig]),
            SuiTransactionBlockResponseOptions::new()
                .with_effects()
                .with_object_changes()
                .with_input(),
            Some(ExecuteTransactionRequestType::WaitForLocalExecution),
        )
        .await?;
    */

    Ok(())
}
*/
