import {isSuiClient, SuiClient} from '@mysten/sui/client';
import {
  Component,
  createContext,
  useContext,
  Accessor,
  ParentProps,
} from 'solid-js';

const SuiClientContext = createContext<Accessor<SuiClient>>();

export type SuiClientProviderProps = ParentProps<{
  value: SuiClient;
}>;

export const SuiClientProvider: Component<SuiClientProviderProps> = props => {
  if (!isSuiClient(props.value)) {
    throw new Error('Invalid SuiClient');
  }

  return (
    <SuiClientContext.Provider value={() => props.value}>
      {props.children}
    </SuiClientContext.Provider>
  );
};

export const useSuiClient = (): Accessor<SuiClient> => {
  const suiClient = useContext(SuiClientContext);
  if (!suiClient) {
    throw new Error('useSuiClient must be used within a SuiClientProvider');
  }
  return suiClient;
};
