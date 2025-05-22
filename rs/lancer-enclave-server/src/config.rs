use std::{num::NonZeroU16, str::FromStr};

use fastcrypto::serde_helpers::ToFromByteArray;
use seal::IBEPublicKeys;
use serde::{Deserialize, Serialize};
use sui_types::base_types::ObjectID;

#[derive(Serialize, Deserialize, Debug)]
pub struct SealConfig {
    pub key_servers: Vec<ObjectID>,
    pub public_keys: IBEPublicKeys,
    pub treshold: u8,
}
/*
impl Default for SealConfig {
    fn default() -> Self {
        Self {
            key_servers: vec![
                ObjectID::from_str(
                    "0xb35a7228d8cf224ad1e828c0217c95a5153bafc2906d6f9c178197dce26fbcf8",
                )
                .unwrap(),
                ObjectID::from_str(
                    "0x2d6cde8a9d9a65bde3b0a346566945a63b4bfb70e9a06c41bdb70807e2502b06",
                )
                .unwrap(),
            ],
            public_keys: IBEPublicKeys::BonehFranklinBLS12381(vec![
                ToFromByteArray::from_byte_array(
                    &hex::decode("a040b5548bb0428fba159895c07080cbfdc76ef01bb88ca2ced5c85b07782e09970a1f5684e2a0dd3d3e31beb6cbd7ea02c49a3794b26c6d3d9ffdc99e4984cc981d0d72e933c2af3309216bf7011e9e82c7b68276882f18ba0ea7f45a7721db")
                    .unwrap().try_into().unwrap()).unwrap(),
                ToFromByteArray::from_byte_array(
                    &hex::decode("a8cb6f59027d14e0a3e97ea1bd79aa6a942f36ffc835f5025591c680d598a5541f087facb39fb12a1d9d71b3a510942b1760e5f6685f86660a4c38b178928bb6d0362a6c7e244985527832c783a8b5195db743ff2289de3b23226dad86cd70f1")
                    .unwrap().try_into().unwrap()).unwrap(),
            ]),
            treshold: 1,
        }
    }
}
*/

#[derive(Serialize, Deserialize, Debug)]
pub struct Config {
    pub seal: SealConfig,
    pub walrus_shards: NonZeroU16,
    pub lancer_id: ObjectID,
}

/*
impl Default for Config {
    fn default() -> Self {
        Self {
            seal: SealConfig::default(),
            walrus_shards: NonZeroU16::new(1000).unwrap(),
            lancer_id: ObjectID::from_str(
                "0xaf3dd531a92b3ff2b78ce6eed4e92405c808fe38cb3a7aba7d9451eb6265962a",
            )
            .unwrap(),
        }
    }
}
*/
