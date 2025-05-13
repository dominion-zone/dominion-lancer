use sui_types::base_types::ObjectID;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct LancerRunTask {
    pub iv: Vec<u8>,
    pub encrypted_file: Vec<u8>,
    pub encrypted_key: Vec<u8>,
    pub bug_bounty_id: ObjectID,
    pub finding_id: ObjectID,
    pub escrow_id: ObjectID,
}