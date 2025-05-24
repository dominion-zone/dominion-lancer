import { Combobox, ComboboxRootProps } from "@kobalte/core/combobox";
import { Updater } from "@tanstack/solid-form";
import { CheckIcon, ChevronsUpDown } from "lucide-solid";
import { Setter, Show, splitProps } from "solid-js";
import { useSuiNetwork } from "~/contexts";
import { BugBounty } from "~/sdk/BugBounty";
import { Network } from "~/stores/config";
import styles from "~/styles/Combobox.module.css";
import { formatAddress } from "@mysten/sui/utils";
import { useBugBountyIds } from "~/queries/bugBountyIds";
import { useBugBounty } from "~/queries/bugBounty";
import { CollectionNode } from "@kobalte/core";

export type BugBountySelectProps = {
  bugBountyId: string | null;
  setBugBountyId: Setter<string | null>;
} & Pick<ComboboxRootProps<BugBounty>, "name">;

const BugBountyItem = (props: { item: CollectionNode<string> }) => {
  const network = useSuiNetwork();
  const bugBounty = useBugBounty({
    get network() {
      return network.value as Network;
    },
    get bugBountyId() {
      return props.item.rawValue;
    },
  });

  return (
    <Show when={bugBounty.data && bugBounty.data.isActive}>
      <Combobox.Item item={props.item} class={styles.comboboxItem}>
        <Combobox.ItemLabel>
          {formatAddress(props.item.rawValue)} {bugBounty.data?.name}
        </Combobox.ItemLabel>
        <Combobox.ItemIndicator class={styles.comboboxItemIndicator}>
          <CheckIcon />
        </Combobox.ItemIndicator>
      </Combobox.Item>
    </Show>
  );
};

const BugBountySelect = (props: BugBountySelectProps) => {
  const [myProps, comboboxProps] = splitProps(props, [
    "bugBountyId",
    "setBugBountyId",
  ]);
  const network = useSuiNetwork();
  const bugBounties = useBugBountyIds({
    get network() {
      return network.value as Network;
    },
  });
  const onInputChange = (value: string) => {
    if (value === "") {
      props.setBugBountyId(null);
    }
  };
  return (
    <Combobox<string>
      {...comboboxProps}
      options={bugBounties.data || []}
      value={props.bugBountyId}
      onChange={props.setBugBountyId}
      onInputChange={onInputChange}
      placeholder="Enter a bug bounty id…"
      defaultFilter={(bounty, input) =>
        bounty.startsWith(input.toLowerCase()) ||
        bounty.startsWith("0x" + input.toLowerCase())
      }
      itemComponent={(props) => <BugBountyItem item={props.item} />}
    >
      <Combobox.HiddenSelect />
      <Combobox.Control class={styles.comboboxControl} aria-label="Bug bounty">
        <Combobox.Input class={styles.comboboxInput} />
        <Combobox.Trigger class={styles.comboboxTrigger}>
          <Combobox.Icon class={styles.comboboxIcon}>
            <ChevronsUpDown size={20} />
          </Combobox.Icon>
        </Combobox.Trigger>
      </Combobox.Control>
      <Combobox.Portal>
        <Combobox.Content class={styles.comboboxContent}>
          <Combobox.Listbox class={styles.comboboxListbox} />
        </Combobox.Content>
      </Combobox.Portal>
    </Combobox>
  );
};

export default BugBountySelect;
