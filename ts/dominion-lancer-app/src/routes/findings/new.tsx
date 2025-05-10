import { createForm } from "@tanstack/solid-form";
import { createFileRoute, createLink } from "@tanstack/solid-router";
import { zodValidator } from "@tanstack/zod-adapter";
import { z } from "zod";
import {
  useSuiNetwork,
  useSuiUser,
  useSuiWallet,
  useSuiWalletController,
} from "~/contexts";
import { createFindingMutation } from "~/mutations/createFinding";
import { bugBountiesQuery } from "~/queries/bugBounties";
import { Network } from "~/stores/config";
import { FileField } from "@kobalte/core/file-field";
import BugBountySelect from "~/components/finding/new/BugBountySelect";
import formStyles from "~/styles/Form.module.css";
import buttonStyles from "~/styles/Button.module.css";
import { Button } from "@kobalte/core/button";
import { createEffect, Show } from "solid-js";
import { isValidSuiObjectId } from "@mysten/sui/utils";

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
      files: [] as File[],
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

  const store = form.useStore();
  createEffect(() => {
    const values = store().values;
    const isValidPackageId = isValidSuiObjectId(values.bugBountyId);
    if (isValidPackageId && values.bugBountyId !== search().bugBountyId) {
      navigate({
        from: Route.fullPath,
        to: ".",
        search: (prev) => ({
          ...prev,
          bugBountyId: values.bugBountyId,
        }),
        replace: true,
      });
    }
  });

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
          class={formStyles.container}
        >
          <div class={formStyles.grid}>
            <form.Field name="bugBountyId" validators={{
              onChange: ({value}) => {
                return isValidSuiObjectId(value) ? undefined : "Invalid bug bounty ID";
              }
            }}>
              {(field) => (
                <>
                  <label for={field().name}>Bug bounty:</label>
                  <BugBountySelect
                    class={formStyles.longField}
                    bugBountyId={field().state.value}
                    setBugBountyId={field().handleChange}
                    name={field().name}
                  />
                </>
              )}
            </form.Field>
            <form.Field name="files">
              {(field) => (
                <>
                  <label for={field().name}>Input:</label>
                  <FileField
                    class={formStyles.fileField}
                    name={field().name}
                    accept="application/x-tar"
                    onFileAccept={field().handleChange}
                  >
                    <FileField.Trigger class={buttonStyles.button}>
                      Upload
                    </FileField.Trigger>
                    <FileField.HiddenInput />
                    <Show when={field().state.value.length > 0}>
                      <span class="file-name">
                        {field().state.value[0].name}
                      </span>
                    </Show>
                  </FileField>
                </>
              )}
            </form.Field>
            <form.Field name="budget">
              {(field) => (
                <>
                  <label for={field().name}>WAL Budget:</label>
                  <input id={field().name} type="number" />
                </>
              )}
            </form.Field>
          </div>
          <div class={formStyles.actions}>
            <form.Subscribe>
              {(state) => (
                <Button
                  class={buttonStyles.button}
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
              class={buttonStyles.button}
            >
              Back
            </LinkButton>
          </div>
        </form>
      </article>
    </main>
  );
}
