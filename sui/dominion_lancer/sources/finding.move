module dominion_lancer::finding;

// === Imports ===

use std::string::String;
use sui::balance::{Self, Balance};
use sui::bag::Bag;
use std::type_name::{Self, TypeName};
use sui::versioned::{Self, Versioned};
use sui::bcs::{Self, BCS};

use dominion_lancer::executor::EXECUTOR;
use dominion_lancer::bug_bounty::{Self, BugBounty, OwnerCap as BugBountyOwnerCap};

use walrus::blob::{Self, Blob};
use walrus::system::{Self, System as WalrusSystem};
use wal::wal::WAL;
use enclave::enclave::{Self, Enclave};

use dominion_lancer::payment::{Self, PaymentV1};

// === Errors ===

const EUnknownVersion: u64 = 1;
const EUnknownCoinType: u64 = 2;
const EInvalidOwnerCap: u64 = 3;
const ENoAccess: u64 = 4;
const EInvalidBugBounty: u64 = 5;
const EInvalidFinding: u64 = 6;
const ENotCertified: u64 = 4;
const EResourceBounds: u64 = 5;
const EInvalidSignature: u64 = 6;
const ENotPaid: u64 = 7;
const EInvalidDecryptId: u64 = 8;
const EAlreadyCommitted: u64 = 9;

// === Constants ===

// === Structs ===

public struct Finding has key {
    id: UID,
    owner_cap_id: ID,
    inner: Versioned,
}

public struct FindingV1 has store {
    bug_bounty_id: ID,
    submission_hash: vector<u8>,
    payments: vector<PaymentV1>,
    public_report: Option<Blob>,
    private_report: Option<Blob>,
    wal_funds: Balance<WAL>,
}

public struct OwnerCap has key, store {
    id: UID,
    finding_id: ID,
}

public struct VerifyExecutorMessage has drop {
    finding_id: ID,
    submission_hash: vector<u8>,
    public_blob_id: u256,
    private_blob_id: Option<u256>,
}

// === Events ===

// === Method Aliases ===

// === Entry Functions ===

entry fun create_v1_and_transfer_cap(
    bug_bounty_id: ID,
    submission_hash: vector<u8>,
    payments: vector<PaymentV1>,
    ctx: &mut TxContext
) {
    let owner_cap = create_v1(bug_bounty_id, submission_hash, payments, ctx);
    transfer::transfer(owner_cap, ctx.sender());
}


entry fun seal_approve_with_bug_bounty(
    id: vector<u8>,
    bug_bounty_owner_cap: &BugBountyOwnerCap,
    finding: &Finding,
) {
    assert!(finding.bug_bounty_id() == bug_bounty_owner_cap.bug_bounty_id(), EInvalidBugBounty);
    let is_paid = finding.is_paid();

    let mut prepared: BCS = bcs::new(id);
    let id = prepared.peel_u256();

    match (finding.inner.version()) {
        1 => {
            let finding: &FindingV1 = finding.inner.load_value();
            if (finding.private_report.is_some() &&
                id == finding.private_report.borrow().blob_id()) {
                assert!(is_paid, ENotPaid);
            } else if (finding.public_report.is_some() &&
                id == finding.public_report.borrow().blob_id()) {
                return
            } else {
                abort EInvalidDecryptId
            }
        },
        _ => abort EUnknownVersion
    };
}

entry fun seal_approve_with_owner_cap(
    id: vector<u8>,
    owner_cap: &OwnerCap,
    finding: &Finding,
) {
    owner_cap.assert_owner_cap(finding);

    let mut prepared: BCS = bcs::new(id);
    let id = prepared.peel_u256();

    match (finding.inner.version()) {
        1 => {
            let finding: &FindingV1 = finding.inner.load_value();
            if (finding.private_report.is_some() &&
                id == finding.private_report.borrow().blob_id()) {
                return;
            } else if (finding.public_report.is_some() &&
                id == finding.public_report.borrow().blob_id()) {
                return;
            } else {
                abort EInvalidDecryptId;
            }
        },
        _ => abort EUnknownVersion,
    };
}

// === Public Functions ===


public fun create_v1(
    bug_bounty_id: ID,
    submission_hash: vector<u8>,
    payments: vector<PaymentV1>,
    ctx: &mut TxContext,
): OwnerCap {
    let owner_cap_uid = object::new(ctx);
    let self = Finding {
        id: object::new(ctx),
        owner_cap_id: owner_cap_uid.to_inner(),
        inner: versioned::create(
            1,
            FindingV1 {
                bug_bounty_id,
                submission_hash,
                payments,
                public_report: option::none(),
                private_report: option::none(),
                wal_funds: balance::zero(),
            },
        ctx)
    };
    let owner_cap = OwnerCap {
        id: owner_cap_uid,
        finding_id: object::id(&self),
    };
    transfer::share_object(self);
    owner_cap
}


public fun commit(
    finding: &mut Finding,
    walrus_system: &WalrusSystem,
    public_report: Blob,
    private_report: Option<Blob>,
    enclave: &Enclave<EXECUTOR>,
    timestamp_ms: u64,
    signature: &vector<u8>
) {
    assert!(finding.is_draft(), EAlreadyCommitted);
    assert!(public_report.certified_epoch().is_some(), ENotCertified);
    assert!(walrus_system.epoch() < public_report.end_epoch(), EResourceBounds);
    private_report.do_ref!(|b| {
        assert!(b.certified_epoch().is_some(), ENotCertified);
        assert!(walrus_system.epoch() < b.end_epoch(), EResourceBounds);
    });

    assert!(
        enclave.verify_signature(
            0,
            timestamp_ms,
            VerifyExecutorMessage {
                finding_id: object::id(finding),
                submission_hash: finding.submission_hash(),
                public_blob_id: public_report.blob_id(),
                private_blob_id: private_report.map_ref!(|b| b.blob_id()),
            },
            signature),
        EInvalidSignature
    );

    match (finding.inner.version()) {
        1 => {
            let mut finding: &mut FindingV1 = finding.inner.load_value_mut();
            finding.public_report.fill(public_report);
            private_report.do!(|v| {
                finding.private_report.fill(v);
            });
        },
        _ => abort EUnknownVersion,
    };
}

public fun pay<C>(
    self: &mut Finding,
    balance: Balance<C>,
    ctx: &mut TxContext,
) {
    match (self.inner.version()) {
        1 => {
            let mut self: &mut FindingV1 = self.inner.load_value_mut();
            let i = self.payments.find_index!(|p| {
                p.coin_type() == type_name::get<C>()
            });
            if (i.is_some()) {
                self.payments.borrow_mut(i.destroy_some()).pay(balance);
            } else {
                let mut payment = payment::create<C>(0, ctx);
                payment.pay(balance);
                self.payments.push_back(payment);
            }
        },
        _ => abort EUnknownVersion,
    }
}

public fun withdraw<C>(
    self: &OwnerCap,
    finding: &mut Finding,
): Balance<C> {
    self.assert_owner_cap(finding);
    match (finding.inner.version()) {
        1 => {
            let finding: &mut FindingV1 = finding.inner.load_value_mut();
            let i = finding.payments.find_index!(|p| {
                p.coin_type() == type_name::get<C>()
            });
            if (i.is_some()) {
                let i = i.destroy_some();
                let payment =  finding.payments.borrow_mut(i);
                let result = payment.withdraw_all();
                if (payment.is_paid()) {
                    finding.payments.remove(i).destroy_empty<C>();
                };
                result
            } else {
                abort EUnknownVersion
            }
        },
        _ => abort EUnknownCoinType,
    }
}

public fun assert_owner_cap(
    self: &OwnerCap,
    finding: &Finding,
) {
    assert!(finding.owner_cap_id == object::id(self), EInvalidOwnerCap);
}

// === View Functions ===

public fun bug_bounty_id(
    self: &Finding
): ID {
    match (self.inner.version()) {
        1 => {
            let self: &FindingV1 = self.inner.load_value<FindingV1>();
            self.bug_bounty_id
        },
        _ => abort EUnknownVersion,
    }
}

public fun owner_cap_id(
    self: &Finding
): ID {
    self.owner_cap_id
}

public fun is_draft(
    self: &Finding
): bool {
    match (self.inner.version()) {
        1 => self.inner.load_value<FindingV1>().public_report.is_none(),
        _ => abort EUnknownVersion,
    }
}

public fun is_paid(
    self: &Finding
): bool {
    match (self.inner.version()) {
        1 => self
            .inner
            .load_value<FindingV1>()
            .payments
            .all!(|p| p.is_paid()),
        _ => abort EUnknownVersion,
    }
}

public fun submission_hash(
    self: &Finding
): vector<u8> {
    match (self.inner.version()) {
        1 => self.inner.load_value<FindingV1>().submission_hash,
        _ => abort EUnknownVersion,
    }
}

// === Admin Functions ===

// === Package Functions ===

// === Private Functions ===

// === Test Functions ===
