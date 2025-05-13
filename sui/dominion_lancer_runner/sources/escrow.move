module dominion_lancer_runner::escrow;

// === Imports ===

use sui::balance::{Balance};
use sui::coin::{Coin};
use sui::event;

use dominion_lancer_runner::server::{Server, OperatorCap, AdminCap};

// === Errors ===

// === Constants ===

// === Structs ===

public struct OwnerCap<phantom T> has key, store {
    id: UID,
    escrow_id: ID,
}

public struct Escrow<phantom T> has key {
    id: UID,
    owner_cap_id: ID,
    server_id: ID,
    balance: Balance<T>,
    locked_for_finding: Option<ID>,
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
    amount: u64,
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

entry fun create_and_transfer_cap<T>(
    server: &Server,
    coin: Coin<T>,
    ctx: &mut TxContext,
) {
    let (escrow, owner_cap) = create<T>(server, coin.into_balance(), ctx);
    transfer::transfer(owner_cap, ctx.sender());
    transfer::share_object(escrow)
}

entry fun deposit_coin<T>(
    self: &mut Escrow<T>,
    coin: Coin<T>,
) {
    self.deposit(coin.into_balance());
}

entry fun withdraw_coin<T>(
    self: &OwnerCap<T>,
    escrow: &mut Escrow<T>,
    amount: u64,
    ctx: &mut TxContext,
) {
    let balance = self.withdraw(escrow, amount);
    transfer::public_transfer(balance.into_coin(ctx), ctx.sender());
}

entry fun unlock_and_transfer_coin<T>(
    self: &OperatorCap,
    server: &mut Server,
    escrow: &mut Escrow<T>,
    withdraw_amount: u64,
    ctx: &mut TxContext,
) {
    let balance = unlock(self, server, escrow, withdraw_amount);
    transfer::public_transfer(balance.into_coin(ctx), ctx.sender());
}

// === Public Functions ===

public fun create<T>(
    server: &Server,
    balance: Balance<T>,
    ctx: &mut TxContext,
): (Escrow<T>, OwnerCap<T>) {
    assert!(server.is_active(), 0x11);
    let escrow_uid = object::new(ctx);
    let owner_cap = OwnerCap<T> {
        id: object::new(ctx),
        escrow_id: escrow_uid.to_inner(),
    };

    let escrow = Escrow<T> {
        id: escrow_uid,
        owner_cap_id: object::id(&owner_cap),
        server_id: object::id(server),
        balance,
        locked_for_finding: option::none(),
    };

    event::emit(EscrowCreatedEvent {
        escrow_id: object::id(&escrow),
        server_id: object::id(server),
        owner_cap_id: object::id(&owner_cap),
    });

    (escrow, owner_cap)
}

public fun share<T>(
    self: Escrow<T>,
) {
    transfer::share_object(self);
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
    self: &OwnerCap<T>,
    escrow: &mut Escrow<T>,
    amount: u64,
): Balance<T> {
    escrow.assert_owner_cap(self);
    assert!(escrow.locked_for_finding.is_none(), 0x12);

    event::emit(EscrowWithdrawnEvent {
        escrow_id: object::id(escrow),
        amount,
    });

    escrow.balance.split(amount)
}

public fun destroy_escrow<T>(
    self: &OwnerCap<T>,
    escrow: Escrow<T>,
): Balance<T> {
    escrow.assert_owner_cap(self);
    assert!(escrow.locked_for_finding.is_none(), 0x12);
    let Escrow { id, balance, .. } = escrow;
    let amount = balance.value();

    event::emit(EscrowDestroyedEvent {
        escrow_id: id.to_inner(),
        amount,
    });

    id.delete();
    balance
}

public entry fun merge<T>(
    self: &OwnerCap<T>,
    target: &mut Escrow<T>,
    source: Escrow<T>,
) {
    let balance = destroy_escrow(self, source);
    target.deposit(balance);    
}


// === View Functions ===

public fun assert_owner_cap<T>(
    self: &Escrow<T>,
    owner_cap: &OwnerCap<T>,
) {
    assert!(self.owner_cap_id == object::id(owner_cap), 0x0);
}

public fun assert_server<T>(
    self: &Escrow<T>,
    server: &Server,
) {
    assert!(self.server_id == object::id(server), 0x10);
}

public fun is_locked<T>(
    self: &Escrow<T>,
): bool {
   self.locked_for_finding.is_some()
}

// === Admin Functions ===

public entry fun lock_escrow<T>(
    self: &OperatorCap,
    server: &mut Server,
    escrow: &mut Escrow<T>,
    finding_id: ID,
) {
    server.assert_operator_cap(self);
    escrow.assert_server(server);
    assert!(server.is_active(), 0x11);
    escrow.locked_for_finding.fill(finding_id);
    server.increment_locked_escrow_count();

    event::emit(EscrowLockedEvent {
        escrow_id: object::id(escrow),
        server_id: object::id(server),
    });
}

public fun unlock<T>(
    self: &OperatorCap,
    server: &mut Server,
    escrow: &mut Escrow<T>,
    take_amount: u64,
): Balance<T> {
    server.assert_operator_cap(self);
    escrow.assert_server(server);
    escrow.locked_for_finding.destroy_some();
    server.decrement_locked_escrow_count();

    event::emit(EscrowUnlockedEvent {
        escrow_id: object::id(escrow),
        server_id: object::id(server),
        amount_taken: take_amount,
    });

    escrow.balance.split(take_amount)
}

public fun forced_unlock<T>(
    _: &AdminCap,
    server: &mut Server,
    escrow: &mut Escrow<T>,
) {
    escrow.assert_server(server);
    escrow.locked_for_finding.destroy_some();
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