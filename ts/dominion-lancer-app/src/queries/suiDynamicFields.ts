import { QueryFunction, queryOptions, useQuery } from "@tanstack/solid-query";
import { Network } from "~/stores/config";
import { useSui } from "~/stores/suiClient";
import { queryClient } from "./client";
import { DynamicFieldInfo } from "@mysten/sui/client";

export type SuiDynamicFieldsProps = {
  network: Network;
  parentId?: string;
};

export type SuiDynamicFieldsKey = [
  network: Network,
  type: "suiDynamicFields",
  parentId: string | undefined
];

export const suiDynamicFieldsKey = (props: SuiDynamicFieldsProps): SuiDynamicFieldsKey => [
  props.network,
  "suiDynamicFields",
  props.parentId,
];

const queryFn: QueryFunction<DynamicFieldInfo[] | undefined, SuiDynamicFieldsKey> = async ({
  queryKey: [network, , parentId],
}) => {
  if (!parentId) {
    return [];
  }
  const client = useSui(network);
  const result = [];
  let cursor = undefined;
  while (true) {
    const page = await client.getDynamicFields({
      parentId,
      cursor,
    });
    result.push(...page.data);
    if (page.hasNextPage) {
      cursor = page.nextCursor;
    } else {
      break;
    }
  }
  return result;
};

export const suiDynamicFieldsOptions = (props: SuiDynamicFieldsProps) => {
  return queryOptions({
    queryKey: suiDynamicFieldsKey(props),
    queryFn,
    enabled: Boolean(props.parentId),
  });
};

export const useSuiDynamicFields = (props: SuiDynamicFieldsProps) =>
  useQuery(
    () => suiDynamicFieldsOptions(props),
    () => queryClient
  );
