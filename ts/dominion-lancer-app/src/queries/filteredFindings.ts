import { queryOptions, useQuery } from "@tanstack/solid-query";
import {
  filteredFindingIdsOptions,
  FilteredFindingsProps,
} from "./filteredFindingIds";
import { findingOptions } from "./finding";
import { queryClient } from "./client";

export const filteredFindingsKey = (props: FilteredFindingsProps) => [
  props.network,
  "filteredFindings",
  {
    ownerId: props.ownedBy,
    bugBountyId: props.bugBountyId,
  },
];

export const filteredFindingsOptions = (props: FilteredFindingsProps) =>
  queryOptions({
    queryKey: filteredFindingsKey(props),
    enabled: Boolean(props.ownedBy || props.bugBountyId),
    queryFn: async ({ client }) => {
      const ids = await client.ensureQueryData(
        filteredFindingIdsOptions(props)
      );
      return await Promise.all(
        ids.map((id) =>
          client.ensureQueryData(
            findingOptions({ network: props.network, findingId: id })
          )
        )
      );
    },
    gcTime: 0,
    staleTime: 0,
  });

export const filteredFindingsQuery = (props: FilteredFindingsProps) =>
  useQuery(
    () => filteredFindingsOptions(props),
    () => queryClient
  );
