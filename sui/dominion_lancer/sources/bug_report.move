module dominion_lancer::bug_report;

// === Imports ===

use std::string::String;
use sui::balance::{Self, Balance};
use sui::bag::Bag;
use std::type_name::{Self, TypeName};
use sui::versioned::{Self, Versioned};

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
const EInvalidBugReport: u64 = 6;
const ENotCertified: u64 = 4;
const EResourceBounds: u64 = 5;
const EInvalidSignature: u64 = 6;
const ENotPaid: u64 = 7;

// === Constants ===

// === Structs ===

public struct BugReport has key {
    id: UID,
    owner_cap_id: ID,
    inner: Versioned,
}

public struct BugReportV1 has store {
    bug_bounty_id: ID,
    description: String,
    payments: vector<PaymentV1>,
    public_execution: Blob,
    private_execution: Option<Blob>,
    wal_funds: Balance<WAL>,
}

public struct OwnerCap has key, store {
    id: UID,
    bug_report_id: ID,
}

public struct VerifyExecutorMessage has drop {
    sender: address,
    bug_bounty_id: ID,
    public_blob_id: u256,
    private_blob_id: Option<u256>,
}

// === Events ===

// === Method Aliases ===

// === Public Functions ===

public fun pay<C>(
    self: &mut BugReport,
    balance: Balance<C>,
    ctx: &mut TxContext,
) {
    match (self.inner.version()) {
        1 => {
            let mut self: &mut BugReportV1 = self.inner.load_value_mut();
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

entry fun seal_approve(
    id: vector<u8>,
    bug_bounty_owner_cap: BugBountyOwnerCap,
    bug_bounty: &BugBounty,
    bug_report: &BugReport,
) {
    bug_bounty_owner_cap.assert_owner_cap(bug_bounty);
    assert!(bug_report.bug_bounty_id() == object::id(bug_bounty), EInvalidBugBounty);
    assert!(id == object::id(bug_report).to_bytes(), EInvalidBugReport);
    assert!(bug_report.is_paid(), ENotPaid);
}

// === View Functions ===

public fun bug_bounty_id(
    self: &BugReport
): ID {
    match (self.inner.version()) {
        1 => self.inner.load_value<BugReportV1>().bug_bounty_id,
        _ => abort EUnknownVersion,
    }
}

public fun owner_cap_id(
    self: &BugReport
): ID {
    self.owner_cap_id
}

public fun description(
    self: &BugReport
): String {
    match (self.inner.version()) {
        1 => self.inner.load_value<BugReportV1>().description,
        _ => abort EUnknownVersion,
    }
}

public fun is_paid(
    self: &BugReport
): bool {
    match (self.inner.version()) {
        1 => self
            .inner
            .load_value<BugReportV1>()
            .payments
            .all!(|p| p.is_paid()),
        _ => abort EUnknownVersion,
    }
}

// === Admin Functions ===

public fun create_v1(
    bug_bounty_id: ID,
    description: String,
    payments: vector<PaymentV1>,
    walrus_system: &WalrusSystem,
    public_execution: Blob,
    private_execution: Option<Blob>,
    enclave: Enclave<EXECUTOR>,
    timestamp_ms: u64,
    signature: &vector<u8>,
    ctx: &mut TxContext,
): OwnerCap {
    assert!(public_execution.certified_epoch().is_some(), ENotCertified);
    assert!(walrus_system.epoch() < public_execution.end_epoch(), EResourceBounds);
    private_execution.map!(|b| {
        assert!(b.certified_epoch().is_some(), ENotCertified);
        assert!(walrus_system.epoch() < b.end_epoch(), EResourceBounds);
    });

    assert!(
        enclave.verify_signature(
            0,
            timestamp_ms,
            VerifyExecutorMessage {
                sender: ctx.sender(),
                bug_bounty_id,
                public_blob_id: public_execution.blob_id(),
                private_blob_id: private_execution.map!(|b| b.blob_id()),
            },
            signature),
        EInvalidSignature
    );

    let owner_cap_id = object::new(ctx);
    let self = BugReport {
        id: object::new(ctx),
        owner_cap_id: owner_cap_id.to_inner(),
        inner: versioned::create(
            1,
            BugReportV1 {
                bug_bounty_id,
                description,
                payments,
                public_execution,
                private_execution,
                wal_funds: balance::zero(),
            },
        ctx)
    };
    let owner_cap = OwnerCap {
        id: owner_cap_id,
        bug_report_id: object::id(&self),
    };
    transfer::share_object(self);
    owner_cap
}

public fun withdraw<C>(
    self: &OwnerCap,
    bug_report: &mut BugReport,
): Balance<C> {
    self.assert_owner_cap(bug_report);
    match (bug_report.inner.version()) {
        1 => {
            let mut bug_report: &mut BugReportV1 = bug_report.inner.load_value_mut();
            let i = bug_report.payments.find_index!(|p| {
                p.coin_type() == type_name::get<C>()
            });
            if (i.is_some()) {
                let i = i.destroy_some();
                let payment =  bug_report.payments.borrow_mut(i);
                let result = payment.withdraw_all();
                if (payment.is_paid()) {
                    bug_report.payments.remove(i).destroy_empty<C>();
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
    bug_report: &BugReport,
) {
    assert!(bug_report.owner_cap_id == object::id(self), EInvalidOwnerCap);
}

// === Package Functions ===

// === Private Functions ===

// === Test Functions ===
