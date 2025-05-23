use std::str::FromStr;

use serde::{Deserialize, Serialize};
use sui_types::base_types::ObjectID;

#[derive(Serialize, Deserialize, Debug)]
pub struct Config {
    pub lancer_id: ObjectID,
    pub finding_origin_id: ObjectID,
    pub runner_id: ObjectID,
    pub cors: bool,
}

/*
impl Default for Config {
    fn default() -> Self {
        Self {
            lancer_id: ObjectID::from_str(
                "0xb472abe6694550c624e46715a1aa9bdd1ad060bb50ee6ebccb068a9922d24d87",
            )
            .unwrap(),
            finding_origin_id: ObjectID::from_str(
                "0xaf3dd531a92b3ff2b78ce6eed4e92405c808fe38cb3a7aba7d9451eb6265962a",
            )
            .unwrap(),
            runner_id: ObjectID::from_str(
                "0xe173c15f4ee89ca7616c81b32bad6263733ee13c3c68f1cbcc14c28bde6e6a13",
            )
            .unwrap(),
            cors: false,
        }
    }
}
*/
