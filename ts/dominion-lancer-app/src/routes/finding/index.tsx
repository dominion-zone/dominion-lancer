import { createFileRoute, useMatches } from "@tanstack/solid-router";

import { z } from "zod";
import { zodValidator } from "@tanstack/zod-adapter";
import FindingsToolbox from "~/components/finding/index/FindingsToolbox";
import { useSuiUser } from "~/contexts";
import { Finding, findingStatus, FindingStatus, findingStatuses } from "~/sdk/Finding";
import { createEffect, createMemo, For } from "solid-js";
import FindingCard from "~/components/finding/index/FindingCard";
import { useFindingIds } from "~/queries/findingIds";

const searchSchema = z.object({
  ownedBy: z.string().optional(),
  bugBountyId: z.string().optional(),
  status: z.enum(findingStatuses).optional(),
});

export const Route = createFileRoute("/finding/")({
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

  const findingIds = useFindingIds({
    get network() {
      return search().network;
    },
    get ownedBy() {
      return search().ownedBy;
    },
  });
  const filter = createMemo(() => {
    const filterMine = filterMineChecked();
    const filterBugBounty = filterBugBountyId();
    const filterStatusValue = filterStatus();
    const ownedBy = search().ownedBy;
    return (finding: Finding) => {
      if (filterMine && finding.owner !== ownedBy) {
        return false;
      }
      if (filterBugBounty && finding.bugBountyId !== filterBugBounty) {
        return false;
      }
      if (filterStatusValue && findingStatus(finding) !== filterStatusValue) {
        return false;
      }
      return true;
    };
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

      <For each={findingIds.data || []}>
        {(findingId) => <FindingCard findingId={findingId} filter={filter()}/>}
      </For>
    </main>
  );
}
