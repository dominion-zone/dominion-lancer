import { queryOptions, useQuery } from "@tanstack/solid-query";
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
  wallet: SuiWallet;
};

export const sealSessionKey = (props: SealSessionProps) => [
  props.network,
  "sealSession",
  props.user,
];

export const sealSessionOptions = (props: SealSessionProps) =>
  queryOptions({
    queryKey: sealSessionKey(props),
    queryFn: async () => {
      const config = useConfig(props.network);
      const sessionKey = new SessionKey({
        address: props.user,
        packageId: config.lancer.originalPackage,
        ttlMin: 10,
      });
      const message = sessionKey.getPersonalMessage();
      const { signature } = await props.wallet.features[
        "sui:signPersonalMessage"
      ]?.signPersonalMessage({
        message,
        account: props.wallet.accounts.find(
          ({ address }) => address === props.user
        )!,
        chain: `sui:${props.network}`
      })!;
      await sessionKey.setPersonalMessageSignature(signature);
      return sessionKey;
    },
    refetchInterval: 1000 * 60 * 10,
  });

export const useSealSession = (props: Accessor<SealSessionProps>) =>
  useQuery(
    () => sealSessionOptions(props()),
    () => queryClient
  );
