import { UploadFile } from "@solid-primitives/upload";
import { createForm } from "@tanstack/solid-form";
import { createFileRoute, createLink } from "@tanstack/solid-router";
import { zodValidator } from "@tanstack/zod-adapter";
import { CheckIcon, ChevronsUpDown } from "lucide-solid";
import { createSignal, For, JSX, Show } from "solid-js";
import {
  Button,
  DisclosureStateChild,
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
  Transition,
} from "terracotta";
import { z } from "zod";
import { useSuiNetwork, useSuiUser, useSuiWallet, useSuiWalletController } from "~/contexts";
import { createFindingMutation } from "~/mutations/createFinding";
import { bugBountiesQuery } from "~/queries/bugBounties";
import { Network } from "~/stores/config";
import { fileUploader } from "@solid-primitives/upload";

const searchSchema = z.object({
  user: z.string(),
  bugBountyId: z.string().optional().default(""),
});

export const Route = createFileRoute("/findings/new")({
  component: RouteComponent,
  validateSearch: zodValidator(searchSchema),
});

function RouteComponent() {
  const LinkButton = createLink(Button);
  const navigate = Route.useNavigate();
  const search = Route.useSearch();
  const network = useSuiNetwork();
  const bugBounties = bugBountiesQuery({
    network: network.value as Network,
  });
  const wallet = useSuiWallet();
  const walletController = useSuiWalletController();
  const user = useSuiUser();
  const mutation = createFindingMutation();

  const form = createForm(() => ({
    defaultValues: {
      bugBountyId: search().bugBountyId || "",
      files: [] as UploadFile[],
      budget: 0n,
    },

    onSubmit: async ({ value }) => {
      await mutation.mutateAsync(
        {
          network: network.value as Network,
          wallet: wallet.value!,
          user: user.value!,
          file: value.files[0],
        },
        {
          onSuccess: () => {
            navigate({
              to: "/findings",
              search: (prev) => ({
                ...prev,
                ownedBy: user.value,
              }),
            });
          },
        }
      );
    },
  }));
  return (
    <main>
      <article class="card">
        <h2>New Finding</h2>
        <form
          method="post"
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
        >
          <form.Field name="bugBountyId">
            {(field) => (
              <div class="form-field">
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
                            <For each={bugBounties.data}>
                              {({ id, name }): JSX.Element => (
                                <ListboxOption
                                  class="listbox__option"
                                  value={id}
                                >
                                  {({ isActive, isSelected }): JSX.Element => (
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
                                        {name} ({id})
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
              </div>
            )}
          </form.Field>
          <form.Field name="files">
            {(field) => (
              <div class="form-field">
                <label for={field().name}>Input:</label>
                <input
                  id={field().name}
                  type="file"
                  accept="application/x-tar"
                  use:fileUploader={{
                    userCallback: () => {},
                    setFiles: field().handleChange,
                  }}
                />
              </div>
            )}
          </form.Field>
          <form.Field name="budget">
            {(field) => (
              <div class="form-field">
                <label for={field().name}>WAL Budget:</label>
                <input
                  id={field().name}
                  type="number"
                />
              </div>
            )}
          </form.Field>
          <div class="form-buttons">
            <form.Subscribe>
              {(state) => (
                <Button
                  type="submit"
                  disabled={
                    !state().canSubmit ||
                    walletController.status !== "connected"
                  }
                >
                  {state().isSubmitting ? "..." : "Create"}
                </Button>
              )}
            </form.Subscribe>
            <LinkButton
              type="button"
              to="/findings"
              search={(v) => ({ network: v.network, user: v.user })}
            >
              Back
            </LinkButton>
          </div>
        </form>
      </article>
    </main>
  );
}
