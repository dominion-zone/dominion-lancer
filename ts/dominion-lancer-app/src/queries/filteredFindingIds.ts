import { EventId, MoveStruct, MoveValue } from "@mysten/sui/client";
import { queryOptions, useQuery } from "@tanstack/solid-query";
import { Network, useConfig } from "~/stores/config";
import { suiClient } from "~/stores/suiClient";
import { queryClient } from "./client";
import { BugBounty, getBugBounties } from "~/sdk/BugBounty";

export type FilteredFindingsProps = {
  network: Network;
  ownedBy?: string;
  bugBountyId?: string;
};

export const filteredFindingIdsKey = (props: FilteredFindingsProps) => [
  props.network,
  "filteredFindingIds",
  {
    ownedBy: props.ownedBy,
    bugBountyId: props.bugBountyId,
  },
];

export const filteredFindingIdsOptions = (props: FilteredFindingsProps) =>
  queryOptions({
    queryKey: filteredFindingIdsKey(props),
    enabled: Boolean(props.ownedBy || props.bugBountyId),
    queryFn: async () => {
      if (!props.bugBountyId && !props.ownedBy) {
        throw new Error("Either ownerId or bugBountyId must be provided");
      }
      const config = useConfig(props.network);
      const client = suiClient(props.network);

      const ownedFindingIds = [];
      if (props.ownedBy) {
        let cursor = null;
        for (;;) {
          const page = await client.getOwnedObjects({
            owner: props.ownedBy,
            cursor,
            filter: {
              StructType: `${config.lancer.typeOrigins.finding.OwnerCap}::finding::OwnerCap`,
            },
            options: {
              showContent: true,
            },
          });

          for (const obj of page.data) {
            ownedFindingIds.push(
              (
                (obj.data!.content as { fields: MoveStruct }).fields as {
                  finding_id: string;
                }
              ).finding_id as string
            );
          }
          if (page.hasNextPage) {
            cursor = page.nextCursor;
          } else {
            break;
          }
        }
      }

      const filteredFindingIds = [];
      if (props.bugBountyId) {
        let cursor = null;
        for (;;) {
          const page = await client.queryTransactionBlocks({
            filter: {
              InputObject: props.bugBountyId,
            },
            options: {
              showEvents: true,
            },
          });

          for (const tx of page.data) {
            for (const event of tx.events!) {
              if (
                event.type ===
                `${config.lancer.typeOrigins.finding.FindingCreatedEvent}::finding::FindingCreatedEvent`
              ) {
                const findingId = (
                  event.parsedJson as {
                    finding_id: string;
                  }
                ).finding_id;
                if (!props.ownedBy || ownedFindingIds.includes(findingId)) {
                  filteredFindingIds.push(findingId);
                }
              }
            }
          }

          if (page.hasNextPage) {
            cursor = page.nextCursor;
          } else {
            break;
          }
        }
      } else {
        filteredFindingIds.push(...ownedFindingIds);
      }

      return filteredFindingIds;
    },
  });

export const useFilteredFindingIds = (props: FilteredFindingsProps) =>
  useQuery(
    () => filteredFindingIdsOptions(props),
    () => queryClient
  );
