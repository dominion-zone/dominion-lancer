import { useQueries } from "@tanstack/solid-query";
import { Network } from "~/stores/config";
import { queryClient } from "./client";
import { BugBounty } from "~/sdk/BugBounty";
import { useBugBountyIds } from "./bugBountyIds";
import { bugBountyOptions } from "./bugBounty";
import { Accessor, createMemo } from "solid-js";

export type BugBountiesProps = {
  network: Network;
  ownedBy?: string;
  filter?: (_: BugBounty) => boolean;
};

export const useBugBounties = (props: Accessor<BugBountiesProps>) => {
  const ids = useBugBountyIds(props);
  const bugBounties = useQueries(() => ({
    queries: (ids.data || []).map((id) =>
      bugBountyOptions({ ...props(), bugBountyId: id })
    ),
    queryClient,
  }));
  const filtered = createMemo(() => {
    const filter = props().filter;
    return bugBounties
      .map((bounty) => bounty.data)
      .filter((data) => data && (!filter || filter(data))) as BugBounty[];
  });
  return {
    ids,
    bugBounties,
    filtered,
  };
};
