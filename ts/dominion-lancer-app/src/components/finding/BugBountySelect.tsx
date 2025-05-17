import { Combobox, ComboboxRootProps } from "@kobalte/core/combobox";
import { Updater } from "@tanstack/solid-form";
import { CheckIcon, ChevronsUpDown } from "lucide-solid";
import { Setter, splitProps } from "solid-js";
import { useSuiNetwork } from "~/contexts";
import { BugBounty } from "~/sdk/BugBounty";
import { Network } from "~/stores/config";
import styles from "~/styles/Combobox.module.css";
import { formatAddress } from "@mysten/sui/utils";
import { useBugBounties } from "~/queries/bugBounties";

export type BugBountySelectProps = {
  bugBountyId: string | null;
  setBugBountyId: Setter<string | null>;
} & Pick<ComboboxRootProps<BugBounty>, "name">;

const BugBountySelect = (props: BugBountySelectProps) => {
  const [myProps, comboboxProps] = splitProps(props, [
    "bugBountyId",
    "setBugBountyId",
  ]);
  const network = useSuiNetwork();
  const { filtered } = useBugBounties(() => ({
    network: network.value as Network,
  }));
  const onInputChange = (value: string) => {
    if (value === "") {
      props.setBugBountyId(null);
    }
  };
  return (
    <Combobox<BugBounty>
      {...comboboxProps}
      options={filtered()}
      value={filtered().find(({ id }) => id === myProps.bugBountyId) || undefined}
      onChange={(v) => props.setBugBountyId(v?.id || null)}
      onInputChange={onInputChange}
      placeholder="Enter a bug bounty id…"
      optionValue="id"
      optionTextValue="id"
      optionLabel="id"
      optionDisabled={({ isActive }) => !isActive}
      defaultFilter={(bounty, input) =>
        bounty.id.startsWith(input.toLowerCase()) ||
        bounty.id.startsWith("0x" + input.toLowerCase()) ||
        bounty.name.toLowerCase().startsWith(input.toLowerCase())
      }
      itemComponent={(props) => (
        <Combobox.Item item={props.item} class={styles.comboboxItem}>
          <Combobox.ItemLabel>
            {formatAddress(props.item.rawValue.id)} {props.item.rawValue.name}
          </Combobox.ItemLabel>
          <Combobox.ItemIndicator class={styles.comboboxItemIndicator}>
            <CheckIcon />
          </Combobox.ItemIndicator>
        </Combobox.Item>
      )}
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
