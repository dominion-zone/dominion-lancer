import { createFileRoute, useMatches } from "@tanstack/solid-router";
import { createEffect, createSignal, For, Match, Show, Switch } from "solid-js";
import { useSuiClient, useSuiNetwork, useSuiUser } from "~/contexts";
import { useConfig, Network } from "~/stores/config";
import { z } from "zod";
import { zodValidator } from "@tanstack/zod-adapter";
import BugBountiesToolbox from "~/components/bugBounty/index/BugBountiesToolbox";
import { normalizeStructTag } from "@mysten/sui/utils";
import BugBountyCard from "~/components/bugBounty/index/BugBountyCard";
import { queryClient } from "~/queries/client";
import { bugBountyIdsOptions } from "~/queries/bugBountyIds";
import { getBugBounties } from "~/sdk/BugBounty";
import { suiClient } from "~/stores/suiClient";
import { bugBountyKey } from "~/queries/bugBounty";
import { useBugBounties } from "~/queries/bugBounties";

const searchSchema = z.object({
  ownedBy: z.string().optional(),
  active: z.boolean().optional(),
  approved: z.boolean().optional(),
});

export const Route = createFileRoute("/bug-bounty/")({
  component: RouteComponent,
  validateSearch: zodValidator(searchSchema),
  loaderDeps: ({ search }) => ({ network: search.network, ownedBy: search.ownedBy }),
  loader: async ({ deps }) => {
    const client = suiClient(deps.network);
    const ids = await queryClient.ensureQueryData(
      bugBountyIdsOptions({ network: deps.network, ownedBy: deps.ownedBy }),
    );
    const bugBounties = await getBugBounties({ client, ids });
    for (const bugBounty of bugBounties) {
      queryClient.setQueryData(
        bugBountyKey({ network: deps.network, bugBountyId: bugBounty.id }),
        bugBounty
      );
    }
  },
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

  const { filtered } = useBugBounties(() => ({
    network: network.value as Network,
    filter: (bugBounty) => {
      if (filterMineChecked() && user.value && bugBounty.owner !== user.value) {
        return false;
      }
      if (filterActiveChecked() && !bugBounty.isActive) {
        return false;
      }
      if (
        filterApprovedChecked() &&
        !bugBounty.approves.find(
          (v) =>
            normalizeStructTag(v) ===
            normalizeStructTag(
              `${
                useConfig(network.value as Network).lancer.typeOrigins.upgraderApprove.UpgraderApproveV1
              }::upgrader_approve::UpgraderApproveV1`
            )
        )
      ) {
        return false;
      }
      return true;
    },
  }));

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
      <For each={filtered()}>
        {(bugBounty) => <BugBountyCard bugBountyId={bugBounty.id} />}
      </For>
    </main>
  );
}
