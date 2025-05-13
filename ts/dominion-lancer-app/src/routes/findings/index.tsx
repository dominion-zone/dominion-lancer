import { createFileRoute, useMatches } from "@tanstack/solid-router";

import { z } from "zod";
import { zodValidator } from "@tanstack/zod-adapter";
import FindingsToolbox from "~/components/finding/index/FindingsToolbox";
import { useSuiUser } from "~/contexts";
import { findingStatus, FindingStatus } from "~/sdk/Finding";
import { For, Show } from "solid-js";
import { filteredFindingsQuery } from "~/queries/filteredFindings";
import FindingCard from "~/components/finding/index/FindingCard";

const searchSchema = z.object({
  ownedBy: z.string().optional(),
  bugBountyId: z.string().optional(),
  status: z.enum(["Draft", "Active", "Error"]).optional(),
});

export const Route = createFileRoute("/findings/")({
  component: RouteComponent,
  validateSearch: zodValidator(searchSchema),
});

function RouteComponent() {
  const user = useSuiUser();
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

  const filterBugBountyId = () => search().bugBountyId || null;
  const setFilterBugBountyId = (
    value: string | null | ((_: string | null) => string)
  ) => {
    if (typeof value === "function") {
      value = value(filterBugBountyId());
    }
    navigate({
      from: matches()[matches().length - 1].fullPath,
      to: ".",
      search: (prev) => ({
        ...prev,
        bugBountyId: value || undefined,
      }),
    });
  };

  const filterStatus = () => search().status || null;
  const setFilterStatus = (
    value: FindingStatus | null | ((_: FindingStatus | null) => FindingStatus)
  ) => {
    if (typeof value === "function") {
      value = value(filterStatus());
    }
    navigate({
      from: matches()[matches().length - 1].fullPath,
      to: ".",
      search: (prev) => ({
        ...prev,
        status: value || undefined,
      }),
    });
  };

  const findings = filteredFindingsQuery({
    network: search().network,
    ownedBy: search().ownedBy,
    bugBountyId: search().bugBountyId,
  });

  const filteredFinding = () =>
    findings.data?.filter((finding) => {
      if (filterStatus()) {
        return findingStatus(finding) === filterStatus();
      }
      return true;
    });

  return (
    <main>
      <h1>Findings</h1>
      <FindingsToolbox
        filterMineChecked={filterMineChecked}
        setFilterMineChecked={setFilterMineChecked}
        filterBugBountyId={filterBugBountyId}
        setFilterBugBountyId={setFilterBugBountyId}
        filterStatus={filterStatus}
        setFilterStatus={setFilterStatus}
      />
      <Show
        when={Boolean(filterMineChecked() || filterBugBountyId())}
        fallback={
          <div class="card">
            <h2>Select one of mine or bug bounty filters </h2>
          </div>
        }
      >
        <For each={filteredFinding()}>
          {(finding) => <FindingCard finding={finding} />}
        </For>
      </Show>
    </main>
  );
}
