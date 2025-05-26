use std::{any, sync::Arc, time::Duration};

use anyhow::Context;
use config::Config;
use futures::{SinkExt, StreamExt};
use lancer_transport::task::LancerRunTask;
use state::State;
use task::Task;
use tokio::{fs, io::AsyncWriteExt, net::TcpListener};
use tokio_util::{
    bytes::Bytes,
    codec::{Framed, LengthDelimitedCodec},
};
use tokio_vsock::{VsockAddr, VsockListener, VsockStream};

pub mod config;
pub mod state;
pub mod task;

const VMADDR_CID_PARENT: u32 = 3;
const RECONNECT_DELAY_SECS: Duration = Duration::from_secs(1);

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // fs::write("lancer-enclave-connector.json", &serde_json::to_vec_pretty(&Config::default())?).await?;
    let config: Config = serde_json::from_slice(&fs::read("lancer-enclave-connector.json").await?)?;
    let state = Arc::new(State::new(config.clone()));

    loop {
        match run(state.clone()).await {
            Ok(_) => {
                println!("Connection ended gracefully. Reconnecting...");
            }
            Err(e) => {
                eprintln!("Error: {:?}. Reconnecting...", e);
            }
        }

        tokio::time::sleep(RECONNECT_DELAY_SECS).await;
    }
}

async fn run(state: Arc<State>) -> anyhow::Result<()> {
    let stream = VsockStream::connect(VsockAddr::new(VMADDR_CID_PARENT, state.config.port))
        .await
        .context("Failed to connect to host VSOCK")?;
    let mut stream = Framed::new(stream, LengthDelimitedCodec::new());

    println!(
        "Connected to host on CID={} PORT={}",
        VMADDR_CID_PARENT, state.config.port
    );

    stream.send(Bytes::from(state.get_public_key())).await?;

    loop {
        let task = stream
            .next()
            .await
            .context("Failed to read from stream")?
            .context("Stream closed unexpectedly")?;
        let task: LancerRunTask = bcs::from_bytes(&task).expect("Failed to deserialize task");
        let response = Task::run(state.clone(), &task).await;
        stream
            .send(Bytes::from(
                bcs::to_bytes(&response.map_err(|e| e.to_string()))
                    .expect("Failed to serialize response"),
            ))
            .await?;
    }
}
