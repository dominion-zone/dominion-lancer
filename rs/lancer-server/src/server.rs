use std::{env, sync::Arc};

use lancer_transport::task::LancerRunTask;
use move_core_types::account_address::AccountAddress;
use sui_config::{sui_config_dir, PersistedConfig, SUI_CLIENT_CONFIG};
use sui_sdk::{sui_client_config::SuiClientConfig, wallet_context::WalletContext, SuiClient, SuiClientBuilder};
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

        let server = Arc::new(Server {
            sui_client,
            lancer_id: AccountAddress::from_hex_literal(
                "0xaf3dd531a92b3ff2b78ce6eed4e92405c808fe38cb3a7aba7d9451eb6265962a",
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
