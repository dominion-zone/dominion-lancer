import {
  Link,
  Outlet,
  createRootRoute,
  useMatches,
  useSearch,
} from "@tanstack/solid-router";

import { clientOnly } from "@solidjs/start";
import { createSignal, Setter, Suspense } from "solid-js";
import AppBar from "~/components/AppBar";
import Sidebar from "~/components/Sidebar";
import Footer from "~/components/Footer";
import { z } from "zod";
import { zodValidator } from "@tanstack/zod-adapter";
import { makePersisted } from "@solid-primitives/storage";
import {
  SuiAutoconnectProvider,
  SuiClientFactoryProvider,
  SuiNetworkProvider,
  SuiUserProvider,
  SuiWallet,
  SuiWalletControllerProvider,
  SuiWalletProvider,
} from "~/contexts";
import { wallets } from "~/stores/wallets";
import { isWalletWithRequiredFeatureSet } from "@mysten/wallet-standard";
import { setConfigs, suiClientCache } from "~/stores/suiClient";
import { useConfig, Network, networks } from "~/stores/config";

import "../listbox.css";
import { QueryClientProvider } from "@tanstack/solid-query";
import { queryClient } from "~/queries/client";
import AppToaster from "~/components/AppToaster";

const Devtools = clientOnly(() => import("../components/Devtools"));

const rootSearchSchema = z.object({
  network: z.enum(networks).default("devnet"),
  user: z.string().optional(),
});

export const Route = createRootRoute({
  component: RootComponent,
  validateSearch: zodValidator(rootSearchSchema),
});

function RootComponent() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const matches = useMatches();

  const setSuiNetwork = ((value: Network | ((prev: Network) => Network)) => {
    if (typeof value === "function") {
      value = value(search().network);
    }
    navigate({
      from: matches()[matches().length - 1].fullPath,
      to: ".",
      search: (prev) => ({
        ...prev,
        network: value,
      }),
    });
    return value;
  }) as Setter<string>;

  const setSuiUser = ((value) => {
    const v = typeof value === "function" ? value(search().user) : value;
    navigate({
      from: matches()[matches().length - 1].fullPath,
      to: ".",
      search: (prev) => ({
        ...prev,
        user: v,
      }),
    });
    return value;
  }) as Setter<string | undefined>;

  const [suiWallet, setSuiWallet] = makePersisted(
    createSignal<SuiWallet | undefined>(undefined),
    {
      serialize(w: SuiWallet | undefined) {
        return w?.id ?? "";
      },
      deserialize(id: string) {
        return (
          (wallets.find(
            (w) =>
              w.id === id &&
              isWalletWithRequiredFeatureSet(w) &&
              w.chains.some((chain) => chain.split(":")[0] === "sui")
          ) as SuiWallet) ?? undefined
        );
      },
    }
  );

  const [suiAutoconnect, setSuiAutoconnect] = makePersisted(
    createSignal(false)
  );

  const setSuiNetworkChecked = ((
    value: Network | ((prev: Network) => Network)
  ) =>
    setSuiNetwork((prev) => {
      if (typeof value === "function") {
        value = value(prev as Network);
      }
      if (value in networks) {
        return value;
      } else {
        return prev;
      }
    })) as Setter<string>;

  return (
    <QueryClientProvider client={queryClient}>
      <SuiUserProvider value={search().user} set={setSuiUser}>
        <SuiNetworkProvider value={search().network} set={setSuiNetwork}>
          <SuiClientFactoryProvider
            value={suiClientCache}
            set={setConfigs}
            netrwork={search().network}
          >
            <SuiWalletProvider value={suiWallet()} set={setSuiWallet}>
              <SuiAutoconnectProvider
                value={suiAutoconnect()}
                set={setSuiAutoconnect}
              >
                <SuiWalletControllerProvider
                  wallet={suiWallet()}
                  autoConnect={suiAutoconnect()}
                  user={search().user}
                  setUser={setSuiUser}
                  network={search().network}
                  setNetwork={setSuiNetworkChecked}
                >
                  <AppBar />
                  <div class="container">
                    <Sidebar />
                    <Suspense>
                      <Outlet />
                      <Devtools />
                    </Suspense>
                  </div>
                  <Footer />
                  <AppToaster />
                </SuiWalletControllerProvider>
              </SuiAutoconnectProvider>
            </SuiWalletProvider>
          </SuiClientFactoryProvider>
        </SuiNetworkProvider>
      </SuiUserProvider>
    </QueryClientProvider>
  );
}
