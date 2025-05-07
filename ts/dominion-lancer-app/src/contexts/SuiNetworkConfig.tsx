import {
  useContext,
  createContext,
  Component,
  Setter,
  ParentProps,
} from 'solid-js';

export type SuiNetworkConfig = {
  url: string;
};

export type SuiNetworkConfigContext = {
  value: SuiNetworkConfig;
  set?: Setter<SuiNetworkConfig>;
};

const SuiNetworkConfigContext = createContext<SuiNetworkConfigContext>();

export type SuiNetworkConfigProviderProps = ParentProps<{
  value: SuiNetworkConfig;
  set?: Setter<SuiNetworkConfig>;
}>;

export const SuiNetworkConfigProvider: Component<
  SuiNetworkConfigProviderProps
> = props => {
  return (
    <SuiNetworkConfigContext.Provider
      value={{
        get value() {
          return props.value;
        },
        set: props.set,
      }}
    >
      {props.children}
    </SuiNetworkConfigContext.Provider>
  );
};

export const useSuiNetworkConfig = (): SuiNetworkConfigContext => {
  const suiNetworkConfig = useContext(SuiNetworkConfigContext);
  if (!suiNetworkConfig) {
    throw new Error(
      'useSuiNetworkConfig must be used within a SuiNetworkConfigProvider',
    );
  }
  return suiNetworkConfig;
};
