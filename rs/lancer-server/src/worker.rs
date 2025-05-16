use std::path::PathBuf;
use std::str::FromStr;
use std::sync::Arc;

use anyhow::bail;
use lancer_transport::task;
use lancer_transport::{response::LancerRunResponse, task::LancerRunTask};
use move_core_types::account_address::AccountAddress;
use move_core_types::identifier::IdentStr;
use reqwest::multipart::{Form, Part};
use sui_config::{PersistedConfig, SUI_CLIENT_CONFIG, sui_config_dir};
use sui_keys::keystore::FileBasedKeystore;
use sui_sdk::rpc_types::SuiObjectDataOptions;
use sui_sdk::sui_client_config::SuiClientConfig;
use sui_sdk::wallet_context::WalletContext;
use sui_sdk::{SuiClient, SuiClientBuilder};
use sui_types::programmable_transaction_builder::ProgrammableTransactionBuilder;
use sui_types::transaction::{ObjectArg, Transaction, TransactionData};
use sui_types::{
    Identifier, MOVE_STDLIB_PACKAGE_ID, SUI_FRAMEWORK_PACKAGE_ID, SUI_SYSTEM_PACKAGE_ID, TypeTag,
};
use tokio::sync::mpsc;
use walrus_core::DEFAULT_ENCODING;
use walrus_sdk::client::responses::{BlobStoreResult, EventOrObjectId};
use walrus_sdk::store_when::StoreWhen;
use walrus_sdk::{client::Client as WalrusClient, config::load_configuration};
use walrus_sui::client::{BlobPersistence, PostStoreAction, SuiContractClient};

use crate::server::Server;

const PUBLIC_TAR_PATH: &str = "public.tar";
const PRIVATE_TAR_PATH: &str = "private.tar";
const ERROR_MESSAGE_PATH: &str = "error_message.txt";

impl Server {
    pub async fn process_task(&self, task: &LancerRunTask) -> anyhow::Result<()> {
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
        let response = self
            .reqwest
            .post("http://localhost:9300/run")
            .multipart(form)
            .send()
            .await
            .unwrap()
            .bytes()
            .await?;
        println!("Received response: {:?}", response.len());
        let response: LancerRunResponse = bson::from_slice(&response)?;

        let mut blobs = vec![];
        if let Some(public_report) = response.public_report {
            blobs.push((PUBLIC_TAR_PATH.into(), public_report));
        }
        if let Some(private_report) = response.private_report {
            blobs.push((PRIVATE_TAR_PATH.into(), private_report));
        }
        if let Some(error_message) = response.error_message {
            blobs.push((ERROR_MESSAGE_PATH.into(), error_message));
        }
        print!(
            "Storing blobs {:?}",
            self.walrus.encoding_config().get_for_type(DEFAULT_ENCODING)
        );
        println!();
        println!();
        let results = self
            .walrus
            .reserve_and_store_blobs_retry_committees_with_path(
                &blobs,
                DEFAULT_ENCODING,
                5,
                StoreWhen::Always,
                BlobPersistence::Deletable,
                PostStoreAction::Keep,
            )
            .await?;

        // walrus.exchange_sui_for_wal(exchange_id, amount);
        let mut pt = ProgrammableTransactionBuilder::new();
        /*
        let tx = TransactionData::new_programmable(
            walrus.sui_client().address(),
            gas_payment,
            pt,
            gas_budget,
            gas_price,
        );*/

        let mut public_blob_object_id = None;
        let mut private_blob_object_id = None;
        let mut error_blob_object_id = None;
        for blob in results {
            let blob_object_id = match blob.blob_store_result {
                BlobStoreResult::AlreadyCertified {
                    blob_id,
                    event_or_object,
                    end_epoch,
                } => match event_or_object {
                    EventOrObjectId::Event(event_id) => bail!("No blob"),
                    EventOrObjectId::Object(object_id) => object_id,
                },
                BlobStoreResult::NewlyCreated {
                    blob_object,
                    resource_operation,
                    cost,
                    shared_blob_object,
                } => blob_object.id,
                BlobStoreResult::MarkedInvalid { blob_id, event } => bail!("Invalid blob"),
                BlobStoreResult::Error { blob_id, error_msg } => bail!("Error: {}", error_msg),
            };
            if blob.path.to_str().unwrap() == PUBLIC_TAR_PATH {
                public_blob_object_id = Some(blob_object_id);
            } else if blob.path.to_str().unwrap() == PRIVATE_TAR_PATH {
                private_blob_object_id = Some(blob_object_id);
            } else if blob.path.to_str().unwrap() == ERROR_MESSAGE_PATH {
                error_blob_object_id = Some(blob_object_id);
            }
        }

        if let Some(error_blob_object_id) = error_blob_object_id {
            todo!("Handle error");
        } else {
            let finding = self
                .sui_client
                .read_api()
                .get_object_with_options(task.finding_id, SuiObjectDataOptions::new().with_owner())
                .await?;

            let finding_arg = pt.obj(ObjectArg::SharedObject {
                id: task.finding_id,
                initial_shared_version: finding.owner().unwrap().start_version().unwrap(),
                mutable: true,
            })?;

            let blob_type = TypeTag::from_str(&format!(
                "{}::blob::Blob",
                self.walrus
                    .sui_client()
                    .read_client()
                    .get_system_package_id()
            ))
            .unwrap();
            let public_report_blob_arg = {
                let blob_obj = self
                    .sui_client
                    .read_api()
                    .get_object_with_options(public_blob_object_id.unwrap(), SuiObjectDataOptions::new())
                    .await?;
                pt.obj(ObjectArg::ImmOrOwnedObject(
                    blob_obj.object_ref_if_exists().unwrap(),
                ))?
            };

            let private_report_blob_arg = if let Some(blob_object_id) = private_blob_object_id {
                let blob_obj = self
                    .sui_client
                    .read_api()
                    .get_object_with_options(blob_object_id, SuiObjectDataOptions::new())
                    .await?;
                let inner = pt.obj(ObjectArg::ImmOrOwnedObject(
                    blob_obj.object_ref_if_exists().unwrap(),
                ))?;
                pt.programmable_move_call(
                    MOVE_STDLIB_PACKAGE_ID,
                    Identifier::new("option").unwrap(),
                    Identifier::new("some").unwrap(),
                    vec![blob_type.clone()],
                    vec![inner],
                )
            } else {
                pt.programmable_move_call(
                    MOVE_STDLIB_PACKAGE_ID,
                    Identifier::new("option").unwrap(),
                    Identifier::new("none").unwrap(),
                    vec![blob_type.clone()],
                    vec![],
                )
            };

            let enclave_id_arg = pt.pure(AccountAddress::ZERO)?;
            let timestamp_ms_arg = pt.pure(0u64)?;
            pt.programmable_move_call(
                self.lancer_id.into(),
                Identifier::new("finding")?,
                Identifier::new("commit_for_testing")?,
                vec![],
                vec![
                    finding_arg,
                    public_report_blob_arg,
                    private_report_blob_arg,
                    enclave_id_arg,
                    timestamp_ms_arg,
                ],
            );

            let (sender, gas_object) = self.wallet.get_one_gas_object().await.unwrap().unwrap();
            let gas_price = self.wallet.get_reference_gas_price().await.unwrap();
            let r = self.wallet
                .execute_transaction_must_succeed(self.wallet.sign_transaction(
                    &TransactionData::new_programmable(
                        sender,
                        vec![gas_object],
                        pt.finish(),
                        1000000000,
                        gas_price,
                    ),
                ))
                .await;
            println!("Transaction: {}", r.digest);
        }
        Ok(())
    }
}

pub async fn worker(
    server: Arc<Server>,
    mut receiver: mpsc::Receiver<LancerRunTask>,
) -> anyhow::Result<()> {
    while let Some(task) = receiver.recv().await {
        // Process the task
        server.process_task(&task).await.unwrap();
    }

    Ok(())
}
