module dominion_lancer::executor;

// === Imports ===

use sui::versioned::{Self, Versioned};

use enclave::enclave::{Self, Enclave, Cap as EnclaveCap};

// === Errors ===

// === Constants ===

// === Structs ===

public struct EXECUTOR has drop {}

// === Events ===

// === Method Aliases ===

// === Public Functions ===

// === View Functions ===

// === Admin Functions ===

fun init(
    otw: EXECUTOR,
    ctx: &mut TxContext,
) {
    let enclave_cap = enclave::new_cap(otw, ctx);

    transfer::public_transfer(enclave_cap, ctx.sender());
}

// === Package Functions ===

// === Private Functions ===

// === Test Functions ===
