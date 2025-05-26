use std::str::FromStr;
use std::sync::Arc;

use anyhow::{Context, bail};
use futures::{SinkExt, StreamExt};
use lancer_transport::identity::Identity;
use lancer_transport::{response::LancerRunResponse, task::LancerRunTask};
use move_core_types::account_address::AccountAddress;
use seal::ObjectID as SealObjectID;
use sui_sdk::rpc_types::{SuiObjectDataOptions, SuiTransactionBlockEffectsAPI};
use sui_types::base_types::{ObjectID, ObjectRef, SequenceNumber};
use sui_types::programmable_transaction_builder::ProgrammableTransactionBuilder;
use sui_types::transaction::{ObjectArg, TransactionData};
use sui_types::{Identifier, MOVE_STDLIB_PACKAGE_ID, SUI_FRAMEWORK_PACKAGE_ID, TypeTag};
use tokio::sync::mpsc;
use tokio_util::{
    bytes::Bytes,
    codec::{Framed, LengthDelimitedCodec},
};
use tokio_vsock::{VsockAddr, VsockListener};
use walrus_core::DEFAULT_ENCODING;
use walrus_sdk::client::responses::{BlobStoreResult, EventOrObjectId};
use walrus_sdk::store_when::StoreWhen;
use walrus_sui::client::{BlobPersistence, PostStoreAction};

use crate::server::Server;

const PUBLIC_TAR_PATH: &str = "public.tar";
const PRIVATE_TAR_PATH: &str = "private.tar";
const ERROR_MESSAGE_PATH: &str = "error_message.txt";

const VMADDR_CID_ANY: u32 = 0xFFFFFFFF;

impl Server {
    pub async fn process_response(
        &self,
        task: &LancerRunTask,
        response: LancerRunResponse,
        enclave_ref: Option<ObjectRef>,
    ) -> anyhow::Result<()> {
        let mut blobs = vec![];
        if let Some(public_report) = response.public_report {
            blobs.push((PUBLIC_TAR_PATH.into(), bcs::to_bytes(&public_report)?));
        }
        if let Some(private_report) = response.private_report {
            blobs.push((PRIVATE_TAR_PATH.into(), bcs::to_bytes(&private_report)?));
        }
        if let Some(error_message) = response.error_message {
            blobs.push((ERROR_MESSAGE_PATH.into(), bcs::to_bytes(&error_message)?));
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
        let enclave_id_arg = pt.pure(AccountAddress::ZERO)?;
        let timestamp_ms_arg = pt.pure(0u64)?;

        let blob_type = TypeTag::from_str(&format!(
            "{}::blob::Blob",
            self.walrus
                .sui_client()
                .read_client()
                .get_system_package_id()
        ))
        .unwrap();

        if let Some(error_blob_object_id) = error_blob_object_id {
            let error_blob_arg = {
                let blob_obj = self
                    .sui_client
                    .read_api()
                    .get_object_with_options(error_blob_object_id, SuiObjectDataOptions::new())
                    .await?;
                pt.obj(ObjectArg::ImmOrOwnedObject(
                    blob_obj.object_ref_if_exists().unwrap(),
                ))?
            };

            pt.programmable_move_call(
                self.config.lancer_id.clone(),
                Identifier::new("finding")?,
                Identifier::new("report_error_for_testing")?,
                vec![],
                vec![
                    finding_arg,
                    error_blob_arg,
                    enclave_id_arg,
                    timestamp_ms_arg,
                ],
            );
        } else {
            let public_report_blob_arg = {
                let blob_obj = self
                    .sui_client
                    .read_api()
                    .get_object_with_options(
                        public_blob_object_id.unwrap(),
                        SuiObjectDataOptions::new(),
                    )
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
            pt.programmable_move_call(
                self.config.lancer_id.clone(),
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
        }

        let (sender, gas_object) = self.wallet.get_one_gas_object().await.unwrap().unwrap();
        let gas_price = self.wallet.get_reference_gas_price().await.unwrap();
        let r = self
            .wallet
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
        Ok(())
    }

    async fn destroy_enclave(
        &self,
        (id, initial_shared_version, _): ObjectRef,
    ) -> anyhow::Result<()> {
        let mut pt = ProgrammableTransactionBuilder::new();
        let enclave_arg = pt.obj(ObjectArg::SharedObject {
            id,
            initial_shared_version,
            mutable: true,
        })?;
        pt.programmable_move_call(
            self.config.nautilus_id,
            Identifier::new("finding")?,
            Identifier::new("deploy_old_enclave_by_owner")?,
            vec![
                TypeTag::from_str(&format!(
                    "{}::executor::EXECUTOR",
                    self.config.executor_origin_id
                ))
                .unwrap(),
            ],
            vec![enclave_arg],
        );
        let (sender, gas_object) = self.wallet.get_one_gas_object().await?.unwrap();
        let gas_price = self.wallet.get_reference_gas_price().await?;
        let r = self
            .wallet
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
        println!("Enclave destroyed: {}", r.digest);
        Ok(())
    }

    async fn register_enclave(&self, identity: Identity) -> anyhow::Result<ObjectRef> {
        let mut pt = ProgrammableTransactionBuilder::new();
        let document_arg = pt.pure(identity.attestation)?;
        let attestation_arg = pt.programmable_move_call(
            SUI_FRAMEWORK_PACKAGE_ID,
            Identifier::new("nitro_attestation")?,
            Identifier::new("load_nitro_attestation")?,
            vec![],
            vec![document_arg],
        );
        let enclave_config_arg = pt.obj(ObjectArg::SharedObject {
            id: self.enclave_config_ref.0,
            initial_shared_version: self.enclave_config_ref.1,
            mutable: false,
        })?;
        pt.programmable_move_call(
            self.config.nautilus_id.clone(),
            Identifier::new("enclave")?,
            Identifier::new("register")?,
            vec![
                TypeTag::from_str(&format!(
                    "{}::executor::EXECUTOR",
                    self.config.executor_origin_id
                ))
                .unwrap(),
            ],
            vec![enclave_config_arg, attestation_arg],
        );
        let (sender, gas_object) = self.wallet.get_one_gas_object().await?.unwrap();
        let gas_price = self.wallet.get_reference_gas_price().await?;
        let r = self
            .wallet
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
        if !r.status_ok().unwrap() {
            bail!("Failed to register enclave: {}", r.errors.join(", "));
        }
        let enclave_ref = r
            .effects
            .unwrap()
            .shared_objects()
            .into_iter()
            .next()
            .expect("Must be one object shared")
            .clone();
        println!("Enclave registered: {}", r.digest);
        Ok((enclave_ref.object_id, enclave_ref.version, enclave_ref.digest))
    }

    pub async fn worker(
        self: Arc<Server>,
        mut receiver: mpsc::Receiver<LancerRunTask>,
    ) -> anyhow::Result<()> {
        let listener = VsockListener::bind(VsockAddr::new(VMADDR_CID_ANY, self.config.vsock_port))
            .context("Failed to bind VSOCK listener")?;
        println!(
            "[worker] listening on VSOCK port {}",
            self.config.vsock_port
        );

        let mut backlog = None;

        struct EnclaveInfo {
            enclave_ref: ObjectRef,
            identity: Identity,
        }
        let mut last_used_enclave: Option<EnclaveInfo> = None;

        loop {
            self.reset_identity().await;
            println!("[worker] waiting for enclave connection...");
            let (stream, addr) = listener.accept().await.context("Failed to accept VSOCK")?;
            println!("[worker] accepted connection from CID {}", addr.cid());
            let mut stream = Framed::new(stream, LengthDelimitedCodec::new());
            let identity: Identity = if let Some(Ok(identity_bytes)) = stream.next().await {
                bcs::from_bytes(&identity_bytes).expect("Failed to deserialize identity")
            } else {
                println!("[worker] failed to receive identity, connection lost");
                continue;
            };
            self.set_identity(identity.clone()).await;
            let refresh_enclave = if let Some(info) = &last_used_enclave {
                info.identity != identity
            } else {
                true
            };
            if refresh_enclave {
                if let Some(old) = last_used_enclave.take() {
                    if let Err(e) = self
                        .destroy_enclave(old.enclave_ref)
                        .await
                    {
                        println!(
                            "[worker] failed to destroy old enclave {}: {}",
                            old.enclave_ref.0, e
                        );
                    }
                }
                if let Ok(enclave_ref) =
                    self.register_enclave(identity.clone()).await
                {
                    last_used_enclave = Some(EnclaveInfo {
                        enclave_ref,
                        identity,
                    });
                } else {
                    println!("[worker] failed to register enclave, skipping");
                    continue;
                }
            };

            while let Some(task) = next_task(&mut backlog, &mut receiver).await {
                println!("[worker] sending task: {}", task.finding_id);

                if stream
                    .send(Bytes::from(
                        bcs::to_bytes(&task).expect("Failed to serialize task"),
                    ))
                    .await
                    .is_err()
                {
                    backlog = Some(task);
                    println!("[worker] failed to send task, connection lost");
                    break;
                };

                let response: std::result::Result<LancerRunResponse, String> =
                    if let Some(Ok(response)) = stream.next().await {
                        bcs::from_bytes(&response).expect("Failed to deserialize response")
                    } else {
                        println!("[worker] failed to receive response, connection lost");
                        backlog = Some(task);
                        break;
                    };

                match response {
                    Ok(response) => {
                        if self
                            .process_response(
                                &task,
                                response,
                                last_used_enclave
                                    .as_ref()
                                    .map(|info| info.enclave_ref.clone()),
                            )
                            .await
                            .is_err()
                        {
                            println!(
                                "[worker] failed to process response for task: {}",
                                task.finding_id
                            );
                        } else {
                            println!("[worker] successfully processed task: {}", task.finding_id);
                        }
                    }
                    Err(e) => {
                        println!(
                            "[worker] received error response {} for task: {}",
                            e, task.finding_id
                        );
                    }
                }
            }

            // Not reconnecting means receiver is closed
            if backlog.is_none() {
                return Ok(());
            }
        }
    }
}

async fn next_task(
    backlog: &mut Option<LancerRunTask>,
    rx: &mut mpsc::Receiver<LancerRunTask>,
) -> Option<LancerRunTask> {
    if let Some(task) = backlog.take() {
        Some(task)
    } else {
        rx.recv().await
    }
}
