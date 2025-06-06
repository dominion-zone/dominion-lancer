#![allow(non_local_definitions)]

use std::path::{Path, PathBuf};

use anyhow::{Context, Result};
use gluon::vm::api::{Hole, IO, OpaqueValue};
use gluon::{RootedThread, VmBuilder};
use gluon::{ThreadExt, new_vm_async, vm::api::FunctionRef};
use lancer_runner::install_lancer;
use lancer_runner::test_cluster::builder::WTestClusterBuilder;
use tokio::fs;
use tokio::io::AsyncWriteExt;

/*
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReportManifest {
    pub preparation_sender: SuiAddress,
    pub preparation_available_keys: HashSet<SuiAddress>,
    pub execution_sender: SuiAddress,
    pub execution_available_keys: HashSet<SuiAddress>,
    pub reporting: Reporting,
}
    */

#[tokio::main]
async fn main() -> Result<()> {
    let working_dir = Path::new(
        &std::env::args()
            .nth(1)
            .context("No working directory provided")?,
    )
    .canonicalize()?;
    if !working_dir.exists() {
        anyhow::bail!(
            "Working directory does not exist: {}",
            working_dir.display()
        );
    }

    let vm = VmBuilder::new()
        .import_paths(Some(vec![working_dir.join("input/glu")]))
        .build_async()
        .await;
    install_lancer(&vm)?;

    vm.run_io(false);
    let (scenario, _) = vm
        .run_expr_async::<OpaqueValue<RootedThread, Hole>>(
            "scenario_",
            r#"
let { Lancer } = import! lancer.types
let scenario : Lancer r = import! "scenario"
scenario"#,
        )
        .await?;
    vm.run_io(true);

    let (mut run, _) = vm
        .run_expr_async::<FunctionRef<
            '_,
            fn(
                WTestClusterBuilder,
                PathBuf,
                OpaqueValue<RootedThread, Hole>,
            ) -> IO<(String, Option<String>)>,
        >>("main_", "import! \"lancer/main.glu\"")
        .await?;
    let test_cluster_builder = WTestClusterBuilder::new();
    if let IO::Value((logs, public_summary)) = run
        .call_async(test_cluster_builder, working_dir.clone(), scenario)
        .await?
    {
        let output_path = working_dir.join("output");
        if output_path.exists() {
            fs::remove_dir_all(&output_path).await?;
        }
        let tmp_path = working_dir.join("tmp");
        if tmp_path.exists() {
            fs::remove_dir_all(&tmp_path).await?;
        }
        fs::create_dir(&tmp_path).await?;
        let mut logs_file = fs::File::create(&tmp_path.join("logs.json")).await?;
        logs_file.write_all(logs.as_bytes()).await?;
        logs_file.flush().await?;
        if let Some(public_summary) = public_summary {
            let mut summary_file = fs::File::create(&tmp_path.join("public_summary.json")).await?;
            summary_file.write_all(public_summary.as_bytes()).await?;
            summary_file.flush().await?;
        }
        fs::rename(&tmp_path, &output_path).await?;
    }
    /*
    vm.run_expr_async::<OpaqueValue<RootedThread, Hole>>("import", "import! lancer.prim")
        .await?;
    let (preparation_dump_sender, mut preparation_dump_receiver) =
        mpsc::channel::<PreparationDump>(1);
    let mut public_tar = tar::Builder::new(Vec::<u8>::new());
    let preparation_dump_uploader: JoinHandle<anyhow::Result<_>> = tokio::spawn(async move {
        let dump = preparation_dump_receiver.recv().await.unwrap();

        {
            let data = dump.sql.as_bytes();

            let mut header = tar::Header::new_gnu();
            header.set_size(data.len() as u64);
            header.set_cksum();

            public_tar.append_data(&mut header, "preparation.sql", data)?;
        }

        Ok((public_tar, dump.sender, dump.available_private_keys))
    });
    let lancer: UserdataValue<LancerRef> = vm.get_global("lancer.prim.lancer")?;
    {
        let mut initialize: FunctionRef<'_, fn(LancerRef, LancerInitializeArgs) -> IO<()>> =
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

    let final_report = lancer
        .0
        .stop()
        .await
        .into_result()
        .expect("Failed to stop Lancer");

    let (mut public_tar, preparation_sender, preparation_available_keys) =
        preparation_dump_uploader.await??;

    let report_manifest = ReportManifest {
        preparation_sender,
        preparation_available_keys,
        execution_sender: final_report.sender,
        execution_available_keys: final_report.available_private_keys,
        reporting: final_report.reporting.clone(),
    };

    {
        let manifest_data = serde_json::to_vec(&report_manifest)?;
        let mut manifest_header = tar::Header::new_gnu();
        manifest_header.set_size(manifest_data.len() as u64);
        manifest_header.set_cksum();

        public_tar.append_data(
            &mut manifest_header,
            "manifest.json",
            manifest_data.as_slice(),
        )?;
    }

    let private_tar = {
        let final_dump_data = final_report.sql.as_bytes();

        let mut final_dump_header = tar::Header::new_gnu();
        final_dump_header.set_size(final_dump_data.len() as u64);
        final_dump_header.set_cksum();

        match final_report.reporting {
            Reporting::Public => {
                public_tar.append_data(&mut final_dump_header, "final.sql", final_dump_data)?;
                None
            }
            Reporting::Partial { .. } => {
                let mut private_tar = tar::Builder::new(Vec::<u8>::new());
                private_tar.append_data(&mut final_dump_header, "final.sql", final_dump_data)?;
                Some(private_tar)
            }
            Reporting::HidingObjects(_hash_set) => todo!(),
        }
    };

    fs::write("/tmp/public.tar", &public_tar.into_inner()?).await?;
    if let Some(private_tar) = private_tar {
        fs::write("/tmp/private.tar", &private_tar.into_inner()?).await?;
    }
    */
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
