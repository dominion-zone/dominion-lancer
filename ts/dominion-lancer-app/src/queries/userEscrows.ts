import { QueryFunction, queryOptions, useQuery } from "@tanstack/solid-query";
import { Network, useConfig } from "../stores/config";
import { useSui } from "../stores/suiClient";
import { queryClient } from "./client";
import { Escrow, getOwnedEscrows } from "~/sdk/Escrow";
import { Accessor } from "solid-js";

export type UserEscrowsProps = {
  network: Network;
  user?: string;
};

export type UserEscrowsKey = [
  network: Network,
  type: "userEscrows",
  user?: string
];

export const userEscrowsKey = ({
  network,
  user,
}: UserEscrowsProps): UserEscrowsKey => [network, "userEscrows", user];

const queryFn: QueryFunction<Escrow[], UserEscrowsKey> = async ({
  queryKey: [network, , user],
}) => {
  if (!user) {
    return [];
  }
  const config = useConfig(network);
  const client = useSui(network);
  return await getOwnedEscrows(config, client, user);
};

export const userEscrowsOptions = (props: UserEscrowsProps) =>
  queryOptions({
    queryKey: userEscrowsKey(props),
    queryFn,
  });

export const userEscrowsQuery = (props: UserEscrowsProps) =>
  useQuery(
    () => userEscrowsOptions(props),
    () => queryClient
  );
