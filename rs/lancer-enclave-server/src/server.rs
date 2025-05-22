use std::{num::NonZero, str::FromStr, sync::Arc};

use base64::prelude::*;
use lancer_transport::response::EncryptedBlobData;
use rsa::RsaPrivateKey;
use rsa::pkcs8::EncodePublicKey;
use seal::{
    EncryptedObject, EncryptionInput, IBEPublicKeys,
    ibe::{self, PublicKey},
    seal_encrypt,
};
use serde::{Deserialize, Serialize};
use sui_types::base_types::ObjectID;
use tokio::sync::RwLock;
use walrus_core::{
    BlobId, DEFAULT_ENCODING, EncodingType,
    encoding::{EncodingConfig, EncodingConfigTrait},
};

use crate::{config::Config, task::Task};

pub struct Server {
    pub rsa_private_key: RsaPrivateKey,
    pub encoding_config: EncodingConfig,
    pub config: Config,
    pub task: RwLock<Option<Arc<Task>>>,
}

impl Server {
    pub fn new(config: Config) -> Self {
        let mut rng = rand::thread_rng();
        let rsa_private_key = RsaPrivateKey::new(&mut rng, 2048).unwrap();
        Server {
            rsa_private_key,
            encoding_config: EncodingConfig::new(config.walrus_shards),
            config,
            task: RwLock::new(None),
        }
    }

    pub fn get_public_key(&self) -> String {
        let public_key = self.rsa_private_key.to_public_key();
        let spki_der = public_key.to_public_key_der().unwrap().as_ref().to_vec();
        BASE64_STANDARD.encode(&spki_der)
    }

    pub fn get_blob_id(&self, blob: &[u8]) -> anyhow::Result<BlobId> {
        let (_pairs, metadata) = self
            .encoding_config
            .get_for_type(DEFAULT_ENCODING)
            .encode_with_metadata(blob)?;
        Ok(metadata.blob_id().clone())
    }

    /*
    pub async fn task_status(&self) -> Option<TaskStatus> {
        let task = self.task.read().await;
        task.as_ref().map(|t| TaskStatus {
            id: t.id.clone(),
            status: t.get_status(),
        })
    }*/

    pub fn lancer_id(&self) -> ObjectID {
        self.config.lancer_id
    }

    pub fn encrypt(
        &self,
        id: Vec<u8>,
        input: EncryptionInput,
    ) -> anyhow::Result<EncryptedBlobData> {
        let (object, _) = seal_encrypt(
            seal::ObjectID::from_bytes(&self.lancer_id().to_vec()).unwrap(),
            id.clone(),
            self.config
                .seal
                .key_servers
                .iter()
                .map(|s| seal::ObjectID::from_bytes(&s.to_vec()).unwrap())
                .collect(),
            &self.config.seal.public_keys,
            self.config.seal.treshold,
            input,
        )?;
        let data = bcs::to_bytes(&object)?;
        let blob_id = self.get_blob_id(&data)?;
        Ok(EncryptedBlobData { object, blob_id })
    }
}
