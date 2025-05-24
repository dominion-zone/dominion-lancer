import { Component, Match, Show, splitProps, Switch } from "solid-js";
import { SuiWallet } from "../contexts/SuiWallet";
import { formatAddress } from "@mysten/sui/utils";
import {
  SuiWalletConnected,
  SuiWalletConnecting,
  SuiWalletControllerConext,
} from "../contexts/SuiWalletController";
import { Button, ButtonRootProps } from "@kobalte/core/button";

export type ConnectSuiButtonProps = ButtonRootProps & {
  wallet: SuiWallet | undefined;
  user: string | undefined;
} & SuiWalletControllerConext;

export const ConnectSuiButton: Component<ConnectSuiButtonProps> = (props) => {
  const [myProps, buttonProps] = splitProps(props, [
    "wallet",
    "user",
    "status",
    "connect",
    "disconnect",
  ]);
  return (
    <Show
      when={
        myProps.wallet &&
        (myProps.status === SuiWalletConnected ||
          myProps.status === SuiWalletConnecting)
      }
      fallback={
        <Button
          {...buttonProps}
          onClick={() => myProps.connect()}
          disabled={!myProps.wallet}
        >
          Connect
        </Button>
      }
    >
      <Button {...buttonProps} onClick={() => myProps.disconnect()}>
        {myProps.user ? formatAddress(myProps.user) : "..."}
      </Button>
    </Show>
  );
};
