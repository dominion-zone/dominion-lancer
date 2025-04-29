module dummy_pool::dummy_pool;

// === Imports ===

use sui::balance::{Self, Balance};
use sui::coin::{Self, Coin, TreasuryCap};

// === Errors ===

// === Constants ===

// === Structs ===

public struct DUMMY_POOL has drop {}

public struct DummyPool has key {
    id: UID,
    treasury_cap: TreasuryCap<DUMMY_POOL>,
    vault_count: u64,
}

public struct Vault<phantom T> has key {
    id: UID,
    pool_id: ID,
    balance: Balance<T>,
    price_bp: u64,
}

public struct VaultAdminCap<phantom T> has key {
    id: UID,
    vault_id: ID,
}

// === Events ===

// === Method Aliases ===

// === Entry Fucntions ===

public entry fun deposit<T>(
    self: &mut DummyPool,
    vault: &mut Vault<T>,
    coin: Coin<T>,
    ctx: &mut TxContext,
) {
    let balance = deposit_balance(self, vault, coin.into_balance());
    let coin = balance.into_coin(ctx);
    transfer::public_transfer(coin, ctx.sender());
}

public entry fun withdraw<T>(
    self: &mut DummyPool,
    vault: &mut Vault<T>,
    coin: Coin<DUMMY_POOL>,
    ctx: &mut TxContext,
) {
    let balance = withdraw_balance(self, vault, coin.into_balance());
    let coin = balance.into_coin(ctx);
    transfer::public_transfer(coin, ctx.sender());
}

// === Public Functions ===

public entry fun create_vault<T>(
    self: &mut DummyPool,
    price_bp: u64,
    ctx: &mut TxContext
) {
    let vault = Vault<T> {
        id: object::new(ctx),
        pool_id: self.id.to_inner(),
        balance: balance::zero(),
        price_bp,
    };
    let vault_admin_cap = VaultAdminCap<T> {
        id: object::new(ctx),
        vault_id: vault.id.to_inner(),
    };
    self.vault_count = self.vault_count + 1;
    transfer::share_object(vault);
    transfer::transfer(vault_admin_cap, ctx.sender());
}

public entry fun set_vault_price<T>(
    self: &VaultAdminCap<T>,
    vault: &mut Vault<T>,
    price_bp: u64,
) {
    assert!(vault.pool_id == self.vault_id);
    vault.price_bp = price_bp;
}

public fun deposit_balance<T>(
    self: &mut DummyPool,
    vault: &mut Vault<T>,
    balance: Balance<T>,
): Balance<DUMMY_POOL> {
    let value = balance.value();
    vault.balance.join(balance);
    self.treasury_cap.mint_balance(((value as u128) * (vault.price_bp as u128) / 10000) as u64)
}

public fun withdraw_balance<T>(
    self: &mut DummyPool,
    vault: &mut Vault<T>,
    balance: Balance<DUMMY_POOL>,
): Balance<T> {
    let value = balance.value();
    self.treasury_cap.supply_mut().decrease_supply(balance);
    vault.balance.split(((value as u128) * 10000 / (vault.price_bp as u128)) as u64)
}

// === View Functions ===

// === Admin Functions ===

fun init(witness: DUMMY_POOL, ctx: &mut TxContext) {
    let (treasury_cap, metadata) = coin::create_currency(
				witness,
				6,
				b"DPL",
				b"Dummy Pool",
				b"Dummy Pool Liquidity",
				option::none(),
				ctx,
		);
        transfer::public_freeze_object(metadata);
    let self = DummyPool {
        id: object::new(ctx),
        treasury_cap,
        vault_count: 0,
    };
    transfer::share_object(self);
}

// === Package Functions ===

// === Private Functions ===

// === Test Functions ===