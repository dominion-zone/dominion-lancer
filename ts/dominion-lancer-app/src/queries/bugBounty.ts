import { queryOptions, useQuery } from "@tanstack/solid-query";
import { Network } from "~/stores/config";
import { suiClient } from "~/stores/suiClient";
import { queryClient } from "./client";
import { getBugBounty } from "~/sdk/BugBounty";
import { Accessor } from "solid-js";

export type BugBountyProps = {
  network: Network;
  bugBountyId?: string;
};

export const bugBountyKey = (props: BugBountyProps) => [
  props.network,
  "bugBounty",
  props.bugBountyId,
];

export const bugBountyOptions = (props: BugBountyProps) => {
  return queryOptions({
    queryKey: bugBountyKey(props),
    queryFn: async () => {
      const client = suiClient(props.network);
      return await getBugBounty({client, id: props.bugBountyId!});
    },
    enabled: Boolean(props.bugBountyId),
  });
}

export const useBugBounty = (props: Accessor<BugBountyProps>) =>
  useQuery(
    () => bugBountyOptions(props()),
    () => queryClient
  );
