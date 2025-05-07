import {createContext, ParentProps, Setter, useContext} from 'solid-js';

export type SuiAutoconnectContext = {value: boolean; set?: Setter<boolean>};

const SuiAutoconnectContext = createContext<SuiAutoconnectContext>();

export type SuiAutoconnectProviderProps = ParentProps<{
  value: boolean;
  set?: Setter<boolean>;
}>;

export const SuiAutoconnectProvider = (props: SuiAutoconnectProviderProps) => {
  return (
    <SuiAutoconnectContext.Provider
      value={{
        get value() {
          return props.value;
        },
        set: props.set,
      }}
    >
      {props.children}
    </SuiAutoconnectContext.Provider>
  );
};

export const useSuiAutoconnect = (): SuiAutoconnectContext => {
  const autoconnect = useContext(SuiAutoconnectContext);

  if (!autoconnect) {
    throw new Error(
      'useSuiAutoconnect must be used within a SuiAutoconnectProvider',
    );
  }

  return autoconnect;
};
