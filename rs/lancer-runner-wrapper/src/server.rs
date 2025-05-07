use base64::prelude::*;
use rsa::RsaPrivateKey;
use rsa::pkcs8::EncodePublicKey;
use serde::{Deserialize, Serialize};
use tokio::sync::RwLock;

use crate::task::{Status, Task};

pub struct Server {
    pub rsa_private_key: RsaPrivateKey,
    pub task: RwLock<Option<Task>>,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct TaskStatus {
    pub id: Vec<u8>, // signature
    pub status: Status,
}

impl Server {
    pub fn new() -> Self {
        let mut rng = rand::thread_rng();
        let rsa_private_key = RsaPrivateKey::new(&mut rng, 2048).unwrap();
        Server {
            rsa_private_key,
            task: RwLock::new(None),
        }
    }

    pub fn get_public_key(&self) -> String {
        let public_key = self.rsa_private_key.to_public_key();
        let spki_der = public_key.to_public_key_der().unwrap().as_ref().to_vec();
        BASE64_STANDARD.encode(&spki_der)
    }

    pub async fn task_status(&self) -> Option<TaskStatus> {
        let task = self.task.read().await;
        task.as_ref().map(|t| TaskStatus {
            id: t.id.clone(),
            status: t.get_status(),
        })
    }
}
