module dominion_lancer::payment;

// === Imports ===

use std::type_name::{Self, TypeName};
use sui::dynamic_field as df;
use sui::balance::{Self, Balance};

// === Errors ===

const ETypeMismatch: u64 = 0;

// === Constants ===

const VAULT_FIELD_NAME: vector<u8> = b"vault";

// === Structs ===

public struct PaymentV1 has key, store {
    id: UID,
    coin_type: TypeName,
    requested: u64,
    paid: u64,
}

// === Events ===

// === Method Aliases ===

// === Public Functions ===

public fun create<C>(requested: u64, ctx: &mut TxContext): PaymentV1 {
    let mut self = PaymentV1 {
        id: object::new(ctx),
        coin_type: type_name::get<C>(),
        requested,
        paid: 0,
    };
    df::add(&mut self.id, VAULT_FIELD_NAME, balance::zero<C>());
    self
}

// === View Functions ===

public fun coin_type(self: &PaymentV1): TypeName {
    self.coin_type
}

public fun requested(self: &PaymentV1): u64 {
    self.requested
}

public fun paid(self: &PaymentV1): u64 {
    self.paid
}

public fun is_paid(self: &PaymentV1): bool {
    self.paid >= self.requested
}

// === Admin Functions ===

// === Package Functions ===

public(package) fun pay<C>(
    self: &mut PaymentV1,
    balance: Balance<C>,
) {
    assert!(type_name::get<C>() == self.coin_type, ETypeMismatch);
    let vault: &mut Balance<C> = df::borrow_mut(&mut self.id, VAULT_FIELD_NAME);
    self.paid = self.paid + balance.value();
    vault.join(balance);
}

public(package) fun withdraw_all<C>(
    self: &mut PaymentV1
): Balance<C> {
    assert!(type_name::get<C>() == self.coin_type, ETypeMismatch);
    let vault: &mut Balance<C> = df::borrow_mut(&mut self.id, VAULT_FIELD_NAME);
    self.paid = self.paid - vault.value();
    self.requested = self.requested - vault.value().min(self.requested);
    vault.withdraw_all()
}

public(package) fun destroy_empty<C>(
    self: PaymentV1
) {
    let PaymentV1 {
        mut id,
        coin_type,
        ..
    } = self;
    assert!(type_name::get<C>() == coin_type, ETypeMismatch);
    let vault: Balance<C> = df::remove(&mut id, VAULT_FIELD_NAME);
    vault.destroy_zero();
    id.delete();
}

// === Private Functions ===

// === Test Functions ===