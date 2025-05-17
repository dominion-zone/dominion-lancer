import { createLink } from "@tanstack/solid-router";
import { Check, ListFilterPlus, Plus } from "lucide-solid";
import { Accessor, Setter } from "solid-js";
import { Checkbox } from "@kobalte/core/checkbox";
import { Button } from "@kobalte/core/button";
import checkboxStyles from "~/styles/Checkbox.module.css";
import styles from "~/styles/bugBounty/index/Toolbox.module.css";
import { FindingStatus } from "~/sdk/Finding";
import { useSuiUser } from "~/contexts";
import BugBountySelect from "../BugBountySelect";
import FindingStatusSelect from "./FindingStatusSelect";

export type FindingsToolboxProps = {
  filterMineChecked: Accessor<boolean>;
  setFilterMineChecked: Setter<boolean>;
  filterBugBountyId: Accessor<string | null>;
  setFilterBugBountyId: Setter<string | null>;
  filterStatus: Accessor<FindingStatus | null>;
  setFilterStatus: Setter<FindingStatus | null>;
};

const FindingsToolbox = (props: FindingsToolboxProps) => {
  const LinkButton = createLink(Button);
  const user = useSuiUser();

  return (
    <section classList={{ card: true, [styles.toolboxContainer]: true }}>
      <div class={styles.toolbox}>
        <Checkbox
          class={checkboxStyles.checkbox}
          checked={props.filterMineChecked()}
          onChange={props.setFilterMineChecked}
          disabled={!user.value}
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
        <BugBountySelect bugBountyId={props.filterBugBountyId()} setBugBountyId={props.setFilterBugBountyId}/>

        <FindingStatusSelect status={props.filterStatus()} setStatus={props.setFilterStatus} />

        <Button class={styles.iconButton}>
          <ListFilterPlus size={20} />
        </Button>

        <LinkButton
          disabled={!user.value}
          to="/finding/new"
          search={(v) => ({ network: v.network, user: v.user! })}
          classList={{ [styles.iconButton]: true }}
        >
          <Plus size={20} />
        </LinkButton>
      </div>
    </section>
  );
};

export default FindingsToolbox;
