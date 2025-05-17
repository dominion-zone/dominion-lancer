import { queryOptions, useQuery } from "@tanstack/solid-query";
import { Network, useConfig } from "~/stores/config";
import { suiClient } from "~/stores/suiClient";
import { queryClient } from "./client";
import { Accessor } from "solid-js";
import { getAllFindingIds, getUserFindingIds } from "~/sdk/Finding";

export type FindingIdsProps = {
  network: Network;
  ownedBy?: string;
};

export const findingIdsKey = (props: FindingIdsProps) => [
  props.network,
  "findingIds",
  {
    ownedBy: props.ownedBy,
  },
];

export const findingIdsOptions = (props: FindingIdsProps) =>
  queryOptions({
    queryKey: findingIdsKey(props),
    queryFn: async () => {
      const config = useConfig(props.network);
      const client = suiClient(props.network);
      if (props.ownedBy) {
        return await getUserFindingIds({
          config,
          client,
          user: props.ownedBy,
        });
      } else {
        return await getAllFindingIds({ config, client });
      }
    },
  });

export const useFindingIds = (props: Accessor<FindingIdsProps>) =>
  useQuery(
    () => findingIdsOptions(props()),
    () => queryClient
  );
