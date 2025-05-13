use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct LancerRunResponse {
    pub public_report: Option<Vec<u8>>,
    pub private_report: Option<Vec<u8>>,
    pub error_message: Option<Vec<u8>>,
    pub signature: Vec<u8>,
}
