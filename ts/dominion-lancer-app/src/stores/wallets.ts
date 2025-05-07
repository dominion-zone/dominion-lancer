import {
  getWallets,
  Wallet as FrozenWallet,
  IdentifierString,
  WalletAccount,
  StandardEvents,
  StandardEventsFeature,
} from '@mysten/wallet-standard';
import {createStore} from 'solid-js/store';

export type Wallet<
  Features extends Record<IdentifierString, unknown> = Record<
    IdentifierString,
    unknown
  >,
> = Omit<FrozenWallet, 'id' | 'accounts' | 'chains' | 'features'> & {
  // original: FrozenWallet;
  id: string;
  accounts: WalletAccount[];
  chains: IdentifierString[];
  features: Features;
  unsubscribe: () => void;
  
  $accounts?: WalletAccount[];
  $chains?: IdentifierString[];
  $features?: Features;
};

const [wallets, setWallets] = createStore<Wallet[]>([]);

function getWalletUniqueIdentifier(wallet?: FrozenWallet) {
  return wallet?.id ?? wallet?.name;
}

const walletsApi = getWallets();

function onRegister(...newWallets: FrozenWallet[]) {
  for (const wallet of newWallets) {
    const id = getWalletUniqueIdentifier(wallet)!;

    const standardEvents = wallet.features[StandardEvents];
    const unsubscribe = standardEvents
      ? (standardEvents as StandardEventsFeature[typeof StandardEvents]).on(
          'change',
          ({accounts, chains, features}) => {
            if (accounts) {
              setWallets(
                w => w.id === id,
                'accounts',
                () => [...accounts],
              );
            }
            if (chains) {
              setWallets(
                w => w.id === id,
                'chains',
                () => [...chains],
              );
            }
            if (features) {
              setWallets(
                w => w.id === id,
                'features',
                () => ({...features}),
              );
            }
          },
        )
      : () => {};

    const walletCopy: Wallet = {
      get version() {
        return wallet.version;
      },
      get name() {
        return wallet.name;
      },
      get icon() {
        return wallet.icon;
      },
      id,
      get accounts() {
        return this.$accounts ?? [...wallet.accounts];
      },
      set accounts(accounts: WalletAccount[]) {
        this.$accounts = accounts;
      },
      get chains() {
        return this.$chains ?? [...wallet.chains];
      },
      set chains(chains: IdentifierString[]) {
        this.$chains = chains;
      },
      get features() {
        return this.$features ?? {...wallet.features};
      },
      set features(features: Record<IdentifierString, unknown>) {
        this.$features = features;
      },
      unsubscribe,
    };

    setWallets(wallets => [...wallets, walletCopy]);
  }
}

onRegister(...walletsApi.get());
walletsApi.on('register', onRegister);
walletsApi.on('unregister', (...wallets) => {
  for (const wallet of wallets) {
    const id = getWalletUniqueIdentifier(wallet)!;
    setWallets(wallets =>
      wallets.filter(w => w.id !== id || (w.unsubscribe(), false)),
    );
  }
});

export {wallets};
