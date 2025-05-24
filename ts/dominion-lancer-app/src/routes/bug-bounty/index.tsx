import { createFileRoute, useMatches } from "@tanstack/solid-router";
import { createMemo, For } from "solid-js";
import { useSuiNetwork, useSuiUser } from "~/contexts";
import { useConfig, Network } from "~/stores/config";
import { z } from "zod";
import { zodValidator } from "@tanstack/zod-adapter";
import BugBountiesToolbox from "~/components/bugBounty/index/BugBountiesToolbox";
import { normalizeStructTag } from "@mysten/sui/utils";
import BugBountyCard from "~/components/bugBounty/index/BugBountyCard";
import { useBugBountyIds } from "~/queries/bugBountyIds";
import { BugBounty } from "~/sdk/BugBounty";

const searchSchema = z.object({
  ownedBy: z.string().optional(),
  active: z.boolean().optional(),
  approved: z.boolean().optional(),
});

export const Route = createFileRoute("/bug-bounty/")({
  component: RouteComponent,
  validateSearch: zodValidator(searchSchema),
});

function RouteComponent() {
  const user = useSuiUser();
  const network = useSuiNetwork();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const matches = useMatches();

  const filterMineChecked = () =>
    user.value ? search().ownedBy === user.value : false;
  const setFilterMineChecked = (value: boolean | ((_: boolean) => boolean)) => {
    if (typeof value === "function") {
      value = value(filterMineChecked());
    }
    navigate({
      from: matches()[matches().length - 1].fullPath,
      to: ".",
      search: (prev) => ({
        ...prev,
        ownedBy: value ? user.value : undefined,
      }),
    });
  };

  const filterActiveChecked = () => search().active === true;
  const setFilterActiveChecked = (
    value: boolean | ((_: boolean) => boolean)
  ) => {
    if (typeof value === "function") {
      value = value(filterActiveChecked());
    }
    navigate({
      from: matches()[matches().length - 1].fullPath,
      to: ".",
      search: (prev) => ({
        ...prev,
        active: value || undefined,
      }),
    });
  };

  const filterApprovedChecked = () => search().approved === true;

  const setFilterApprovedChecked = (
    value: boolean | ((_: boolean) => boolean)
  ) => {
    if (typeof value === "function") {
      value = value(filterApprovedChecked());
    }
    navigate({
      from: matches()[matches().length - 1].fullPath,
      to: ".",
      search: (prev) => ({
        ...prev,
        approved: value || undefined,
      }),
    });
  };

  const bugBountyIds = useBugBountyIds({
    get network() {
      return network.value as Network;
    },
    get ownedBy() {
      return search().ownedBy;
    },
  });

  const filter = createMemo(() => {
    const filterMine = filterMineChecked();
    const filterActive = filterActiveChecked();
    const filterApproved = filterApprovedChecked();
    const config = useConfig(network.value as Network);
    const userValue = user.value;
    return (bugBounty: BugBounty) => {
      if (filterMine && userValue && bugBounty.owner !== userValue) {
        return false;
      }
      if (filterActive && !bugBounty.isActive) {
        return false;
      }
      if (
        filterApproved &&
        !bugBounty.approves.find(
          (v) =>
            normalizeStructTag(v) ===
            normalizeStructTag(
              `${config.lancer.typeOrigins.upgraderApprove.UpgraderApproveV1}::upgrader_approve::UpgraderApproveV1`
            )
        )
      ) {
        return false;
      }
      return true;
    };
  });

  return (
    <main>
      <h1>Bug Bounties</h1>
      <BugBountiesToolbox
        filterMineChecked={filterMineChecked}
        setFilterMineChecked={setFilterMineChecked}
        filterActiveChecked={filterActiveChecked}
        setFilterActiveChecked={setFilterActiveChecked}
        filterApprovedChecked={filterApprovedChecked}
        setFilterApprovedChecked={setFilterApprovedChecked}
      />
      <For each={bugBountyIds.data}>
        {(id) => (
          <BugBountyCard bugBountyId={id} filter={filter()} />
        )}
      </For>
    </main>
  );
}
