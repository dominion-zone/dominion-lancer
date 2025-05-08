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
};

const LinkButton = createLink(Button);

const BugBountyToolbox = (props: BugBountyFilterProps) => {
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

        <Button class="icon-button">
          <ListFilterPlus />
        </Button>

        <LinkButton
          disabled={!props.user}
          to="/bug-bounties/new"
          search={(v) => ({ user: v.user!, ...v })}
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
