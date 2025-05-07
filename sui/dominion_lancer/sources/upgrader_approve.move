module dominion_lancer::upgrader_approve;

// === Imports ===

use dominion_lancer::bug_bounty::{Self, BugBounty, OwnerCap};
use sui::package::UpgradeCap;

// === Errors ===

// === Constants ===

const EInvalidUpgradeCap: u64 = 1;

// === Structs ===

public struct UpgraderApproveV1 has store {
    upgrade_cap_id: ID,
}

// === Events ===

// === Method Aliases ===

// === Public Functions ===

public entry fun approve(
    self: &OwnerCap,
    bug_bounty: &mut BugBounty,
    upgrade_cap: &UpgradeCap,
)
{
    assert!(upgrade_cap.package() == bug_bounty.package_id(), EInvalidUpgradeCap);
    self.approve(bug_bounty, UpgraderApproveV1 {
        upgrade_cap_id: object::id(upgrade_cap),
    })
}

// === View Functions ===

// === Admin Functions ===

// === Package Functions ===

// === Private Functions ===

// === Test Functions ===