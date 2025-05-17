import { Component, createMemo, Setter } from "solid-js";
import { CheckIcon, ChevronsUpDown, ExternalLinkIcon } from "lucide-solid";
import { isWalletWithRequiredFeatureSet } from "@mysten/wallet-standard";
import { SuiWallet } from "../contexts/SuiWallet";
import { Wallet, wallets } from "../stores/wallets";
import { Select } from "@kobalte/core/select";
import styles from "~/styles/Select.module.css";

export type SuiWalletSelectProps = {
  wallet: SuiWallet | undefined;
  setWallet: Setter<SuiWallet | undefined>;
  walletFilter?: (wallet: Wallet) => boolean;
};

export const SuiWalletSelect: Component<SuiWalletSelectProps> = (props) => {
  const filteredWallets = createMemo(() => {
    return wallets.filter(
      (wallet): wallet is SuiWallet =>
        isWalletWithRequiredFeatureSet(wallet) &&
        wallet.chains.some((chain) => chain.split(":")[0] === "sui") &&
        (!props.walletFilter || props.walletFilter(wallet))
    );
  });

  return (
    <Select<Wallet>
      options={filteredWallets()}
      value={props.wallet}
      onChange={props.setWallet}
      optionValue="id"
      optionTextValue="name"
      disallowEmptySelection
      placeholder="..."
      itemComponent={(props) => (
        <Select.Item item={props.item} class={styles.selectItem}>
          <Select.ItemLabel>{props.item.rawValue.name}</Select.ItemLabel>
          <Select.ItemIndicator class={styles.selectItemIndicator}>
            <CheckIcon />
          </Select.ItemIndicator>
        </Select.Item>
      )}
    >
      <Select.Trigger class={styles.selectTrigger} aria-label="Network">
        <Select.Value<Wallet> class={styles.selectValue}>
          {(state) => state.selectedOption().name}
        </Select.Value>
        <Select.Icon class={styles.selectIcon}>
          <ChevronsUpDown size={20} />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content class={styles.selectContent}>
          <Select.Listbox class={styles.selectListbox} />
        </Select.Content>
      </Select.Portal>
    </Select>
  );
  /*
  return (
    <Listbox
      value={props.wallet?.id ?? null}
      onSelectChange={w =>
        props.setWallet(
          (wallets as SuiWallet[]).find(({id}) => id === w) ?? undefined,
        )
      }
      {...listboxProps}
    >
      <div class={props.style?.container ?? 'listbox__container'}>
        <ListboxButton
          class={props.style?.button ?? 'listbox__button'}
          type="button"
        >
          <span class={props.style?.['button-text'] ?? 'listbox__button-text'}>
            {myProps.wallet?.name ?? 'Select a wallet'}
          </span>
          <span class={props.style?.['button-icon'] ?? 'listbox__button-icon'}>
            <ChevronsUpDown
              class={props.style?.icon ?? 'listbox__icon'}
              aria-hidden="true"
            />
          </span>
        </ListboxButton>
        <DisclosureStateChild>
          {({isOpen}): JSX.Element => (
            <Transition
              show={isOpen()}
              enter={
                props.style?.['transition--enter'] ??
                'listbox__transition--enter'
              }
              enterFrom={
                props.style?.['transition--enter-from'] ??
                'listbox__transition--enter-from'
              }
              enterTo={
                props.style?.['transition--enter-to'] ??
                'listbox__transition--enter-to'
              }
              leave={
                props.style?.['transition--leave'] ??
                'listbox__transition--leave'
              }
              leaveFrom={
                props.style?.['transition--leave-from'] ??
                'listbox__transition--leave-from'
              }
              leaveTo={
                props.style?.['transition--leave-to'] ??
                'listbox__transition--leave-to'
              }
            >
              <ListboxOptions
                unmount={false}
                class={props.style?.options ?? 'listbox__options'}
              >
                <For each={collection()}>
                  {(wallet): JSX.Element => (
                    <ListboxOption
                      class={props.style?.option ?? 'listbox__option'}
                      value={wallet.id}
                    >
                      {({isActive, isSelected}): JSX.Element => (
                        <div
                          classList={{
                            [props.style?.['option-content'] ??
                            'listbox__option-content']: true,
                            [props.style?.['option-active'] ??
                            'listbox__option--active']: isActive(),
                          }}
                        >
                          <span
                            classList={{
                              [props.style?.['option-text'] ??
                              'listbox__option-text']: true,
                              [props.style?.['option-text--selected'] ??
                              'listbox__option-text--selected']: isSelected(),
                            }}
                          >
                            {wallet.name}
                          </span>
                          <Show when={isSelected()}>
                            <span
                              class={
                                props.style?.['check-icon'] ??
                                'listbox__check-icon'
                              }
                            >
                              <CheckIcon
                                class={props.style?.icon ?? 'listbox__icon'}
                                aria-hidden="true"
                              />
                            </span>
                          </Show>
                        </div>
                      )}
                    </ListboxOption>
                  )}
                </For>
              </ListboxOptions>
            </Transition>
          )}
        </DisclosureStateChild>
      </div>
    </Listbox>
    */
};
