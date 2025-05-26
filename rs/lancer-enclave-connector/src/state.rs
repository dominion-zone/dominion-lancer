use std::{num::NonZero, str::FromStr, sync::Arc};

use anyhow::bail;
use aws_nitro_enclaves_nsm_api::api::{Request as NsmRequest, Response as NsmResponse};
use aws_nitro_enclaves_nsm_api::driver;
use base64::prelude::*;
use fastcrypto::ed25519::Ed25519KeyPair;
use fastcrypto::traits::KeyPair;
use lancer_transport::response::EncryptedBlobData;
use rsa::RsaPrivateKey;
use rsa::pkcs8::EncodePublicKey;
use seal::{
    EncryptedObject, EncryptionInput, IBEPublicKeys,
    ibe::{self, PublicKey},
    seal_encrypt,
};
use serde::{Deserialize, Serialize};
use serde_bytes::ByteBuf;
use sui_types::base_types::ObjectID;
use sui_types::crypto::ToFromBytes;
use tokio::sync::RwLock;
use walrus_core::{
    BlobId, DEFAULT_ENCODING, EncodingType,
    encoding::{EncodingConfig, EncodingConfigTrait},
};

use crate::{config::Config, task::Task};

pub struct State {
    pub decryption_private_key: RsaPrivateKey,
    pub signing_private_key: Ed25519KeyPair,
    pub attestation: Vec<u8>,
    pub encoding_config: EncodingConfig,
    pub config: Config,
    pub task: RwLock<Option<Arc<Task>>>,
}

impl State {
    pub fn new(config: Config) -> anyhow::Result<Self> {
        let mut rng = rand::thread_rng();
        let decryption_private_key = RsaPrivateKey::new(&mut rng, 2048).unwrap();

        let signing_private_key = Ed25519KeyPair::generate(&mut rng);
        let signing_public_key = signing_private_key.public();

        let fd = driver::nsm_init();

        // Send attestation request to NSM driver with public key set.
        let request = NsmRequest::Attestation {
            user_data: None,
            nonce: None,
            public_key: Some(ByteBuf::from(signing_public_key.as_bytes())),
        };

        let response = driver::nsm_process_request(fd, request);
        driver::nsm_exit(fd);
        let attestation = match response {
            NsmResponse::Attestation { document } => {
                driver::nsm_exit(fd);
                document
            }
            _ => {
                // TODO:
                /*
                bail!(
                    "Failed to get attestation from NSM driver. Expected Attestation response, got: {:?}",
                    response
                );
                */
                println!(
                    "Failed to get attestation from NSM driver. Expected Attestation response, got: {:?}",
                    response
                );
                vec![]
            }
        };
        Ok(State {
            decryption_private_key,
            signing_private_key,
            attestation,
            encoding_config: EncodingConfig::new(config.walrus_shards),
            config,
            task: RwLock::new(None),
        })
    }

    pub fn get_decryption_public_key(&self) -> Vec<u8> {
        self.decryption_private_key
            .to_public_key()
            .to_public_key_der()
            .unwrap()
            .as_ref()
            .to_vec()
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
