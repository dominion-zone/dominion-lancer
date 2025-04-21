module dummy_pool::some_coin;

// === Imports ===

use sui::balance::{Self, Balance};
use sui::coin::{Self, Coin, TreasuryCap};

// === Errors ===

// === Constants ===

// === Structs ===

public struct SOME_COIN has drop {}

// === Events ===

// === Method Aliases ===

// === Entry Fucntions ===

// === Public Functions ===

// === View Functions ===

// === Admin Functions ===

fun init(witness: SOME_COIN, ctx: &mut TxContext) {
    let (mut treasury_cap, metadata) = coin::create_currency(
				witness,
				6,
				b"SOME",
				b"Some coin",
				b"Test coin for the dummy pool",
				option::none(),
				ctx,
		);
    transfer::public_freeze_object(metadata);
    treasury_cap.mint_and_transfer(10_000_000, ctx.sender(), ctx);
    transfer::public_freeze_object(treasury_cap);
}