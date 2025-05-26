use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Identity {
    pub public_key: Vec<u8>,
    pub attestation: Vec<u8>,
}