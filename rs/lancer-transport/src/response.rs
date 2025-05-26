use seal::EncryptedObject;
use serde::{Deserialize, Serialize};
use walrus_core::BlobId;

#[derive(Debug, Serialize, Deserialize)]
pub struct EncryptedBlobData {
    pub object: EncryptedObject,
    pub blob_id: BlobId,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LancerRunResponse {
    pub public_report: Option<EncryptedBlobData>,
    pub private_report: Option<EncryptedBlobData>,
    pub error_message: Option<EncryptedBlobData>,
    pub timestamp_ms: u64,
    pub signature: Vec<u8>,
}
