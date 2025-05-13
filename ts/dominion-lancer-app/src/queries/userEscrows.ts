import { queryOptions, useQuery } from "@tanstack/solid-query";
import { Network, useConfig } from "../stores/config";
import { suiClient } from "../stores/suiClient";
import {  } from "../stores/config";
import { queryClient } from "./client";
import { SUI_FRAMEWORK_ADDRESS } from "@mysten/sui/utils";
import { getOwnedEscrows } from "~/sdk/Escrow";

export type UserEscrowsProps = {
  network: Network;
  user: string;
};

export const userEscrowsKey = ({ network, user }: UserEscrowsProps) => [
  network,
  "userEscrows",
  user,
];

export const userEscrowsOptions = (props: UserEscrowsProps) =>
  queryOptions({
    queryKey: userEscrowsKey(props),
    queryFn: async () => {
      const config = useConfig(props.network);
      const client = suiClient(props.network);
      return await getOwnedEscrows(config, client, props.user);
    },
  });

export const userEscrowsQuery = (props: UserEscrowsProps) =>
  useQuery(
    () => userEscrowsOptions(props),
    () => queryClient
  );
