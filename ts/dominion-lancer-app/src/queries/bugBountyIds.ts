import { QueryFunction, queryOptions, useQuery } from "@tanstack/solid-query";
import { Network, useConfig } from "~/stores/config";
import { useSui } from "~/stores/suiClient";
import { queryClient } from "./client";
import { getAllBugBountyIds, getUserBugBountyIds } from "~/sdk/BugBounty";
import { Accessor, createMemo } from "solid-js";

export type BugBountyIdsProps = {
  network: Network;
  ownedBy?: string;
};

export type BugBountyIdsKey = [
  network: Network,
  type: "bugBountyIds",
  ownedBy: string | undefined
];

export const bugBountyIdsKey = (props: BugBountyIdsProps): BugBountyIdsKey => [
  props.network,
  "bugBountyIds",
  props.ownedBy,
];

const queryFn: QueryFunction<string[] | undefined, BugBountyIdsKey> = async ({
  queryKey: [network, , ownedBy],
}) => {
  const config = useConfig(network);
  const client = useSui(network);
  if (ownedBy) {
    return await getUserBugBountyIds({
      config,
      client,
      user: ownedBy,
    });
  } else {
    return await getAllBugBountyIds({ config, client });
  }
};

export const bugBountyIdsOptions = (props: BugBountyIdsProps) =>
  queryOptions({
    queryKey: bugBountyIdsKey(props),
    queryFn,
  });

export const useBugBountyIds = (props: BugBountyIdsProps) =>
  useQuery(
    () => bugBountyIdsOptions(props),
    () => queryClient
  );
