module dominion_lancer_runner::escrow;

// === Imports ===

use sui::balance::{Balance};
use sui::coin::{Coin};
use sui::event;

use dominion_lancer_runner::server::{Server, OperatorCap, AdminCap};

// === Errors ===

// === Constants ===

// === Structs ===

public struct OwnerCap has key, store {
    id: UID,
    escrow_id: ID,
}

public struct Escrow<phantom T> has key {
    id: UID,
    owner_cap_id: ID,
    server_id: ID,
    balance: Balance<T>,
    is_locked: bool,
}

// === Events ===

public struct EscrowCreatedEvent has copy, drop {
    escrow_id: ID,
    server_id: ID,
    owner_cap_id: ID,
}

public struct EscrowLockedEvent has copy, drop {
    escrow_id: ID,
    server_id: ID,
}

public struct EscrowUnlockedEvent has copy, drop {
    escrow_id: ID,
    server_id: ID,
    amount_taken: u64,
}

public struct EscrowDestroyedEvent has copy, drop {
    escrow_id: ID,
}


public struct EscrowDepositedEvent has copy, drop {
    escrow_id: ID,
    amount: u64,
}

public struct EscrowWithdrawnEvent has copy, drop {
    escrow_id: ID,
    amount: u64,
}

// === Method Aliases ===

// === Entry Functions ===

entry fun create_escrow_and_transfer_cap<T>(
    self: &Server,
    coin: Coin<T>,
    ctx: &mut TxContext,
) {
    let owner_cap = self.create_escrow<T>(coin.into_balance(), ctx);
    transfer::transfer(owner_cap, ctx.sender())
}

entry fun deposit_coin<T>(
    self: &mut Escrow<T>,
    coin: Coin<T>,
) {
    self.deposit(coin.into_balance());
}

entry fun withdraw_coin<T>(
    self: &OwnerCap,
    escrow: &mut Escrow<T>,
    amount: u64,
    ctx: &mut TxContext,
) {
    let balance = self.withdraw(escrow, amount);
    transfer::public_transfer(balance.into_coin(ctx), ctx.sender());
}

entry fun unlock_escrow_and_transfer_coin<T>(
    self: &OperatorCap,
    server: &mut Server,
    escrow: &mut Escrow<T>,
    withdraw_amount: u64,
    ctx: &mut TxContext,
) {
    let balance = unlock_escrow(self, server, escrow, withdraw_amount);
    transfer::public_transfer(balance.into_coin(ctx), ctx.sender());
}

// === Public Functions ===

public fun create_escrow<T>(
    self: &Server,
    balance: Balance<T>,
    ctx: &mut TxContext,
): OwnerCap {
    assert!(self.is_active(), 0x11);
    let escrow_uid = object::new(ctx);
    let owner_cap = OwnerCap {
        id: object::new(ctx),
        escrow_id: escrow_uid.to_inner(),
    };

    let escrow = Escrow<T> {
        id: escrow_uid,
        owner_cap_id: object::id(&owner_cap),
        server_id: object::id(self),
        balance,
        is_locked: false,
    };

    event::emit(EscrowCreatedEvent {
        escrow_id: object::id(&escrow),
        server_id: object::id(server),
        owner_cap_id: object::id(&owner_cap),
    });

    transfer::share_object(escrow);
    owner_cap
}

public fun deposit<T>(
    self: &mut Escrow<T>,
    balance: Balance<T>,
) {
    event::emit(EscrowDepositedEvent {
        escrow_id: object::id(self),
        amount: balance.value(),
    });

    self.balance.join(balance);
}

public fun withdraw<T>(
    self: &OwnerCap,
    escrow: &mut Escrow<T>,
    amount: u64,
): Balance<T> {
    escrow.assert_owner_cap(self);
    assert!(!escrow.is_locked, 0x12);

    event::emit(EscrowWithdrawnEvent {
        escrow_id: object::id(escrow),
        amount,
    });

    escrow.balance.split(amount)
}

public entry fun destroy_escrow<T>(
    self: &OwnerCap,
    escrow: Escrow<T>,
) {
    escrow.assert_owner_cap(self);
    assert!(!escrow.is_locked, 0x12);
    let Escrow { id, balance, .. } = escrow;
    balance.destroy_zero();

    event::emit(EscrowDestroyedEvent {
        escrow_id: id.to_inner(),
    });

    id.delete();
}

// === View Functions ===

public fun assert_owner_cap<T>(
    self: &Escrow<T>,
    owner_cap: &OwnerCap,
) {
    assert!(self.owner_cap_id == object::id(owner_cap), 0x0);
}

public fun assert_server<T>(
    self: &Escrow<T>,
    server: &Server,
) {
    assert!(self.server_id == object::id(server), 0x10);
}

// === Admin Functions ===

public entry fun lock_escrow<T>(
    self: &OperatorCap,
    server: &mut Server,
    escrow: &mut Escrow<T>,
) {
    server.assert_operator_cap(self);
    escrow.assert_server(server);
    assert!(server.is_active(), 0x11);
    assert!(!escrow.is_locked, 0x12);
    escrow.is_locked = true;
    server.increment_locked_escrow_count();

    event::emit(EscrowLockedEvent {
        escrow_id: object::id(escrow),
        server_id: object::id(server),
    });
}

public fun unlock_escrow<T>(
    self: &OperatorCap,
    server: &mut Server,
    escrow: &mut Escrow<T>,
    take_amount: u64,
): Balance<T> {
    server.assert_operator_cap(self);
    escrow.assert_server(server);
    assert!(escrow.is_locked, 0x12);
    escrow.is_locked = false;
    server.decrement_locked_escrow_count();

    event::emit(EscrowUnlockedEvent {
        escrow_id: object::id(escrow),
        server_id: object::id(server),
        amount_taken: take_amount,
    });

    escrow.balance.split(take_amount)
}

public fun forced_unlock_escrow<T>(
    _: &AdminCap,
    server: &mut Server,
    escrow: &mut Escrow<T>,
) {
    escrow.assert_server(server);
    assert!(escrow.is_locked, 0x12);
    escrow.is_locked = false;
    server.decrement_locked_escrow_count();

    event::emit(EscrowUnlockedEvent {
        escrow_id: object::id(escrow),
        server_id: object::id(server),
        amount_taken: 0,
    });
}

// === Package Functions ===

// === Private Functions ===

// === Test Functions ===