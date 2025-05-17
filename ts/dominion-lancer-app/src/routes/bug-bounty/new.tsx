import { createFileRoute, createLink } from "@tanstack/solid-router";
import { createForm } from "@tanstack/solid-form";
import { createEffect } from "solid-js";
import { userPackagesQuery } from "~/queries/userPackages";
import {
  useSuiNetwork,
  useSuiUser,
  useSuiWallet,
  useSuiWalletController,
} from "~/contexts";
import { z } from "zod";
import { zodValidator } from "@tanstack/zod-adapter";
import { createBugBountyMutation } from "~/mutations/BugBounty/createBugBounty";
import { Network } from "~/stores/config";
import PackageSelect from "~/components/bugBounty/new/PackageSelect";
import formStyles from "~/styles/Form.module.css";
import buttonStyles from "~/styles/Button.module.css";
import { Button } from "@kobalte/core/button";
import { TextField } from "@kobalte/core/text-field";
import { Toast, toaster } from "@kobalte/core/toast";
import { X } from "lucide-solid";
import toastStyles from "~/styles/Toast.module.css";
import {
  formatAddress,
  formatDigest,
  isValidSuiObjectId,
} from "@mysten/sui/utils";
import { Link } from "@kobalte/core/link";

const searchSchema = z.object({
  user: z.string(),
  name: z.string().optional().default(""),
  packageId: z.string().optional().default(""),
});

export const Route = createFileRoute("/bug-bounty/new")({
  component: RouteComponent,
  validateSearch: zodValidator(searchSchema),
});

function RouteComponent() {
  const LinkButton = createLink(Button);

  const network = useSuiNetwork();
  const user = useSuiUser();
  const userPackages = userPackagesQuery(() => ({
    network: network.value,
    user: user.value!,
  }));
  const wallet = useSuiWallet();
  const walletController = useSuiWalletController();
  const navigate = Route.useNavigate();
  const search = Route.useSearch();

  const mutation = createBugBountyMutation();

  const form = createForm(() => ({
    defaultValues: {
      name: search().name || "",
      packageId: search().packageId || "",
    },

    onSubmit: async ({ value }) => {
      const upgradeCapId = userPackages.data?.find(
        (cap) => cap.packageId === value.packageId
      )?.upgradeCapId;
      await mutation.mutateAsync(
        {
          network: network.value as Network,
          wallet: wallet.value!,
          user: user.value!,
          packageId: value.packageId,
          name: value.name,
          upgradeCapId,
        },
        {
          onSuccess: ({ bugBounty, txDigest }) => {
            const toastId = toaster.show((props) => (
              <Toast toastId={props.toastId} class={toastStyles.toast}>
                <div class={toastStyles.toastContent}>
                  <div>
                    <Toast.Title class={toastStyles.toastTitle}>
                      Bug bounty {formatAddress(bugBounty.id)} has been created
                    </Toast.Title>
                    <Toast.Description class={toastStyles.toastDescription}>
                      Transaction:{" "}
                      <Link
                        target="_blank"
                        rel="noreferrer"
                        href={`https://${
                          network.value === "mainnet" ? "" : network.value + "."
                        }suivision.xyz/txblock/${txDigest}`}
                      >
                        {formatDigest(txDigest)}
                      </Link>
                    </Toast.Description>
                  </div>
                  <Toast.CloseButton class={toastStyles.toastCloseButton}>
                    <X size={14} />
                  </Toast.CloseButton>
                </div>
              </Toast>
            ));
            navigate({
              to: "/bug-bounty/$bugBountyId",
              params: { bugBountyId: bugBounty.id },
              search: {
                network: network.value as Network,
                user: user.value,
              },
            });
          },
          onError: (error) => {
            const toastId = toaster.show((props) => (
              <Toast
                toastId={props.toastId}
                classList={{
                  [toastStyles.toast]: true,
                  [toastStyles.toastError]: true,
                }}
              >
                <div class={toastStyles.toastContent}>
                  <Toast.Title class={toastStyles.toastTitle}>
                    Error creating bug bounty
                  </Toast.Title>
                  <Toast.Description class={toastStyles.toastDescription}>
                    {error.message}
                  </Toast.Description>
                </div>
                <Toast.CloseButton class={toastStyles.toastCloseButton}>
                  <X size={14} />
                </Toast.CloseButton>
              </Toast>
            ));
          },
        }
      );
    },
  }));

  const store = form.useStore();
  createEffect(() => {
    const values = store().values;
    const isValidPackageId = isValidSuiObjectId(values.packageId);
    if (
      values.name !== search().name ||
      (isValidPackageId && values.packageId !== search().packageId)
    ) {
      navigate({
        from: Route.fullPath,
        to: ".",
        search: (prev) => ({
          ...prev,
          name: values.name,
          packageId: isValidPackageId ? values.packageId : prev.packageId,
        }),
        replace: true,
      });
    }
  });

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
          class={formStyles.container}
        >
          <div class={formStyles.grid}>
            <form.Field name="name">
              {(field) => (
                <>
                  <label for={field().name}>Name:</label>
                  <TextField
                    id={field().name}
                    name={field().name}
                    value={field().state.value}
                    onBlur={field().handleBlur}
                    onChange={field().handleChange}
                  >
                    <TextField.Input class={formStyles.textField} />
                  </TextField>
                </>
              )}
            </form.Field>

            <form.Field
              name="packageId"
              validators={{
                onChange: ({ value }) => {
                  isValidSuiObjectId(value) ? undefined : "Invalid package id";
                },
              }}
            >
              {(field) => (
                <>
                  <label for={field().name}>Package:</label>
                  <PackageSelect
                    class={formStyles.longField}
                    packageId={field().state.value}
                    setPackageId={field().handleChange}
                    name={field().name}
                  />
                </>
              )}
            </form.Field>
          </div>
          <div class={formStyles.actions}>
            <LinkButton
              type="button"
              to="/bug-bounty"
              search={(v) => ({ network: v.network, user: v.user })}
              class={buttonStyles.button}
            >
              Cancel
            </LinkButton>
            <form.Subscribe>
              {(state) => (
                <Button
                  type="submit"
                  disabled={
                    !state().canSubmit ||
                    walletController.status !== "connected"
                  }
                  class={buttonStyles.button}
                >
                  {state().isSubmitting ? "..." : "Create"}
                </Button>
              )}
            </form.Subscribe>
          </div>
        </form>
      </article>
    </main>
  );
}
