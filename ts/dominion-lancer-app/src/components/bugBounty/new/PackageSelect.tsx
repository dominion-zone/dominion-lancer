import { Combobox, ComboboxRootProps } from "@kobalte/core/combobox";
import { Updater } from "@tanstack/solid-form";
import { CheckIcon, ChevronsUpDown } from "lucide-solid";
import { Setter, splitProps } from "solid-js";
import { useSuiNetwork, useSuiUser } from "~/contexts";
import { Network } from "~/stores/config";
import styles from "../../../styles/Combobox.module.css";
import { formatAddress } from "@mysten/sui/utils";
import { userPackagesQuery } from "~/queries/userPackages";

export type PackageSelectProps = {
  packageId: string | null;
  setPackageId: Setter<string | null>;
  class: string;
} & Pick<
  ComboboxRootProps<{
    packageId: string;
    upgradeCapId: string;
  }>,
  "name"
>;

const PackageSelect = (props: PackageSelectProps) => {
  const [myProps, comboboxProps] = splitProps(props, [
    "packageId",
    "setPackageId",
  ]);
  const network = useSuiNetwork();
  const user = useSuiUser();
  const userPackages = userPackagesQuery(() => ({
    network: network.value,
    user: user.value!,
  }));
  const onInputChange = (value: string) => {
    if (value === "") {
      props.setPackageId(null);
    }
  };
  return (
    <Combobox<{
      packageId: string;
      upgradeCapId: string;
    }>
      {...comboboxProps}
      options={userPackages.data || []}
      value={
        userPackages.data?.find(
          ({ packageId }) => packageId === myProps.packageId
        ) || undefined
      }
      onChange={(p) => props.setPackageId(p?.packageId || null)}
      onInputChange={props.setPackageId}
      placeholder="Enter a package id…"
      optionValue="packageId"
      optionTextValue="packageId"
      optionLabel="packageId"
      defaultFilter={(p, input) =>
        p.packageId.startsWith(input.toLowerCase()) ||
        p.packageId.startsWith("0x" + input.toLowerCase())
      }
      itemComponent={(props) => (
        <Combobox.Item item={props.item} class={styles.comboboxItem}>
          <Combobox.ItemLabel>
            {formatAddress(props.item.rawValue.packageId)}
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

export default PackageSelect;
