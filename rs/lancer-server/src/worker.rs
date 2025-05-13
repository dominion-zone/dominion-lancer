use std::path::PathBuf;

use lancer_transport::{response::LancerRunResponse, task::LancerRunTask};
use reqwest::multipart::{Form, Part};
use tokio::sync::mpsc;
use walrus_core::DEFAULT_ENCODING;
use walrus_sdk::store_when::StoreWhen;
use walrus_sdk::{client::Client as WalrusClient, config::load_configuration};
use walrus_sui::client::{BlobPersistence, PostStoreAction, SuiContractClient};

pub async fn process_task(
    task: &LancerRunTask,
    reqwest: &reqwest::Client,
    walrus: &WalrusClient<SuiContractClient>,
) -> anyhow::Result<()> {
    println!("Processing task: {:?}", task.finding_id);
    /*
    iv: Vec<u8>,
    pub encrypted_file: Vec<u8>,
    pub encrypted_key: Vec<u8>,
    pub bug_bounty_id: ObjectID,
    pub finding_id: ObjectID,
    pub escrow_id: ObjectID, */
    let form = Form::new()
        .part("iv", Part::bytes(task.iv.clone()))
        .part("encryptedFile", Part::bytes(task.encrypted_file.clone()))
        .part("encryptedKey", Part::bytes(task.encrypted_key.clone()))
        .text("bugBountyId", task.bug_bounty_id.to_string())
        .text("findingId", task.finding_id.to_string())
        .text("escrowId", task.escrow_id.to_string());
    let response = reqwest
        .post("http://localhost:9300/run")
        .multipart(form)
        .send()
        .await.unwrap()
        .bytes()
        .await?;
    println!("Received response: {:?}", response.len());
    let response: LancerRunResponse = bson::from_slice(&response)?;

    let mut blobs = vec![];
    if let Some(public_report) = response.public_report {
        blobs.push(("public.tar".into(), public_report));
    }
    if let Some(private_report) = response.private_report {
        blobs.push(("private.tar".into(), private_report));
    }
    if let Some(error_message) = response.error_message {
        blobs.push(("error_message.txt".into(), error_message));
    }
    print!("Storing blobs {:?}", walrus.encoding_config().get_for_type(DEFAULT_ENCODING));
    println!();
    println!();
    let results = walrus
        .reserve_and_store_blobs_retry_committees_with_path(
            &blobs,
            DEFAULT_ENCODING,
            5,
            StoreWhen::Always,
            BlobPersistence::Deletable,
            PostStoreAction::Keep,
        )
        .await?;
    println!("Stored blobs:");
    for blob in results {
        println!("Blob: {:?}", blob.blob_store_result.blob_id());
    }
    Ok(())
}

pub async fn worker(mut receiver: mpsc::Receiver<LancerRunTask>) -> anyhow::Result<()> {
    let reqwest = reqwest::Client::new();
    let config = load_configuration(Some("/home/aankor/.walrus/client_config_testnet.yaml"), None)?;
    println!("Config: {:?}", config);
    let sui_client = config
        .new_contract_client_with_wallet_in_config(None)
        .await?;

    let refresh_handle = config
        .refresh_config
        .build_refresher_and_run(sui_client.read_client().clone())
        .await?;
    let walrus = WalrusClient::new_contract_client(config, refresh_handle, sui_client).await?;
    while let Some(task) = receiver.recv().await {
        // Process the task
        let response = process_task(&task, &reqwest, &walrus).await.unwrap();
    }

    Ok(())
}
