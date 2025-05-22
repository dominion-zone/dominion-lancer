import { getAllowlistedKeyServers, SealClient } from "@mysten/seal";
import { suiClient } from "./suiClient";

export const sealClient = (network: string) =>
  new SealClient({
    suiClient: suiClient(network),
    serverObjectIds: getAllowlistedKeyServers("testnet").map((server) => [
      server,
      1,
    ]),
    verifyKeyServers: false,
  });
