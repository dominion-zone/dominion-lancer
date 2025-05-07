import { Show } from "solid-js";
import styles from "./AppBar.module.css";
import { networks } from "~/stores/config";
import { SuiNetworkSelect } from "./SuiNetworkSelect";
import { useSuiNetwork, useSuiUser, useSuiWallet, useSuiWalletController } from "~/contexts";
import { SuiWalletSelect } from "./SuiWalletSelect";
import { ConnectSuiButton } from "./ConnectSuiButton";

const AppBar = () => {
  const network = useSuiNetwork();
  const wallet = useSuiWallet();
  const walletController = useSuiWalletController();
  const user = useSuiUser();
  
  return (
    <header class={styles.header}>
      <div class={styles.headerContainer}>
        <a href="/" class={styles.logo}>
          <img class={styles.logoIcon} src="./lancer.png" />
          <div class={styles.titleContainer}>
            <div class={styles.title}>Dominion</div>
            <div class={styles.subtitle}>Lancer</div>
          </div>
        </a>
        <nav class={styles.navControls}>
          <Show when={networks.length > 1}>
            <SuiNetworkSelect
              networks={networks}
              network={network.value}
              setNetwork={network.set!}
              style={{root: styles.networkSelect}}
            />
          </Show>
          <SuiWalletSelect
            wallet={wallet.value}
            setWallet={wallet.set!}
          />
          <ConnectSuiButton
            class={styles.connectButton}
            wallet={wallet.value}
            user={user.value}
            {...walletController}
          />
        </nav>
      </div>
    </header>
  );
};

export default AppBar;
