import {Component, Match, splitProps, Switch} from 'solid-js';
import {Button, ButtonProps} from 'terracotta';
import {SuiWallet} from '../contexts/SuiWallet';
import {formatAddress} from '@mysten/sui/utils';
import {SuiWalletControllerConext} from '../contexts/SuiWalletController';

export type ConnectSuiButtonProps = ButtonProps & {
  wallet: SuiWallet | undefined;
  user: string | undefined;
} & SuiWalletControllerConext;

export const ConnectSuiButton: Component<ConnectSuiButtonProps> = props => {
  const [myProps, buttonProps] = splitProps(props, [
    'wallet',
    'user',
    'status',
    'connect',
    'disconnect',
  ]);
  return (
    <Switch>
      <Match
        when={
          myProps.user && (!myProps.wallet || myProps.status === 'connected')
        }
      >
        <Button {...buttonProps}>{formatAddress(myProps.user!)}</Button>
      </Match>
      <Match when={!myProps.wallet && !myProps.user}>
        <Button {...buttonProps} disabled={true}>...</Button>
      </Match>
      <Match when={myProps.wallet && myProps.status !== 'connected'}>
        <Button
          {...buttonProps}
          onClick={() => myProps.connect()}
          disabled={myProps.status === 'connecting'}
        >
          Connect
        </Button>
      </Match>
    </Switch>
  );
};
