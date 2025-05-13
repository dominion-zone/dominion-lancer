module dominion_lancer::finding;

// === Imports ===

use sui::balance::{Self, Balance};
use std::type_name::{Self, TypeName};
use sui::versioned::{Self, Versioned};
use sui::bcs::{Self, BCS};
use sui::bag::{Self, Bag};

use dominion_lancer::executor::EXECUTOR;
use dominion_lancer::bug_bounty::{BugBounty, OwnerCap as BugBountyOwnerCap};

use walrus::blob::{ Blob};
use walrus::system::{System as WalrusSystem};
use walrus::storage_resource::{Storage};
use wal::wal::WAL;
use enclave::enclave::{Enclave};

use sui::event;

// === Errors ===

const EUnknownVersion: u64 = 1;
const EInvalidOwnerCap: u64 = 3;
const EInvalidBugBounty: u64 = 5;
const ENotCertified: u64 = 4;
const EResourceBounds: u64 = 5;
const EInvalidSignature: u64 = 6;
const ENotPaid: u64 = 7;
const EInvalidDecryptId: u64 = 8;
const EInvalidPayment: u64 = 10;
const EAlreadyPublished: u64 = 11;
const ENotPublished: u64 = 12;
const EInvalidStatus: u64 = 13;

// === Constants ===

// === Structs ===

public struct PaymentV1<phantom C> has store {
    requested: u64,
    paid: Balance<C>,
}

public struct Finding has key {
    id: UID,
    inner: Versioned,
}

public enum FindingStatusV1 has copy, drop, store {
    Draft,
    Committed,
    Published,
    Error,
}

public struct FindingV1 has store {
    owner_cap_id: ID,
    bug_bounty_id: ID,
    submission_hash: vector<u8>,
    payments: Bag,
    payed_count: u64,
    public_report_blob: Option<Blob>,
    private_report_blob: Option<Blob>,
    error_message_blob: Option<Blob>,
    is_published: bool,
    wal_funds: Balance<WAL>,
}

public struct OwnerCap has key, store {
    id: UID,
    finding_id: ID,
}

public struct VerifyExecutorMessageV1 has drop {
    finding_id: ID,
    submission_hash: vector<u8>,
    public_blob_id: Option<u256>,
    private_blob_id: Option<u256>,
    error_blob_id: Option<u256>,
}

// === Events ===

public struct FindingCreatedEvent has copy, drop {
    finding_id: ID,
    owner_cap_id: ID,
    bug_bounty_id: ID,
    submission_hash: vector<u8>,
}

public struct FindingCommittedEvent has copy, drop {
    finding_id: ID,
    public_blob_id: u256,
    private_blob_id: Option<u256>,
    timestamp_ms: u64,
    enclave_id: ID,
}

public struct FindingErrorReportedEvent has copy, drop {
    finding_id: ID,
    error_message_blob_id: u256,
    timestamp_ms: u64,
    enclave_id: ID,
}

public struct FindingPublishedEvent has copy, drop {
    finding_id: ID,
    bug_bounty_id: ID,
}

public struct FindingDestroyedEvent has copy, drop {
    finding_id: ID,
}

public struct SealApprovedPublicWithBugBountyEvent has copy, drop {
    finding_id: ID,
    bug_bounty_id: ID,
}

public struct SealApprovedPrivateWithBugBountyEvent has copy, drop {
    finding_id: ID,
    bug_bounty_id: ID,
}

public struct SealApprovedPublicWithOwnerCapEvent has copy, drop {
    finding_id: ID,
    owner_cap_id: ID,
}

public struct SealApprovedPrivateWithOwnerCapEvent has copy, drop {
    finding_id: ID,
    owner_cap_id: ID,
}

public struct FindingPaidEvent has copy, drop {
    finding_id: ID,
    coin_type: TypeName,
    amount: u64,
}

public struct FindingWithdrawnEvent has copy, drop {
    finding_id: ID,
    coin_type: TypeName,
    amount: u64,
}

// === Method Aliases ===

// === Entry Functions ===

entry fun create_v1_and_transfer_cap(
    bug_bounty: &BugBounty,
    submission_hash: vector<u8>,
    ctx: &mut TxContext
) {
    let (self, owner_cap) = create_v1(bug_bounty, submission_hash, ctx);
    self.share();
    transfer::transfer(owner_cap, ctx.sender());
}


entry fun seal_approve_with_bug_bounty(
    id: vector<u8>,
    bug_bounty_owner_cap: &BugBountyOwnerCap,
    finding: &Finding,
) {
    assert!(finding.is_published(), ENotPublished);
    assert!(finding.bug_bounty_id() == bug_bounty_owner_cap.bug_bounty_id(), EInvalidBugBounty);
    let is_paid = finding.is_paid();
    let finding_id = object::id(finding);

    let mut prepared: BCS = bcs::new(id);
    let id = prepared.peel_u256();

    match (finding.inner.version()) {
        1 => {
            let finding: &FindingV1 = finding.inner.load_value();
            if (finding.private_report_blob.is_some() &&
                id == finding.private_report_blob.borrow().blob_id()) {
                assert!(is_paid, ENotPaid);
                event::emit(SealApprovedPrivateWithBugBountyEvent {
                    finding_id,
                    bug_bounty_id: object::id(bug_bounty_owner_cap),
                });
            } else if (finding.public_report_blob.is_some() &&
                id == finding.public_report_blob.borrow().blob_id()) {
                event::emit(SealApprovedPublicWithBugBountyEvent {
                    finding_id,
                    bug_bounty_id: object::id(bug_bounty_owner_cap),
                });
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
    let finding_id = object::id(finding);

    match (finding.inner.version()) {
        1 => {
            let finding: &FindingV1 = finding.inner.load_value();
            if (finding.private_report_blob.is_some() &&
                id == finding.private_report_blob.borrow().blob_id()) {
                event::emit(SealApprovedPrivateWithOwnerCapEvent {
                    finding_id,
                    owner_cap_id: object::id(owner_cap),
                });
            } else if (finding.public_report_blob.is_some() &&
                id == finding.public_report_blob.borrow().blob_id()) {
                event::emit(SealApprovedPublicWithOwnerCapEvent {
                    finding_id,
                    owner_cap_id: object::id(owner_cap),
                });
            } else {
                abort EInvalidDecryptId
            }
        },
        _ => abort EUnknownVersion,
    }
}

// === Public Functions ===

public fun create_v1(
    bug_bounty: &BugBounty,
    submission_hash: vector<u8>,
    ctx: &mut TxContext,
): (Finding, OwnerCap) {
    assert!(bug_bounty.is_active(), EInvalidBugBounty);
    let owner_cap_uid = object::new(ctx);
    let self = Finding {
        id: object::new(ctx),
        inner: versioned::create(
            1,
            FindingV1 {
                owner_cap_id: owner_cap_uid.to_inner(),
                bug_bounty_id: object::id(bug_bounty),
                submission_hash,
                payments: bag::new(ctx),
                payed_count: 0,
                public_report_blob: option::none(),
                private_report_blob: option::none(),
                error_message_blob: option::none(),
                wal_funds: balance::zero(),
                is_published: false,
            },
        ctx)
    };
    let owner_cap = OwnerCap {
        id: owner_cap_uid,
        finding_id: object::id(&self),
    };

    event::emit(FindingCreatedEvent {
        finding_id: object::id(&self),
        owner_cap_id: object::id(&owner_cap),
        bug_bounty_id: object::id(bug_bounty),
        submission_hash,
    });

    (self, owner_cap)
}

public fun share(
    self: Finding
) {
    transfer::share_object(self);
}

public fun add_payment<C>(
    self: &OwnerCap,
    finding: &mut Finding,
    requested: u64,
) {
    assert!(!finding.is_published(), EAlreadyPublished);
    assert!(requested > 0, EInvalidPayment);
    self.assert_owner_cap(finding);
    let coin_type = type_name::get<C>();
    match (finding.inner.version()) {
        1 => {
            let finding: &mut FindingV1 = finding.inner.load_value_mut();
            if (finding.payments.contains(coin_type)) {
                let payment:& mut PaymentV1<C> = finding.payments.borrow_mut(coin_type);
                if (payment.paid.value() >= payment.requested) {
                    finding.payed_count = finding.payed_count - 1;
                };
                payment.requested = payment.requested + requested;
                if (payment.paid.value() >= payment.requested) {
                    finding.payed_count = finding.payed_count + 1;
                }
            } else {
                finding.payments.add(coin_type, PaymentV1<C> {
                    requested,
                    paid: balance::zero(),
                });
            }
        },
        _ => abort EUnknownVersion,
    };
}

public fun set_payment<C>(
    self: &OwnerCap,
    finding: &mut Finding,
    requested: u64,
) {
    assert!(!finding.is_published(), EAlreadyPublished);
    self.assert_owner_cap(finding);
    let coin_type = type_name::get<C>();
    match (finding.inner.version()) {
        1 => {
            let finding: &mut FindingV1 = finding.inner.load_value_mut();
            if (finding.payments.contains(coin_type)) {
                let payment:& mut PaymentV1<C> = finding.payments.borrow_mut(coin_type);
                if (payment.paid.value() >= payment.requested) {
                    finding.payed_count = finding.payed_count - 1;
                };
                payment.requested = requested;
                if (payment.paid.value() >= payment.requested) {
                    finding.payed_count = finding.payed_count + 1;
                };
            } else {
                finding.payments.add(coin_type, PaymentV1<C> {
                    requested,
                    paid: balance::zero(),
                });
            }
        },
        _ => abort EUnknownVersion,
    };
}

public fun commit(
    finding: &mut Finding,
    walrus_system: &WalrusSystem,
    public_report_blob: Blob,
    private_report_blob: Option<Blob>,
    enclave: &Enclave<EXECUTOR>,
    timestamp_ms: u64,
    signature: &vector<u8>
) {
    assert!(finding.is_draft(), EInvalidStatus);
    assert!(public_report_blob.certified_epoch().is_some(), ENotCertified);
    assert!(walrus_system.epoch() < public_report_blob.end_epoch(), EResourceBounds);
    private_report_blob.do_ref!(|b| {
        assert!(b.certified_epoch().is_some(), ENotCertified);
        assert!(walrus_system.epoch() < b.end_epoch(), EResourceBounds);
    });

    assert!(
        enclave.verify_signature(
            0,
            timestamp_ms,
            VerifyExecutorMessageV1 {
                finding_id: object::id(finding),
                submission_hash: finding.submission_hash(),
                public_blob_id: option::some(public_report_blob.blob_id()),
                private_blob_id: private_report_blob.map_ref!(|b| b.blob_id()),
                error_blob_id: option::none(),
            },
            signature),
        EInvalidSignature
    );

    event::emit(FindingCommittedEvent {
        finding_id: object::id(finding),
        public_blob_id: public_report_blob.blob_id(),
        private_blob_id: private_report_blob.map_ref!(|b| b.blob_id()),
        timestamp_ms,
        enclave_id: object::id(enclave),
    });

    match (finding.inner.version()) {
        1 => {
            let finding: &mut FindingV1 = finding.inner.load_value_mut();
            finding.public_report_blob.fill(public_report_blob);
            private_report_blob.do!(|v| {
                finding.private_report_blob.fill(v);
            });
        },
        _ => abort EUnknownVersion,
    };
}

// Temporary for testing purposes
public fun commit_for_testing(
    finding: &mut Finding,
    public_report_blob: Blob,
    private_report_blob: Option<Blob>,
    enclave_id: ID,
    timestamp_ms: u64,
) {
    assert!(finding.is_draft(), EInvalidStatus);

    event::emit(FindingCommittedEvent {
        finding_id: object::id(finding),
        public_blob_id: public_report_blob.blob_id(),
        private_blob_id: private_report_blob.map_ref!(|b| b.blob_id()),
        timestamp_ms,
        enclave_id,
    });

    match (finding.inner.version()) {
        1 => {
            let finding: &mut FindingV1 = finding.inner.load_value_mut();
            finding.public_report_blob.fill(public_report_blob);
            private_report_blob.do!(|v| {
                finding.private_report_blob.fill(v);
            });
        },
        _ => abort EUnknownVersion,
    };
}

public fun report_error(
    finding: &mut Finding,
    walrus_system: &WalrusSystem,
    error_message_blob: Blob,
    enclave: &Enclave<EXECUTOR>,
    timestamp_ms: u64,
    signature: &vector<u8>
) {
    assert!(finding.is_draft(), EInvalidStatus);
    assert!(error_message_blob.certified_epoch().is_some(), ENotCertified);
    assert!(walrus_system.epoch() < error_message_blob.end_epoch(), EResourceBounds);
    event::emit(FindingErrorReportedEvent {
        finding_id: object::id(finding),
        error_message_blob_id: error_message_blob.blob_id(),
        timestamp_ms,
        enclave_id: object::id(enclave),
    });

    assert!(
        enclave.verify_signature(
            0,
            timestamp_ms,
            VerifyExecutorMessageV1 {
                finding_id: object::id(finding),
                submission_hash: finding.submission_hash(),
                public_blob_id: option::none(),
                private_blob_id: option::none(),
                error_blob_id: option::some(error_message_blob.blob_id()),
            },
            signature),
        EInvalidSignature
    );


    match (finding.inner.version()) {
        1 => {
            let finding: &mut FindingV1 = finding.inner.load_value_mut();
            finding.error_message_blob.fill(error_message_blob);
        },
        _ => abort EUnknownVersion,
    };
}

// Temporary for testing purposes
public fun report_error_for_testing(
    finding: &mut Finding,
    error_message_blob: Blob,
    enclave_id: ID,
    timestamp_ms: u64,
) {
    assert!(finding.is_draft(), EInvalidStatus);
    event::emit(FindingErrorReportedEvent {
        finding_id: object::id(finding),
        error_message_blob_id: error_message_blob.blob_id(),
        enclave_id,
        timestamp_ms
    });

    match (finding.inner.version()) {
        1 => {
            let finding: &mut FindingV1 = finding.inner.load_value_mut();
            finding.error_message_blob.fill(error_message_blob);
        },
        _ => abort EUnknownVersion,
    };
}

public fun publish(
    self: &OwnerCap,
    finding: &mut Finding,
) {
    let finding_id = object::id(finding);
    assert!(finding.is_committed(), EInvalidStatus);
    self.assert_owner_cap(finding);
    match (finding.inner.version()) {
        1 => {
            let finding: &mut FindingV1 = finding.inner.load_value_mut();
            finding.is_published = true;
            event::emit(FindingPublishedEvent {
                finding_id,
                bug_bounty_id: finding.bug_bounty_id,
            });
        },
        _ => abort EUnknownVersion,
    };
}

public fun pay<C>(
    self: &mut Finding,
    balance: Balance<C>,
) {
    assert!(balance.value() > 0, EInvalidPayment);
    let finding_id = object::id(self);
    let coin_type = type_name::get<C>();
    let amount = balance.value();

    match (self.inner.version()) {
        1 => {
            let self: &mut FindingV1 = self.inner.load_value_mut();
            if (self.payments.contains(coin_type)) {
                let payment:& mut PaymentV1<C> = self.payments.borrow_mut(coin_type);
                if (payment.paid.value() >= payment.requested) {
                    self.payed_count = self.payed_count - 1;
                };
                payment.paid.join(balance);
                if (payment.paid.value() >= payment.requested) {
                    self.payed_count = self.payed_count + 1;
                };
            } else {
                self.payments.add(coin_type, PaymentV1<C> {
                    requested: 0,
                    paid: balance,
                });
                self.payed_count = self.payed_count + 1;
            };
            event::emit(FindingPaidEvent {
                finding_id,
                coin_type,
                amount,
            })
        },
        _ => abort EUnknownVersion,
    }
}

public fun withdraw<C>(
    self: &OwnerCap,
    finding: &mut Finding,
): Balance<C> {
    self.assert_owner_cap(finding);
    let finding_id = object::id(finding);
    let coin_type = type_name::get<C>();

    match (finding.inner.version()) {
        1 => {
            let finding: &mut FindingV1 = finding.inner.load_value_mut();
            let PaymentV1<C> {
                paid,
                requested,
            } = finding.payments.remove(coin_type);
            if (paid.value() >= requested) {
                finding.payed_count = finding.payed_count - 1;
            } else {
                let requested = requested - paid.value();
                finding.payments.add(coin_type, PaymentV1<C> {
                    requested,
                    paid: balance::zero(),
                });
            };
            event::emit(FindingWithdrawnEvent {
                finding_id,
                coin_type,
                amount: paid.value(),
            });
            paid
        },
        _ => abort EUnknownVersion,
    }
}

public fun destroy_v1(
    self: OwnerCap,
    finding: Finding,
): Balance<WAL> {
    self.assert_owner_cap(&finding);
    assert!(!finding.is_published(), EInvalidStatus);
    let Finding {
        id,
        inner,
    } = finding;
    let finding_id = id.to_inner();
    id.delete();
    match (inner.version()) {
        1 => {
            let OwnerCap {
                id,
                ..
            } = self;
            id.delete();
            let FindingV1 {
                payments,
                public_report_blob,
                private_report_blob,
                error_message_blob,
                wal_funds,
                ..
            } = inner.destroy();

            // Must be cleared before
            payments.destroy_empty();
            // TODO: return storage resources
            public_report_blob.do!(|v| {
                v.burn();
            });
            private_report_blob.do!(|v| {
                v.burn();
            });
            error_message_blob.do!(|v| {
                v.burn();
            });

            event::emit(FindingDestroyedEvent {
                finding_id,
            });
            wal_funds
        },
        _ => abort EUnknownVersion,
    }
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
    match (self.inner.version()) {
        1 => {
            let self: &FindingV1 = self.inner.load_value<FindingV1>();
            self.owner_cap_id
        },
        _ => abort EUnknownVersion,
    }
}

public fun status_v1(
    self: &Finding
): FindingStatusV1 {
    match (self.inner.version()) {
        1 => {
            let self: &FindingV1 = self.inner.load_value<FindingV1>();

            if (self.error_message_blob.is_some()) {
                FindingStatusV1::Error
            } else if (self.public_report_blob.is_none()) {
                FindingStatusV1::Draft
            } else if (self.is_published) {
                FindingStatusV1::Published
            } else {
                FindingStatusV1::Committed
            }
        },
        _ => abort EUnknownVersion,
    }
}

public fun is_draft(
    self: &Finding
): bool {
    self.status_v1() == FindingStatusV1::Draft
}

public fun is_committed(
    self: &Finding
): bool {
    self.status_v1() == FindingStatusV1::Committed
}

public fun is_error(
    self: &Finding
): bool {
    self.status_v1() == FindingStatusV1::Error
}

public fun is_published(
    self: &Finding
): bool {
    self.status_v1() == FindingStatusV1::Published
}

public fun is_paid(
    self: &Finding
): bool {
    match (self.inner.version()) {
        1 => {
            let self = self.inner.load_value<FindingV1>();
            self.payed_count >= self.payments.length()
        },
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

public fun assert_owner_cap(
    self: &OwnerCap,
    finding: &Finding,
) {
    assert!(finding.owner_cap_id() == object::id(self), EInvalidOwnerCap);
}

// === Admin Functions ===

// === Package Functions ===

// === Private Functions ===

// === Test Functions ===
