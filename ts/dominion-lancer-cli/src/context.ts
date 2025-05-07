import {SuiClient} from '@mysten/sui/client';
import {Config} from './config';
import {Signer} from '@mysten/sui/cryptography';

export type Context = {
  config: Config;
  wallet?: Signer;
  client: SuiClient;
};

export let context: Context = undefined!;

export const setContext = (newContext: Context) => {
  context = newContext;
};
