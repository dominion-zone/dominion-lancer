import { For } from "solid-js";
import { JSX } from "solid-js/jsx-runtime";
import { Tab, TabGroup, TabList, TabPanel } from "terracotta";
import FindingList from "./FindingList";
import EditFinding from "./EditFinding";
import NewFinding from "./NewFinding";

const FindingsTabs = () => {
  return (
    <div class="findings-tabs">
      <TabGroup defaultValue="New" horizontal class="tabs__container">
        {({ isSelected, isActive }): JSX.Element => (
          <>
            <TabList class="tabs__list">
              <Tab
                value="List"
                classList={{
                  tabs__tab: true,
                  "tabs__tab--selected": isSelected("List"),
                  "tabs__tab--active": isActive("List"),
                }}
              >
                List
              </Tab>
              <Tab
                value="Edit"
                classList={{
                  tabs__tab: true,
                  "tabs__tab--selected": isSelected("Edit"),
                  "tabs__tab--active": isActive("Edit"),
                }}
              >
                Edit
              </Tab>
              <Tab
                value="New"
                classList={{
                  tabs__tab: true,
                  "tabs__tab--selected": isSelected("New"),
                  "tabs__tab--active": isActive("New"),
                }}
              >
                New
              </Tab>
            </TabList>
            <div class="tabs__content">
              <TabPanel
                value="List"
                classList={{
                  tabs__panel: true,
                }}
              >
                <FindingList />
              </TabPanel>
              <TabPanel
                value="Edit"
                classList={{
                  tabs__panel: true,
                }}
              >
                <EditFinding />
              </TabPanel>

              <TabPanel
                value="New"
                classList={{
                  tabs__panel: true,
                }}
              >
                <NewFinding />
              </TabPanel>
            </div>
          </>
        )}
      </TabGroup>
    </div>
  );
};

export default FindingsTabs;
