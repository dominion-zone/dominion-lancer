import { MoveStruct, MoveValue } from "@mysten/sui/client";
import { QueryFunction, queryOptions, useQuery } from "@tanstack/solid-query";
import { useSui } from "~/stores/suiClient";
import { queryClient } from "./client";
import { Accessor } from "solid-js";

export type UserPackagesProps = {
  network: string;
  user?: string;
};

export type UserPackagesKey = [
  network: string,
  type: "userPackages",
  user?: string
];

export const userPackagesKey = (props: UserPackagesProps): UserPackagesKey => [
  props.network,
  "userPackages",
  props.user,
];

const queryFn: QueryFunction<
  { packageId: string; upgradeCapId: string }[],
  UserPackagesKey
> = async ({ queryKey: [network, , user] }) => {
  if (!user) {
    return [];
  }
  const client = useSui(network);
  const upgradeCaps = [];
  let cursor = null;
  for (;;) {
    const page = await client.getOwnedObjects({
      owner: user,
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
};

export const userPackagesOptions = (props: UserPackagesProps) =>
  queryOptions({
    queryKey: userPackagesKey(props),
    queryFn,
  });

export const userPackagesQuery = (props: UserPackagesProps) =>
  useQuery(
    () => userPackagesOptions(props),
    () => queryClient
  );
