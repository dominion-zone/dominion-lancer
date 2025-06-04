use std::{env, str::FromStr, sync::Arc};

use anyhow::{Context, bail};
use base64::prelude::*;
use lancer_transport::{identity::Identity, task::LancerRunTask};
use move_core_types::account_address::AccountAddress;
use serde::{Deserialize, Serialize};
use sui_config::{PersistedConfig, SUI_CLIENT_CONFIG, sui_config_dir};
use sui_sdk::{
    SuiClient, SuiClientBuilder,
    rpc_types::{SuiData, SuiObjectDataOptions},
    sui_client_config::SuiClientConfig,
    wallet_context::WalletContext,
};
use sui_types::base_types::{ObjectID, ObjectRef, SequenceNumber};
use tokio::{
    sync::{RwLock, mpsc},
    task::JoinHandle,
};
use walrus_sdk::{client::Client as WalrusClient, config::load_configuration};
use walrus_sui::client::SuiContractClient;

use crate::config::Config;

pub struct Server {
    pub config: Config,
    pub enclave_config_ref: ObjectRef,
    pub sui_client: SuiClient,
    pub wallet: WalletContext,
    pub walrus: WalrusClient<SuiContractClient>,
    pub task_sender: mpsc::Sender<LancerRunTask>,
    pub identity: RwLock<Option<Identity>>,
}

impl Server {
    pub async fn new(
        config: Config,
    ) -> anyhow::Result<(Arc<Self>, JoinHandle<anyhow::Result<()>>)> {
        let (task_sender, receiver) = mpsc::channel(8);
        let walrus_config = load_configuration(
            Some(env::current_dir()?.join("walrus.yaml")),
            Some("testnet"),
        )?;
        println!("Walrus config: {:?}", walrus_config);
        let sui_client = SuiClientBuilder::default().build_testnet().await?;
        let wallet_conf = walrus_config
            .wallet_config
            .as_ref()
            .unwrap()
            .path()
            .map(|p| p.to_path_buf())
            .unwrap_or(sui_config_dir()?.join(SUI_CLIENT_CONFIG));
        // let mut client_config: SuiClientConfig = PersistedConfig::read(&wallet_conf)?;
        let wallet = WalletContext::new(&wallet_conf)?;
        let walrus_sui_client = walrus_config
            .new_contract_client_with_wallet_in_config(None)
            .await?;

        let refresh_handle = walrus_config
            .refresh_config
            .build_refresher_and_run(walrus_sui_client.read_client().clone())
            .await?;
        let walrus =
            WalrusClient::new_contract_client(walrus_config, refresh_handle, walrus_sui_client)
                .await?;
        
        let enclave_config_ref = sui_client
            .read_api()
            .get_object_with_options(
                config.enclave_config_id,
                SuiObjectDataOptions::new(),
            )
            .await?
            .object_ref_if_exists().context("Enclave config not found")?;

        // TODO: remove this
        /*
        {
            let object_ids = vec![
                ObjectID::from_str(
                    "0xb35a7228d8cf224ad1e828c0217c95a5153bafc2906d6f9c178197dce26fbcf8",
                )
                .unwrap(),
                ObjectID::from_str(
                    "0x2d6cde8a9d9a65bde3b0a346566945a63b4bfb70e9a06c41bdb70807e2502b06",
                )
                .unwrap(),
            ];
            let objects = sui_client
                .read_api()
                .multi_get_object_with_options(
                    object_ids.to_vec(),
                    SuiObjectDataOptions::full_content(),
                )
                .await
                .unwrap();

            let pks: Vec<String> = objects
                .into_iter()
                .map(|o| {
                    o.data
                        .unwrap()
                        .content
                        .unwrap()
                        .try_as_move()
                        .unwrap()
                        .fields
                        .field_value("pk")
                        .unwrap()
                        .to_json_value()
                        .as_array()
                        .unwrap()
                        .iter()
                        .map(|v| v.as_u64().unwrap() as u8)
                        .collect::<Vec<_>>()
                })
                .map(|v| hex::encode(&v))
                .collect();
            println!("Public keys: {:?}", pks);
        }*/

        let server = Arc::new(Server {
            sui_client,
            enclave_config_ref,
            config,
            task_sender,
            walrus,
            wallet,
            identity: RwLock::new(None),
        });

        let worker = tokio::spawn(server.clone().worker(receiver));

        Ok((server, worker))
    }

    pub async fn identity(&self) -> anyhow::Result<Identity> {
        let identity = self.identity.read().await;
        identity
            .as_ref()
            .cloned()
            .context("Identity not set, not connected to the enclave")
    }
    
    pub async fn set_identity(&self, identity: Identity) {
        *self.identity.write().await = Some(identity);
    }

    pub async fn reset_identity(&self) {
        *self.identity.write().await = None;
    }
}
