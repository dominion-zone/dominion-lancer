import { WalrusClient } from "@mysten/walrus";
import { Network } from "./config";
import { getFullnodeUrl } from "@mysten/sui/client";

export const walrusClient = (network: Network) =>
    new WalrusClient({
      network,
      suiRpcUrl: getFullnodeUrl(network),
      wasmUrl:
        "https://unpkg.com/@mysten/walrus-wasm@latest/web/walrus_wasm_bg.wasm",
    });