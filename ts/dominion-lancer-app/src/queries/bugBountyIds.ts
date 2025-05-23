import { queryOptions, useQuery } from "@tanstack/solid-query";
import { Network, useConfig } from "~/stores/config";
import { useSui } from "~/stores/suiClient";
import { queryClient } from "./client";
import { getAllBugBountyIds, getUserBugBountyIds } from "~/sdk/BugBounty";
import { Accessor } from "solid-js";

export type BugBountyIdsProps = {
  network: Network;
  ownedBy?: string;
};

export const bugBountyIdsKey = (props: BugBountyIdsProps) => [
  props.network,
  "bugBountyIds",
  {
    ownedBy: props.ownedBy,
  },
];

export const bugBountyIdsOptions = (props: BugBountyIdsProps) =>
  queryOptions({
    queryKey: bugBountyIdsKey(props),
    queryFn: async () => {
      const config = useConfig(props.network);
      const client = useSui(props.network);
      if (props.ownedBy) {
        return await getUserBugBountyIds({
          config,
          client,
          user: props.ownedBy,
        });
      } else {
        return await getAllBugBountyIds({ config, client });
      }
    },
  });

export const useBugBountyIds = (props: Accessor<BugBountyIdsProps>) =>
  useQuery(
    () => bugBountyIdsOptions(props()),
    () => queryClient
  );
