use std::collections::HashSet;

use serde::{Deserialize, Serialize};
use sui_types::base_types::{ObjectID, SuiAddress};



#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Reporting {
    Public,
    Partial {
        owned_by: HashSet<SuiAddress>,
        objects: HashSet<ObjectID>,
    },
    HidingObjects(HashSet<ObjectID>),
}
