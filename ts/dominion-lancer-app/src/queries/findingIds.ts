import { EventId, MoveStruct, MoveValue } from "@mysten/sui/client";
import { queryOptions, useQuery } from "@tanstack/solid-query";
import { Network, useConfig } from "~/stores/config";
import { suiClient } from "~/stores/suiClient";
import { queryClient } from "./client";
import { BugBounty, getBugBounties } from "~/sdk/BugBounty";

export type FindingIdsProps = {
  network: Network;
  ownerId?: string;
  bugBountyId?: string;
};

export const findingIdsKey = (props: FindingIdsProps) => [
  props.network,
  "findingIds",
  {
    ownerId: props.ownerId,
    bugBountyId: props.bugBountyId,
  },
];

export const findingIdsOptions = (props: FindingIdsProps) =>
  queryOptions({
    queryKey: findingIdsKey(props),
    queryFn: async () => {
      const config = useConfig(props.network);
      const client = suiClient(props.network);
      if (props.ownerId) {
        const findingIds = [];
        let cursor = null;
        for (;;) {
          const page = await client.getOwnedObjects({
            owner: props.ownerId,
            cursor,
            filter: {
              StructType: `${config.lancer.typeOrigins.finding.OwnerCap}::finding::OwnerCap`,
            },
            options: {
              showContent: true,
            },
          });

          for (const obj of page.data) {
            findingIds.push(
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
      } else {
        if (!props.bugBountyId) {
          throw new Error("Either ownerId or bugBountyId must be provided");
        }
        const findingIds = [];
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
                findingIds.push(findingId);
              }
            }
          }

          if (page.hasNextPage) {
            cursor = page.nextCursor;
          } else {
            break;
          }
        }
      }
    },
  });
