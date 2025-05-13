use move_core_types::account_address::AccountAddress;
use sui_sdk::{SuiClient, SuiClientBuilder};
use tokio::{sync::mpsc, task::JoinHandle};
use lancer_transport::task::LancerRunTask;

use crate::worker::{worker};

pub struct Server {
    pub client: SuiClient,
    pub lancer_id: AccountAddress,
    pub runner_id: AccountAddress,
    pub worker: JoinHandle<anyhow::Result<()>>,
    pub task_sender: mpsc::Sender<LancerRunTask>,
}

impl Server {
    pub async fn new() -> Self {
        let (task_sender, receiver) = mpsc::channel(8);
        Server {
            client: SuiClientBuilder::default().build_devnet().await.unwrap(),
            lancer_id: AccountAddress::from_hex_literal(
                "0x5920e903abb54e7a02303dcb254a1760c460dd824619d12edb0c2d1eb6c6926c",
            )
            .unwrap(),
            runner_id: AccountAddress::from_hex_literal("0x0d5dd4147810f3e1f55ea973813d7a584dc0870216460a9f3b11e22251c7a820").unwrap(),
            task_sender,
            worker: tokio::spawn(worker(receiver)),
        }
    }
}
