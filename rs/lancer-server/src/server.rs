use std::{env, str::FromStr, sync::Arc};

use lancer_transport::task::LancerRunTask;
use move_core_types::account_address::AccountAddress;
use sui_config::{PersistedConfig, SUI_CLIENT_CONFIG, sui_config_dir};
use sui_sdk::{
    rpc_types::{SuiData, SuiObjectDataOptions}, sui_client_config::SuiClientConfig, wallet_context::WalletContext, SuiClient, SuiClientBuilder
};
use sui_types::base_types::ObjectID;
use tokio::{sync::mpsc, task::JoinHandle};
use walrus_sdk::{client::Client as WalrusClient, config::load_configuration};
use walrus_sui::client::SuiContractClient;

use crate::worker::worker;

pub struct Server {
    pub sui_client: SuiClient,
    pub wallet: WalletContext,
    pub reqwest: reqwest::Client,
    pub walrus: WalrusClient<SuiContractClient>,
    pub lancer_id: AccountAddress,
    pub runner_id: AccountAddress,
    pub task_sender: mpsc::Sender<LancerRunTask>,
}

impl Server {
    pub async fn new() -> anyhow::Result<(Arc<Self>, JoinHandle<anyhow::Result<()>>)> {
        let (task_sender, receiver) = mpsc::channel(8);
        let reqwest = reqwest::Client::new();
        let config = load_configuration(
            Some(env::current_dir()?.join("walrus.yaml")),
            Some("testnet"),
        )?;
        println!("Config: {:?}", config);
        let sui_client = SuiClientBuilder::default().build_testnet().await?;
        let wallet_conf = config
            .wallet_config
            .as_ref()
            .unwrap()
            .path()
            .map(|p| p.to_path_buf())
            .unwrap_or(sui_config_dir()?.join(SUI_CLIENT_CONFIG));
        // let mut client_config: SuiClientConfig = PersistedConfig::read(&wallet_conf)?;
        let wallet = WalletContext::new(&wallet_conf, None, None)?;
        let walrus_sui_client = config
            .new_contract_client_with_wallet_in_config(None)
            .await?;

        let refresh_handle = config
            .refresh_config
            .build_refresher_and_run(walrus_sui_client.read_client().clone())
            .await?;
        let walrus =
            WalrusClient::new_contract_client(config, refresh_handle, walrus_sui_client).await?;

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
            lancer_id: AccountAddress::from_hex_literal(
                "0xb472abe6694550c624e46715a1aa9bdd1ad060bb50ee6ebccb068a9922d24d87",
            )
            .unwrap(),
            runner_id: AccountAddress::from_hex_literal(
                "0xe173c15f4ee89ca7616c81b32bad6263733ee13c3c68f1cbcc14c28bde6e6a13",
            )
            .unwrap(),
            task_sender,
            reqwest,
            walrus,
            wallet,
        });

        let worker = tokio::spawn(worker(server.clone(), receiver));

        Ok((server, worker))
    }
}
