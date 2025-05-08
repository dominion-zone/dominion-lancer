import { EventId, MoveStruct, MoveValue } from "@mysten/sui/client";
import { queryOptions, useQuery } from "@tanstack/solid-query";
import { Network, useConfig } from "~/stores/config";
import { suiClient } from "~/stores/suiClient";
import { queryClient } from "./client";
import { BugBounty, getBugBounties } from "~/sdk/BugBounty";

export type BugBountiesProps = {
  network: Network;
};

export const bugBountiesKey = (props: BugBountiesProps) => [
  props.network,
  "bugBounties",
];

export const bugBountiesOptions = (props: BugBountiesProps) =>
  queryOptions({
    queryKey: bugBountiesKey(props),
    queryFn: async () => {
      const config = useConfig(props.network);
      const client = suiClient(props.network);
      const bugBounties: BugBounty[] = [];
      let cursor = null;
      for (;;) {
        const page = await client.queryEvents({
          query: {
            MoveEventType: `${config.lancer.typeOrigins.bugBounty.BugBountyCreatedEvent}::bug_bounty::BugBountyCreatedEvent`,
          },
          cursor,
        });
        const ids = page.data.map(
          (event) =>
            (
              event as {
                parsedJson: any;
              }
            ).parsedJson.bug_bounty_id as string
        );
        bugBounties.push(...(await getBugBounties(client, ids)));
        if (page.hasNextPage) {
          cursor = page.nextCursor;
        } else {
          break;
        }
      }
      console.log(bugBounties);
      return bugBounties;
    },
  });

export const bugBountiesQuery = (props: BugBountiesProps) =>
  useQuery(
    () => bugBountiesOptions(props),
    () => queryClient
  );
