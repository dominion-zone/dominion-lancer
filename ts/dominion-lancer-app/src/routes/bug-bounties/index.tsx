import {
  createFileRoute,
  createLink,
  Link,
  useMatches,
} from "@tanstack/solid-router";
import { Check, Plus, Square, SquareCheck, SquarePlus } from "lucide-solid";
import { createEffect, createSignal, For, Match, Show, Switch } from "solid-js";
import { Button, Checkbox, CheckboxIndicator } from "terracotta";
import { useSuiNetwork, useSuiUser } from "~/contexts";
import { bugBountiesQuery } from "~/queries/bugBounties";
import { config, Network } from "~/stores/config";
import { z } from "zod";
import { zodValidator } from "@tanstack/zod-adapter";
import BugBountyToolbox from "~/components/BugBountyToolbox";
import { normalizeStructTag } from "@mysten/sui/utils";

const searchSchema = z.object({
  ownedBy: z.string().optional(),
  active: z.boolean().optional(),
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

  const filteredBugBounties = () => {
    let bounties = bugBounties.data || [];
    if (filterMineChecked() && user.value) {
      bounties = bounties.filter((bounty) => bounty.owner === user.value);
    }
    if (filterActiveChecked()) {
      bounties = bounties.filter((bounty) => bounty.isActive);
    }
    return bounties;
  };

  return (
    <main>
      <h1>Bug Bounties</h1>
      <BugBountyToolbox
        user={user.value}
        filterMineChecked={filterMineChecked}
        setFilterMineChecked={setFilterMineChecked}
        filterActiveChecked={filterActiveChecked}
        setFilterActiveChecked={setFilterActiveChecked}
      />
      <For each={filteredBugBounties()}>
        {(bugBounty) => (
          <section class="card">
            <h2>{bugBounty.name}</h2>
            <p>Package: {bugBounty.packageId}</p>
            <Show when={bugBounty.owner}>
              <p>Owned by: {bugBounty.owner}</p>
            </Show>
            <p>
              Active:{" "}
              <Show when={bugBounty.isActive} fallback={<Square size={18} />}>
                <SquareCheck size={18} />
              </Show>
              {" "}Approved:{" "}
              <Show
                when={bugBounty.approves.find(
                  (v) =>
                    normalizeStructTag(v) ===
                    normalizeStructTag(
                      `${
                        config[network.value as Network].lancer.package
                      }::upgrader_approve::UpgraderApproveV1`
                    )
                )}
                fallback={<Square size={18}/>}
              >
                <SquareCheck size={18} />
              </Show>
            </p>
          </section>
        )}
      </For>
    </main>
  );
}
