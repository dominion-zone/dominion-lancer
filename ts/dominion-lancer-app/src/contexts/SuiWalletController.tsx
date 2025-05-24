import {
  Component,
  createContext,
  createEffect,
  createSignal,
  ParentProps,
  Setter,
  useContext,
} from "solid-js";
import { SuiWallet } from "./SuiWallet";
import { StandardConnect, StandardDisconnect } from "@mysten/wallet-standard";

export const SuiWalletNotConnected = "not-connected";
export const SuiWalletDisconnected = "disconnected";
export const SuiWalletConnecting = "connecting";
export const SuiWalletConnected = "connected";

export type SuiWalletConnectionStatus =
  | typeof SuiWalletNotConnected
  | typeof SuiWalletDisconnected
  | typeof SuiWalletConnecting
  | typeof SuiWalletConnected;

export type SuiWalletControllerConext = {
  status: SuiWalletConnectionStatus;
  connect: () => void;
  disconnect: () => void;
};

const SuiWalletControllerConext = createContext<SuiWalletControllerConext>();

export type SuiWalletControllerContextProviderProps = ParentProps<{
  autoConnect?: boolean;
  wallet: SuiWallet | undefined;
  user: string | undefined;
  setUser: Setter<string | undefined>;
  network: string;
  setNetwork: Setter<string>;
}>;

export const SuiWalletControllerProvider: Component<
  SuiWalletControllerContextProviderProps
> = (props) => {
  const [status, setStatus] = createSignal<SuiWalletConnectionStatus>(
    SuiWalletNotConnected
  );

  createEffect((oldChains) => {
    if (!props.wallet || oldChains === props.wallet.chains) {
      return;
    }
    if (!props.wallet.chains.includes(`sui:${props.network}`)) {
      const suiNetwork = props.wallet.chains.find((c) => c.startsWith("sui:"));
      if (suiNetwork) {
        props.setNetwork(suiNetwork.split(":")[1]);
      }
    }
    return props.wallet.chains;
  }, props.wallet?.chains);

  createEffect((oldAccounts) => {
    if (!props.user || !props.wallet || oldAccounts === props.wallet.accounts) {
      return;
    }
    if (
      props.wallet.accounts.every((a) => a.address !== props.user) &&
      props.wallet.accounts.length > 0 &&
      props.wallet.chains.find((c) => c.startsWith("sui:"))
    ) {
      props.setUser(props.wallet.accounts[0].address);
    }
  }, props.wallet?.accounts);

  const connect = () => {
    if (!props.wallet) {
      return;
    }
    setStatus(SuiWalletConnecting);
    props.wallet.features[StandardConnect].connect()
      .then(({ accounts }) => {
        if (
          accounts &&
          (!props.user || accounts.every((a) => a.address !== props.user))
        ) {
          const account = accounts.find((a) =>
            a.chains.find((c) => c.startsWith("sui:"))
          );
          if (account) {
            props.setUser(account.address);
          } else {
            props.setUser(undefined);
          }
        }
        setStatus(SuiWalletConnected);
      })
      .catch(() => {
        setStatus(SuiWalletDisconnected);
      });
  };

  const disconnect = () => {
    if (!props.wallet) {
      return;
    }
    const s = status();
    if (s === SuiWalletConnecting || s === SuiWalletConnected) {
      const disconnect = props.wallet.features[StandardDisconnect];
      if (disconnect) {
        disconnect.disconnect().finally(() => {
          setStatus(SuiWalletDisconnected);
          props.setUser(undefined);
        });
      } else {
        setStatus(SuiWalletDisconnected);
        props.setUser(undefined);
      }
    }
  };

  createEffect<SuiWallet | undefined>((prevWallet) => {
    if (prevWallet?.id === props.wallet?.id) {
      return props.wallet;
    }

    if (prevWallet) {
      const s = status();
      if (s === SuiWalletConnecting || s === SuiWalletConnected) {
        const disconnect = prevWallet.features[StandardDisconnect];
        if (disconnect) {
          disconnect.disconnect().finally(() => {
            setStatus(SuiWalletNotConnected);
          });
        } else {
          setStatus(SuiWalletNotConnected);
        }
      }
    }

    return props.wallet;
  }, undefined);

  createEffect(() => {
    if (props.autoConnect && props.wallet && status() === SuiWalletNotConnected) {
      connect();
    }
  });

  return (
    <SuiWalletControllerConext.Provider
      value={{
        get status() {
          return status();
        },
        connect,
        disconnect,
      }}
    >
      {props.children}
    </SuiWalletControllerConext.Provider>
  );
};

export const useSuiWalletController = (): SuiWalletControllerConext => {
  const controller = useContext(SuiWalletControllerConext);
  if (!controller) {
    throw new Error(
      "useSuiWalletController must be used within a SuiWalletControllerProvider"
    );
  }
  return controller;
};
