import {
  Component,
  createContext,
  createMemo,
  ParentProps,
  useContext,
} from 'solid-js';
import {SetStoreFunction} from 'solid-js/store';
import {SuiNetworkConfigProvider} from './SuiNetworkConfig';
import {SuiClientProvider} from './SuiClient';
import {SuiClientCache, SuiNetworkConfigs} from '../stores/SuiClientCache';

export type SuiClientFactoryContext = {
  value: SuiClientCache;
  set?: SetStoreFunction<SuiNetworkConfigs>;
};

const SuiClientFactoryContext = createContext<SuiClientFactoryContext>();

export type SuiClientFactoryProviderProps = ParentProps<{
  value: SuiClientCache;
  set?: SetStoreFunction<SuiNetworkConfigs>;
  netrwork: string;
}>;

export const SuiClientFactoryProvider: Component<
  SuiClientFactoryProviderProps
> = props => {
  const suiNetworkConfig = createMemo(
    () => props.value.configs[props.netrwork],
  );

  const suiClient = () => {
    return props.value.client(props.netrwork);
  };

  return (
    <SuiClientFactoryContext.Provider
      value={{
        get value() {
          return props.value;
        },
        set: props.set,
      }}
    >
      <SuiNetworkConfigProvider value={suiNetworkConfig()}>
        <SuiClientProvider value={suiClient()}>
          {props.children}
        </SuiClientProvider>
      </SuiNetworkConfigProvider>
    </SuiClientFactoryContext.Provider>
  );
};

export const useSuiNetworkConfigs = (): SuiClientFactoryContext => {
  const configs = useContext(SuiClientFactoryContext);
  if (!configs) {
    throw new Error(
      'useSuiClientFactory must be used within a SuiClientFactoryProvider',
    );
  }
  return configs;
};
