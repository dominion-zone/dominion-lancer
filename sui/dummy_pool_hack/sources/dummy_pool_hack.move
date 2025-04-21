module dummy_pool_hack::dummy_pool_hack;

// === Imports ===

use sui::balance::{Self, Balance};
use sui::coin::{Self, Coin, TreasuryCap};
use dummy_pool::dummy_pool::{Self, DummyPool};

// === Errors ===

// === Constants ===

// === Structs ===

public struct Hack has key {
    id: UID,
    balance: Balance<DUMMY_POOL_HACK>,
}

public struct DUMMY_POOL_HACK has drop {}

// === Events ===

// === Method Aliases ===

// === Public Functions ===

// === View Functions ===

// === Admin Functions ===

fun init(witness: DUMMY_POOL_HACK, ctx: &mut TxContext) {
}

// === Package Functions ===

// === Private Functions ===

// === Test Functions ===