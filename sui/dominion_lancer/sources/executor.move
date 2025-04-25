module dominion_lancer::executor;

// === Imports ===

use sui::versioned::{Self, Versioned};

use enclave::enclave::{Self, Enclave, Cap as EnclaveCap};

// === Errors ===

// === Constants ===

const Pcr0: vector<u8> = b"ABC";
const Pcr1: vector<u8> = b"DEF";
const Pcr2: vector<u8> = b"GHI";

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
    let enclave_cap = enclave::create_enclave_config(
        otw,
        b"Dominion Lancer Executor".to_string(),
        Pcr0,
        Pcr1,
        Pcr2,
        ctx
    );

    transfer::public_transfer(enclave_cap, ctx.sender());
}

// === Package Functions ===

// === Private Functions ===

// === Test Functions ===
