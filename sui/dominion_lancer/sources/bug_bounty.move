module dominion_lancer::bug_bounty;

// === Imports ===

use std::string::String;
use sui::bag::{Self, Bag};
use sui::versioned::{Self, Versioned};
use sui::event;
use std::type_name::{Self, TypeName};
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
    package_id: ID,
    name: String,
    approves: Bag,
    is_active: bool,
}

public struct OwnerCap has key, store {
    id: UID,
    bug_bounty_id: ID,
}

// === Events ===

public struct BugBountyCreated has copy, drop {
    bug_bounty_id: ID,
    package_id: ID,
    name: String,
}

public struct BugBountyApprovedEvent has copy, drop {
    bug_bounty_id: ID,
    token_type: TypeName,
}

// === Method Aliases ===

// === Entry Functions ===

entry fun create_v1_and_transfer_cap(
    package_id: ID,
    name: String,
    ctx: &mut TxContext,
) {
    let (self, owner_cap) = create_v1(package_id, name, ctx);
    self.share();
    transfer::transfer(owner_cap, ctx.sender());
}

// === Public Functions ===

public fun create_v1(
    package_id: ID,
    name: String,
    ctx: &mut TxContext,
): (BugBounty, OwnerCap) {
    let owner_cap_uid = object::new(ctx);

    let self = BugBounty {
        id: object::new(ctx),
        inner: versioned::create(1, BugBountyV1 {
            owner_cap_id: owner_cap_uid.to_inner(),
            package_id,
            name,
            approves: bag::new(ctx),
            is_active: true,
        }, ctx),
    };

    let owner_cap = OwnerCap {
        id: owner_cap_uid,
        bug_bounty_id: object::id(&self),
    };


    event::emit(BugBountyCreated {
        bug_bounty_id: object::id(&self),
        package_id,
        name,
    });

    (self, owner_cap)
}

public fun share(
    self: BugBounty,
) {
    transfer::share_object(self);
}

public fun assert_owner_cap(
    self: &OwnerCap,
    bug_bounty: &BugBounty,
) {
    assert!(bug_bounty.owner_cap_id() == object::id(self), EInvalidOwnerCap);
}

public fun approve<T: store>(
    self: &OwnerCap,
    bug_bounty: &mut BugBounty,
    token: T,
) {
    self.assert_owner_cap(bug_bounty);
    match (bug_bounty.inner.version()) {
        1 => {
            let inner = bug_bounty.inner.load_value_mut<BugBountyV1>();
            let token_type = type_name::get<T>();
            inner.approves.add(token_type, token);
            event::emit(BugBountyApprovedEvent {
                bug_bounty_id: object::id(self),
                token_type
            });
        },
        _ => abort(EUnknownVersion),
    }
}

// === View Functions ===

public fun bug_bounty_id(
    self: &OwnerCap,
) : ID {
    self.bug_bounty_id
}

public fun owner_cap_id(
    self: &BugBounty,
) : ID {
    match (self.inner.version()) {
        1 => {
            self.inner.load_value<BugBountyV1>().owner_cap_id
        },
        _ => abort(EUnknownVersion),
    }
}

public fun package_id(
    self: &BugBounty,
) : ID {
    match (self.inner.version()) {
        1 => {
            self.inner.load_value<BugBountyV1>().package_id
        },
        _ => abort(EUnknownVersion),
    }
}

public fun name(
    self: &BugBounty,
) : String {
    match (self.inner.version()) {
        1 => {
            self.inner.load_value<BugBountyV1>().name
        },
        _ => abort(EUnknownVersion),
    }
}

// === Admin Functions ===

// === Package Functions ===

// === Private Functions ===

// === Test Functions ===