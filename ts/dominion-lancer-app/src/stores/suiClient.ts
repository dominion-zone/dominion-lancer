import { createStore } from "solid-js/store";
import { getFullnodeUrl, SuiClient } from "@mysten/sui/client";
import { SuiGraphQLClient } from "@mysten/sui/graphql";

export type SuiNetworkConfig = {
  url: string;
  graphQLUrl?: string;
};

export type SuiNetworkConfigs<T extends SuiNetworkConfig = SuiNetworkConfig> =
  Record<string, T>;

export const DEFAULT_NETWORK_CONFIGS: SuiNetworkConfigs = {
  mainnet: {
    url: getFullnodeUrl("mainnet"),
    graphQLUrl: "https://sui-mainnet.mystenlabs.com/graphql",
  },
  testnet: {
    url: getFullnodeUrl("testnet"),
    graphQLUrl: "https://sui-testnet.mystenlabs.com/graphql",
  },
  devnet: { url: getFullnodeUrl("devnet") },
  localnet: { url: getFullnodeUrl("localnet") },
};

export type SuiClientCache = {
  configs: SuiNetworkConfigs;
  client(network: string): SuiClient;
  graphqlClient(network: string): SuiGraphQLClient | null;
};

export type CreateSuiClientCacheProps = {
  configs?: SuiNetworkConfigs;
  createClient?: (url: string) => SuiClient;
};

export const createSuiClientCache = ({
  configs = DEFAULT_NETWORK_CONFIGS,
  createClient = (url) => new SuiClient({ url }),
}: CreateSuiClientCacheProps) => {
  const rpcCache = new Map<string, SuiClient>();
  const graphqlCache = new Map<string, SuiGraphQLClient>();

  return {
    configs,
    client(network: string) {
      const url = configs[network]?.url;
      if (!url) {
        throw new Error(`Network ${network} not found`);
      }
      if (!rpcCache.has(url)) {
        const client = createClient(url);
        rpcCache.set(network, client);
        return client;
      }
      return rpcCache.get(network)!;
    },
    graphqlClient(network: string) {
      if (!configs[network]) {
        throw new Error(`Network ${network} not found`);
      }
      const url = configs[network]?.graphQLUrl;
      if (!url) {
        return null;
      }
      if (!graphqlCache.has(url)) {
        const client = new SuiGraphQLClient({ url });
        graphqlCache.set(network, client);
        return client;
      }
      return graphqlCache.get(network)!;
    },
  };
};

const [configs, setConfigs] = createStore(DEFAULT_NETWORK_CONFIGS);

export const suiClientCache = createSuiClientCache({ configs });
export { setConfigs };
export const useSui = (network: string) => suiClientCache.client(network);
export const useSuiGraphQL = (network: string) =>
  suiClientCache.graphqlClient(network);
