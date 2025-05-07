import {
  Component,
  createContext,
  ParentProps,
  Setter,
  useContext,
} from 'solid-js';

export type SuiNetworkContext = {
  value: string;
  set?: Setter<string>;
};

const SuiNetworkContext = createContext<SuiNetworkContext>();

export type SuiNetworkProviderProps = ParentProps<{
  value: string;
  set?: Setter<string>;
}>;

export const SuiNetworkProvider: Component<SuiNetworkProviderProps> = props => {
  return (
    <SuiNetworkContext.Provider
      value={{
        get value() {
          return props.value;
        },
        set: props.set,
      }}
    >
      {props.children}
    </SuiNetworkContext.Provider>
  );
};

export const useSuiNetwork = (): SuiNetworkContext => {
  const suiNetwork = useContext(SuiNetworkContext);
  if (!suiNetwork) {
    throw new Error('useSuiNetwork must be used within a SuiNetworkProvider');
  }
  return suiNetwork;
};
