import { queryOptions, useQuery } from "@tanstack/solid-query";
import { getFinding } from "~/sdk/Finding";
import { Network } from "~/stores/config";
import { suiClient } from "~/stores/suiClient";
import { queryClient } from "./client";

export type FindingProps = {
  network: Network;
  findingId: string;
};

export const findingKey = (props: FindingProps) => [
  props.network,
  "finding",
  props.findingId,
];

export const findingOptions = (props: FindingProps) =>
  queryOptions({
    queryKey: findingKey(props),
    queryFn: async () => {
      const client = suiClient(props.network);
      return await getFinding({client, id: props.findingId})
    },
  });

export const useFinding = (props: FindingProps) =>
  useQuery(
    () => findingOptions(props),
    () => queryClient
  );