module dominion_lancer_runner::server;

// === Imports ===

use sui::event;

// === Errors ===

// === Constants ===

// === Structs ===

public struct AdminCap has key, store {
    id: UID,
}

public struct OperatorCap has key, store {
    id: UID,
    server_id: ID,
}

public struct Server has key {
    id: UID,
    operator_cap_id: ID,
    locked_escrow_count: u64,
    is_active: bool,
    // TODO: Enclave ID
}

// === Events ===

public struct ServerCreatedEvent has copy, drop {
    server_id: ID,
    operator_cap_id: ID,
}

public struct ServerDeactivatedEvent has copy, drop {
    server_id: ID,
}

public struct ServerDestroyedEvent has copy, drop {
    server_id: ID,
}

// === Method Aliases ===

// === Entry Functions ===

entry fun create_server_and_transfer_operator_cap(
    self: &AdminCap,
    ctx: &mut TxContext,
) {
    let operator_cap = self.create_server(ctx);
    transfer::transfer(operator_cap, ctx.sender());
}

// === Public Functions ===

public fun create_server(
    _: &AdminCap,
    ctx: &mut TxContext,
) : OperatorCap {
    let server_uid = object::new(ctx);
    let operator_cap = OperatorCap {
        id: object::new(ctx),
        server_id: server_uid.to_inner(),
    };
    let server = Server {
        id: server_uid,
        operator_cap_id: object::id(&operator_cap),
        locked_escrow_count: 0,
        is_active: true,
    };

    event::emit(ServerCreatedEvent {
        server_id: object::id(&server),
        operator_cap_id: object::id(&operator_cap),
    });

    transfer::share_object(server);

    operator_cap
}

public entry fun deactivate_server(
    _: &AdminCap,
    server: &mut Server,
) {
    server.is_active = false;

    event::emit(ServerDeactivatedEvent {
        server_id: object::id(server),
    });
}

public entry fun destroy_server(
    _: &AdminCap,
    server: Server,
) {
    let Server { id, locked_escrow_count, .. } = server;
    assert!(locked_escrow_count == 0, 0x1);

    event::emit(ServerDestroyedEvent {
        server_id: id.to_inner(),
    });

    id.delete();
}

// === View Functions ===

public fun assert_operator_cap(
    self: &Server,
    operator_cap: &OperatorCap,
) {
    assert!(self.operator_cap_id == object::id(operator_cap), 0x0);
}

public fun is_active(server: &Server): bool {
    server.is_active
}

// === Admin Functions ===

fun init(ctx: &mut TxContext) {
    let admin_cap = AdminCap {
        id: object::new(ctx),
    };
    
    transfer::transfer(admin_cap, ctx.sender())
}

// === Package Functions ===

public(package) fun increment_locked_escrow_count(
    server: &mut Server,
) {
    server.locked_escrow_count = server.locked_escrow_count + 1;
}

public(package) fun decrement_locked_escrow_count(
    server: &mut Server,
) {
    assert!(server.locked_escrow_count > 0, 0x2);
    server.locked_escrow_count = server.locked_escrow_count - 1;
}

// === Private Functions ===

// === Test Functions ===