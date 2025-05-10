import { Component, Setter, splitProps } from "solid-js";
import { CheckIcon, ChevronsUpDown } from "lucide-solid";
import { Select, SelectRootProps } from "@kobalte/core/select";
import styles from "~/styles/Select.module.css";

export type SuiNetworkSelectProps = {
  networks: string[];
  network: string;
  setNetwork: Setter<string>;
};

export const SuiNetworkSelect: Component<SuiNetworkSelectProps> = (props) => {
  const [myProps, selectProps] = splitProps(props, [
    "networks",
    "network",
    "setNetwork",
  ]);
  return (
    <Select<string>
      options={props.networks}
      value={myProps.network}
      onChange={myProps.setNetwork}
      disallowEmptySelection
      itemComponent={(props) => (
        <Select.Item item={props.item} class={styles.selectItem}>
          <Select.ItemLabel>{props.item.rawValue}</Select.ItemLabel>
          <Select.ItemIndicator class={styles.selectItemIndicator}>
            <CheckIcon />
          </Select.ItemIndicator>
        </Select.Item>
      )}
    >
      <Select.Trigger class={styles.selectTrigger} aria-label="Network">
        <Select.Value<string> class={styles.selectValue}>
          {(state) => state.selectedOption()}
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
};
