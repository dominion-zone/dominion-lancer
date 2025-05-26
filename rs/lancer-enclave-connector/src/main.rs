use std::{any, sync::Arc, time::Duration};

use anyhow::Context;
use config::Config;
use futures::{SinkExt, StreamExt};
use lancer_transport::{identity::Identity, task::LancerRunTask};
use state::State;
use task::Task;
use tokio::fs;
use tokio_util::{
    bytes::Bytes,
    codec::{Framed, LengthDelimitedCodec},
};
use tokio_vsock::{VsockAddr, VsockStream};

pub mod config;
pub mod state;
pub mod task;

const VMADDR_CID_PARENT: u32 = 3;
const RECONNECT_DELAY_SECS: Duration = Duration::from_secs(1);

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // fs::write("lancer-enclave-connector.json", &serde_json::to_vec_pretty(&Config::default())?).await?;
    let config: Config = serde_json::from_slice(&fs::read("lancer-enclave-connector.json").await?)?;
    let state = Arc::new(State::new(config.clone())?);

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

    let identity = Identity {
        decryption_public_key: state.get_decryption_public_key(),
        attestation: state.attestation.clone(),
    };

    stream
        .send(Bytes::from(
            bcs::to_bytes(&identity).expect("Error serializing identity"),
        ))
        .await?;

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
