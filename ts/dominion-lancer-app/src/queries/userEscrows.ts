import { queryOptions, useQuery } from "@tanstack/solid-query";
import { Network, useConfig } from "../stores/config";
import { suiClient } from "../stores/suiClient";
import {  } from "../stores/config";
import { queryClient } from "./client";

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
      client.getOwnedObjects({
        owner: props.user,
        filter: {
          StructType: `${config.runner.package}::escrow::Escrow<0x2::sui::SUI>`,
        },
        options: {
          showContent: true,
        }
      });
    },
  });

export const userEscrowsQuery = (props: UserEscrowsProps) =>
  useQuery(
    () => userEscrowsOptions(props),
    () => queryClient
  );
