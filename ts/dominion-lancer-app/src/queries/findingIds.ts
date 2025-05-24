import { QueryFunction, queryOptions, useQuery } from "@tanstack/solid-query";
import { Network, useConfig } from "~/stores/config";
import { useSui } from "~/stores/suiClient";
import { queryClient } from "./client";
import { Accessor } from "solid-js";
import { getAllFindingIds, getUserFindingIds } from "~/sdk/Finding";

export type FindingIdsProps = {
  network: Network;
  ownedBy?: string;
};

export type FindingIdsKey = [
  network: Network,
  type: "findingIds",
  ownedBy?: string
];

export const findingIdsKey = (props: FindingIdsProps): FindingIdsKey => [
  props.network,
  "findingIds",
  props.ownedBy,
];

const queryFn: QueryFunction<string[] | undefined, FindingIdsKey> = async ({
  queryKey: [network, , ownedBy],
}) => {
  const config = useConfig(network);
  const client = useSui(network);
  if (ownedBy) {
    return await getUserFindingIds({
      config,
      client,
      user: ownedBy,
    });
  } else {
    return await getAllFindingIds({ config, client });
  }
};

export const findingIdsOptions = (props: FindingIdsProps) =>
  queryOptions({
    queryKey: findingIdsKey(props),
    queryFn,
  });

export const useFindingIds = (props: FindingIdsProps) =>
  useQuery(
    () => findingIdsOptions(props),
    () => queryClient
  );
