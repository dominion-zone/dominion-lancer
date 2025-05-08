import { createFileRoute, createLink } from "@tanstack/solid-router";
import { createForm } from "@tanstack/solid-form";
import {
  Button,
  DisclosureStateChild,
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
  Transition,
} from "terracotta";
import { CheckIcon, ChevronsUpDown } from "lucide-solid";
import { For, JSX, Show } from "solid-js";
import { userPackagesQuery } from "~/queries/userPackages";
import { useSuiNetwork, useSuiUser, useSuiWallet } from "~/contexts";
import { z } from "zod";
import { zodValidator } from "@tanstack/zod-adapter";
import { createBugBountyMutation } from "~/mutations/createBugBounty";
import { Network } from "~/stores/config";

const LinkButton = createLink(Button);

const searchSchema = z.object({
  user: z.string(),
});

export const Route = createFileRoute("/bug-bounties/new")({
  component: RouteComponent,
  validateSearch: zodValidator(searchSchema),
});

function RouteComponent() {
  const network = useSuiNetwork();
  const user = useSuiUser();
  const userPackages = userPackagesQuery({
    network: network.value,
    user: user.value!,
  });
  const wallet = useSuiWallet();

  const mutation = createBugBountyMutation();

  const form = createForm(() => ({
    defaultValues: {
      name: "",
      packageId: "",
    },

    onSubmit: async ({ value }) => {
      const upgradeCapId = userPackages.data?.find(
        (cap) => cap.packageId === value.packageId
      )?.upgradeCapId;
      await mutation.mutateAsync({
        network: network.value as Network,
        wallet: wallet.value!,
        user: user.value!,
        packageId: value.packageId,
        name: value.name,
        upgradeCapId,
      });
    },
  }));
  return (
    <main>
      <article class="card">
        <h2>New bug bounty program</h2>
        <form
          method="post"
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
        >
          <div class="form-field">
            <form.Field
              name="name"
              children={(field) => (
                <>
                  <label for={field().name}>Name:</label>
                  <input
                    id={field().name}
                    name={field().name}
                    value={field().state.value}
                    onBlur={field().handleBlur}
                    onChange={(e) => field().handleChange(e.target.value)}
                    type="text"
                  />
                </>
              )}
            />
          </div>
          <div class="form-field">
            <form.Field
              name="packageId"
              children={(field) => (
                <>
                  <label for={field().name}>Package:</label>
                  <Listbox
                    id={field().name}
                    value={field().state.value}
                    onBlur={field().handleBlur}
                    multiple={false}
                    defaultOpen={false}
                    onSelectChange={(v) => field().handleChange(v as string)}
                    class="listbox"
                  >
                    <div class="listbox__container">
                      <ListboxButton class="listbox__button" type="button">
                        <span class={"listbox__button-text"}>
                          {field().state.value}
                        </span>
                        <span class="listbox__button-icon">
                          <ChevronsUpDown
                            class="listbox__icon"
                            aria-hidden="true"
                          />
                        </span>
                      </ListboxButton>
                      <DisclosureStateChild>
                        {({ isOpen }): JSX.Element => (
                          <Transition
                            show={isOpen()}
                            enter="listbox__transition--enter"
                            enterFrom="listbox__transition--enter-from"
                            enterTo="listbox__transition--enter-to"
                            leave="listbox__transition--leave"
                            leaveFrom="listbox__transition--leave-from"
                            leaveTo="listbox__transition--leave-to"
                          >
                            <ListboxOptions
                              unmount={false}
                              class="listbox__options"
                            >
                              <For each={userPackages.data}>
                                {({ packageId }): JSX.Element => (
                                  <ListboxOption
                                    class="listbox__option"
                                    value={packageId}
                                  >
                                    {({
                                      isActive,
                                      isSelected,
                                    }): JSX.Element => (
                                      <div
                                        classList={{
                                          "listbox__option-content": true,
                                          "listbox__option--active": isActive(),
                                        }}
                                      >
                                        <span
                                          classList={{
                                            "listbox__option-text": true,
                                            "listbox__option-text--selected":
                                              isSelected(),
                                          }}
                                        >
                                          {packageId}
                                        </span>
                                        <Show when={isSelected()}>
                                          <span class="listbox__check-icon">
                                            <CheckIcon
                                              class="listbox__icon"
                                              aria-hidden="true"
                                            />
                                          </span>
                                        </Show>
                                      </div>
                                    )}
                                  </ListboxOption>
                                )}
                              </For>
                            </ListboxOptions>
                          </Transition>
                        )}
                      </DisclosureStateChild>
                    </div>
                  </Listbox>
                </>
              )}
            />
          </div>
          <div class="form-buttons">
            <form.Subscribe
              children={(state) => (
                <Button type="submit" disabled={!state().canSubmit}>
                  {state().isSubmitting ? "..." : "Create"}
                </Button>
              )}
            />
            <LinkButton type="button" to="/bug-bounties" search={(v) => v}>
              Back
            </LinkButton>
          </div>
        </form>
      </article>
    </main>
  );
}
