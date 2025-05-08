import { createLink } from "@tanstack/solid-router";
import { Check, ListFilterPlus, Plus } from "lucide-solid";
import { Accessor, Setter } from "solid-js";
import { Button, Checkbox, CheckboxIndicator } from "terracotta";

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
    <section class="card toolbox__container">
      <div class="toolbox">
        <Checkbox
          checked={props.filterMineChecked()}
          onChange={props.setFilterMineChecked}
          disabled={!props.user}
          class="checkbox"
        >
          <CheckboxIndicator class="icon-button" id="only-mine">
            <Check
              visibility={props.filterMineChecked() ? "visible" : "hidden"}
            />
          </CheckboxIndicator>
          <label for="only-mine">Only Mine</label>
        </Checkbox>

        <Checkbox
          checked={props.filterActiveChecked()}
          onChange={props.setFilterActiveChecked}
          class="checkbox"
        >
          <CheckboxIndicator class="icon-button" id="only-active">
            <Check
              visibility={props.filterActiveChecked() ? "visible" : "hidden"}
            />
          </CheckboxIndicator>
          <label for="only-active">Only Active</label>
        </Checkbox>

        <Checkbox
          checked={props.filterApprovedChecked()}
          onChange={props.setFilterApprovedChecked}
          class="checkbox"
        >
          <CheckboxIndicator class="icon-button" id="only-approved">
            <Check
              visibility={props.filterApprovedChecked() ? "visible" : "hidden"}
            />
          </CheckboxIndicator>
          <label for="only-approved">Only Approved</label>
        </Checkbox>

        <Button class="icon-button">
          <ListFilterPlus />
        </Button>

        <LinkButton
          disabled={!props.user}
          to="/bug-bounties/new"
          search={(v) => ({ network: v.network, user: v.user! })}
          class="icon-button"
          id="new-bug-bounty"
        >
          <Plus />
        </LinkButton>
      </div>
    </section>
  );
};

export default BugBountyToolbox;
