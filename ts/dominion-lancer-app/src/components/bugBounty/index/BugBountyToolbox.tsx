import { createLink } from "@tanstack/solid-router";
import { Check, ListFilterPlus, Plus } from "lucide-solid";
import { Accessor, Setter } from "solid-js";
import { Checkbox } from "@kobalte/core/checkbox";
import { Button } from "@kobalte/core/button";
import checkboxStyles from "~/styles/Checkbox.module.css";
import styles from "~/styles/bugBounty/index/Toolbox.module.css";

export type BugBountyFilterProps = {
  user?: string;
  filterMineChecked: Accessor<boolean>;
  setFilterMineChecked: Setter<boolean>;
  filterActiveChecked: Accessor<boolean>;
  setFilterActiveChecked: Setter<boolean>;
  filterApprovedChecked: Accessor<boolean>;
  setFilterApprovedChecked: Setter<boolean>;
};

const BugBountyToolbox = (props: BugBountyFilterProps) => {
  const LinkButton = createLink(Button);

  return (
    <section classList={{ card: true, [styles.toolboxContainer]: true }}>
      <div class={styles.toolbox}>
        <Checkbox
          class={checkboxStyles.checkbox}
          checked={props.filterMineChecked()}
          onChange={props.setFilterMineChecked}
          disabled={!props.user}
        >
          <Checkbox.Input class={checkboxStyles.checkboxInput} />
          <Checkbox.Control class={checkboxStyles.checkboxControl}>
            <Checkbox.Indicator>
              <Check size={20} />
            </Checkbox.Indicator>
          </Checkbox.Control>
          <Checkbox.Label class={checkboxStyles.checkboxLabel}>
            Only Mine
          </Checkbox.Label>
        </Checkbox>
        <Checkbox
          class={checkboxStyles.checkbox}
          checked={props.filterActiveChecked()}
          onChange={props.setFilterActiveChecked}
        >
          <Checkbox.Input class={checkboxStyles.checkboxInput} />
          <Checkbox.Control class={checkboxStyles.checkboxControl}>
            <Checkbox.Indicator>
              <Check size={20} />
            </Checkbox.Indicator>
          </Checkbox.Control>
          <Checkbox.Label class={checkboxStyles.checkboxLabel}>
            Only Active
          </Checkbox.Label>
        </Checkbox>

        <Checkbox
          class={checkboxStyles.checkbox}
          checked={props.filterApprovedChecked()}
          onChange={props.setFilterApprovedChecked}
        >
          <Checkbox.Input class={checkboxStyles.checkboxInput} />
          <Checkbox.Control class={checkboxStyles.checkboxControl}>
            <Checkbox.Indicator>
              <Check size={20} />
            </Checkbox.Indicator>
          </Checkbox.Control>
          <Checkbox.Label class={checkboxStyles.checkboxLabel}>
            Only Approved
          </Checkbox.Label>
        </Checkbox>

        <Button class={styles.iconButton}>
          <ListFilterPlus size={20} />
        </Button>

        <LinkButton
          disabled={!props.user}
          to="/bug-bounties/new"
          search={(v) => ({ network: v.network, user: v.user! })}
          classList={{ [styles.iconButton]: true }}
        >
          <Plus size={20} />
        </LinkButton>
      </div>
    </section>
  );
};

export default BugBountyToolbox;
