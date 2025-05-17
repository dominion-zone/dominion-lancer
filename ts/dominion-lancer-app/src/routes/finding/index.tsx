import { createFileRoute, useMatches } from "@tanstack/solid-router";

import { z } from "zod";
import { zodValidator } from "@tanstack/zod-adapter";
import FindingsToolbox from "~/components/finding/index/FindingsToolbox";
import { useSuiUser } from "~/contexts";
import { findingStatus, FindingStatus } from "~/sdk/Finding";
import { For } from "solid-js";
import FindingCard from "~/components/finding/index/FindingCard";
import { useFindings } from "~/queries/findings";

const searchSchema = z.object({
  ownedBy: z.string().optional(),
  bugBountyId: z.string().optional(),
  status: z.enum(["Draft", "Active", "Error"]).optional(),
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

  const { filtered } = useFindings(() => ({
    network: search().network,
    ownedBy: search().ownedBy,
    filter: (finding) => {
      if (filterMineChecked() && finding.owner !== search().ownedBy) {
        return false;
      }
      if (filterBugBountyId() && finding.bugBountyId !== search().bugBountyId) {
        return false;
      }
      if (filterStatus() && findingStatus(finding) !== filterStatus()) {
        return false;
      }
      return true;
    },
  }));

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

      <For each={filtered()}>
        {(finding) => <FindingCard findingId={finding.id} />}
      </For>
    </main>
  );
}
