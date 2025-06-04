import { getAllowlistedKeyServers, SealClient } from "@mysten/seal";
import { useSui } from "./suiClient";

export const sealClient = (network: string) => {
  const suiClient = useSui(network);
  const serverConfigs = getAllowlistedKeyServers("testnet").map((objectId) => ({
    objectId,
    weight: 1,
  }));
  return new SealClient({
    suiClient,
    serverConfigs,
    verifyKeyServers: false,
  });
};
