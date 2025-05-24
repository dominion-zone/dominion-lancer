import { QueryFunction, queryOptions, useQuery } from "@tanstack/solid-query";
import { Network } from "../stores/config";
import { useConfig } from "../stores/config";
import { queryClient } from "./client";
import axios from "axios";
import { Accessor } from "solid-js";
import { SessionKey } from "@mysten/seal";
import { SuiWallet } from "~/contexts";

export type SealSessionProps = {
  network: Network;
  user: string;
};

export type SealSessionKey = [
  network: Network,
  type: "sealSession",
  user: string
];

export const sealSessionKey = (props: SealSessionProps): SealSessionKey => [
  props.network,
  "sealSession",
  props.user,
];

const queryFn: (
  wallet: SuiWallet
) => QueryFunction<SessionKey, SealSessionKey> =
  (wallet) =>
  async ({ queryKey: [network, , user] }) => {
    const config = useConfig(network);
    const sessionKey = new SessionKey({
      address: user,
      packageId: config.lancer.originalPackage,
      ttlMin: 10,
    });
    const message = sessionKey.getPersonalMessage();
    const { signature } = await wallet.features[
      "sui:signPersonalMessage"
    ]?.signPersonalMessage({
      message,
      account: wallet.accounts.find(({ address }) => address === user)!,
      chain: `sui:${network}`,
    })!;
    await sessionKey.setPersonalMessageSignature(signature);
    return sessionKey;
  };

export const sealSessionOptions = (
  props: SealSessionProps & { wallet: SuiWallet }
) =>
  queryOptions({
    queryKey: sealSessionKey(props),
    queryFn: queryFn(props.wallet),
    refetchInterval: 1000 * 60 * 10,
  });

export const useSealSession = (
  props: SealSessionProps & { wallet: SuiWallet }
) =>
  useQuery(
    () => sealSessionOptions(props),
    () => queryClient
  );
