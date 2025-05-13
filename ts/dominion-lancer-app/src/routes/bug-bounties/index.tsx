import { createFileRoute, useMatches } from "@tanstack/solid-router";
import { createEffect, createSignal, For, Match, Show, Switch } from "solid-js";
import { useSuiNetwork, useSuiUser } from "~/contexts";
import { bugBountiesQuery } from "~/queries/bugBounties";
import { useConfig, Network } from "~/stores/config";
import { z } from "zod";
import { zodValidator } from "@tanstack/zod-adapter";
import BugBountiesToolbox from "~/components/bugBounty/index/BugBountiesToolbox";
import { normalizeStructTag } from "@mysten/sui/utils";
import BugBountyCard from "~/components/bugBounty/index/BugBountyCard";

const searchSchema = z.object({
  ownedBy: z.string().optional(),
  active: z.boolean().optional(),
  approved: z.boolean().optional(),
});

export const Route = createFileRoute("/bug-bounties/")({
  component: RouteComponent,
  validateSearch: zodValidator(searchSchema),
});

function RouteComponent() {
  const user = useSuiUser();
  const network = useSuiNetwork();
  const bugBounties = bugBountiesQuery({
    network: network.value as Network,
  });
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
      value = value(filterMineChecked());
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

  const filteredBugBounties = () => {
    let bounties = bugBounties.data || [];
    if (filterMineChecked() && user.value) {
      bounties = bounties.filter((bounty) => bounty.owner === user.value);
    }
    if (filterActiveChecked()) {
      bounties = bounties.filter((bounty) => bounty.isActive);
    }
    if (filterApprovedChecked()) {
      bounties = bounties.filter((bounty) =>
        bounty.approves.find(
          (v) =>
            normalizeStructTag(v) ===
            normalizeStructTag(
              `${
                useConfig().lancer.typeOrigins.upgraderApprove.UpgraderApproveV1
              }::upgrader_approve::UpgraderApproveV1`
            )
        )
      );
    }
    return bounties;
  };

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
      <For each={filteredBugBounties()}>
        {(bugBounty) => <BugBountyCard bugBounty={bugBounty} />}
      </For>
    </main>
  );
}
