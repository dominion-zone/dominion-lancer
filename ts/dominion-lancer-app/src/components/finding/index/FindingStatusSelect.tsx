import { Component, Setter, splitProps } from "solid-js";
import { CheckIcon, ChevronsUpDown } from "lucide-solid";
import { Select, SelectRootProps } from "@kobalte/core/select";
import styles from "~/styles/Select.module.css";
import { FindingStatus, findingStatuses } from "~/sdk/Finding";

export type FindingStatusSelectProps = {
  status: FindingStatus | null;
  setStatus: Setter<FindingStatus | null>;
};

const FindingStatusSelect: Component<FindingStatusSelectProps> = (props) => {
  const [myProps, selectProps] = splitProps(props, [
    "status",
    "setStatus",
  ]);
  return (
    <Select<FindingStatus>
      options={findingStatuses}
      value={myProps.status}
      onChange={myProps.setStatus}
      placeholder="All"
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

export default FindingStatusSelect;