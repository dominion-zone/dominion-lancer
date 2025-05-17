import { MoveStruct, MoveValue } from "@mysten/sui/client";
import { queryOptions, useQuery } from "@tanstack/solid-query";
import { suiClient } from "~/stores/suiClient";
import { queryClient } from "./client";
import { Accessor } from "solid-js";

export type UserPackagesProps = {
  network: string;
  user: string;
};

export const userPackagesKey = (props: UserPackagesProps) => [
  props.network,
  "userPackages",
  props.user,
];

export const userPackagesOptions = (props: UserPackagesProps) =>
  queryOptions({
    queryKey: userPackagesKey(props),
    queryFn: async () => {
      const client = suiClient(props.network);
      const upgradeCaps = [];
      let cursor = null;
      for (;;) {
        const page = await client.getOwnedObjects({
          owner: props.user,
          cursor,
          filter: {
            StructType: "0x2::package::UpgradeCap",
          },
          options: {
            showContent: true,
          },
        });
        upgradeCaps.push(...page.data);
        if (page.hasNextPage) {
          cursor = page.nextCursor;
        } else {
          break;
        }
      }
      return upgradeCaps.map((cap) => {
        const fields = (
          cap.data!.content as {
            dataType: "moveObject";
            fields: MoveStruct;
            hasPublicTransfer: boolean;
            type: string;
          }
        ).fields as {
          [key: string]: MoveValue;
        };
        return {
          packageId: fields["package"] as string,
          upgradeCapId: cap.data!.objectId,
        };
      });
    },
  });

export const userPackagesQuery = (props: Accessor<UserPackagesProps>) =>
  useQuery(
    () => userPackagesOptions(props()),
    () => queryClient
  );
