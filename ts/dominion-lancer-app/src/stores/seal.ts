import { getAllowlistedKeyServers, SealClient } from "@mysten/seal";
import { useSui } from "./suiClient";

export const sealClient = (network: string) =>
  new SealClient({
    suiClient: useSui(network),
    serverObjectIds: getAllowlistedKeyServers("testnet").map((server) => [
      server,
      1,
    ]),
    verifyKeyServers: false,
  });
