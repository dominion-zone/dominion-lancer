import { createStore } from "solid-js/store";
import { SuiNetworkConfig } from "../contexts";
import { getFullnodeUrl, SuiClient } from "@mysten/sui/client";

export type SuiNetworkConfigs<T extends SuiNetworkConfig = SuiNetworkConfig> =
  Record<string, T>;

export const DEFAULT_NETWORK_CONFIGS: SuiNetworkConfigs = {
  mainnet: { url: getFullnodeUrl("mainnet") },
  testnet: { url: getFullnodeUrl("testnet") },
  devnet: { url: getFullnodeUrl("devnet") },
  localnet: { url: getFullnodeUrl("localnet") },
};

export type SuiClientCache = {
  configs: SuiNetworkConfigs;
  client(network: string): SuiClient;
};

export type CreateSuiClientCacheProps = {
  configs?: SuiNetworkConfigs;
  createClient?: (url: string) => SuiClient;
};

export const createSuiClientCache = ({
  configs = DEFAULT_NETWORK_CONFIGS,
  createClient = (url) => new SuiClient({ url }),
}: CreateSuiClientCacheProps) => {
  const cache = new Map<string, SuiClient>();

  return {
    configs,
    client(network: string) {
      const url = configs[network]?.url;
      if (!url) {
        throw new Error(`Network ${network} not found`);
      }
      if (!cache.has(url)) {
        const client = createClient(url);
        cache.set(network, client);
        return client;
      }
      return cache.get(network)!;
    },
  };
};

const [configs, setConfigs] = createStore(DEFAULT_NETWORK_CONFIGS);

export const suiClientCache = createSuiClientCache({ configs });
export { setConfigs };
export const suiClient = (network: string) => suiClientCache.client(network);
