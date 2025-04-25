module dominion_lancer::bug_bounty;

// === Imports ===

use std::string::String;
use sui::bag::{Self, Bag};
use sui::versioned::{Self, Versioned};

// === Errors ===

const EUnknownVersion: u64 = 1;
const EInvalidOwnerCap: u64 = 2;

// === Constants ===

// === Structs ===

public struct BugBounty has key {
    id: UID,
    inner: Versioned,
}

public struct BugBountyV1 has store {
    owner_cap_id: ID,
    description: String,
    contract: ID,
    approves: Bag,
    is_active: bool,
}

public struct OwnerCap has key, store {
    id: UID,
    bug_bounty_id: ID,
}

// === Events ===

// === Method Aliases ===

// === Public Functions ===

// === View Functions ===

// === Admin Functions ===

public fun assert_owner_cap(
    self: &OwnerCap,
    bug_bounty: &BugBounty,
) {
    assert!(bug_bounty.owner_, EInvalidOwnerCap);
}

// === Package Functions ===

// === Private Functions ===

// === Test Functions ===