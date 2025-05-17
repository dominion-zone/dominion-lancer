import { queryOptions, useQuery } from "@tanstack/solid-query";
import { Network, useConfig } from "../stores/config";
import { suiClient } from "../stores/suiClient";
import { queryClient } from "./client";
import { getOwnedEscrows } from "~/sdk/Escrow";
import { Accessor } from "solid-js";

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

export const userEscrowsQuery = (props: Accessor<UserEscrowsProps>) =>
  useQuery(
    () => userEscrowsOptions(props()),
    () => queryClient
  );
