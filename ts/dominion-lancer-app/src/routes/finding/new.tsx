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
import { createFindingMutation } from "~/mutations/Finding/createFinding";
import { Network } from "~/stores/config";
import { FileField } from "@kobalte/core/file-field";
import BugBountySelect from "~/components/finding/BugBountySelect";
import formStyles from "~/styles/Form.module.css";
import buttonStyles from "~/styles/Button.module.css";
import { Button } from "@kobalte/core/button";
import { createEffect, Show, untrack } from "solid-js";
import {
  formatAddress,
  formatDigest,
  isValidSuiObjectId,
  SUI_DECIMALS,
} from "@mysten/sui/utils";
import { userEscrowsQuery } from "~/queries/userEscrows";
import { NumberField } from "@kobalte/core/number-field";
import { Toast, toaster } from "@kobalte/core/toast";
import toastStyles from "~/styles/Toast.module.css";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ChevronDown,
  ChevronUp,
  X,
} from "lucide-solid";
import numberFieldStyles from "~/styles/NumberField.module.css";
import { Link } from "@kobalte/core/link";
import styles from "~/styles/bugBounty/index/Toolbox.module.css";

const searchSchema = z.object({
  user: z.string(),
  bugBountyId: z.string().optional().default(""),
});

export const Route = createFileRoute("/finding/new")({
  component: RouteComponent,
  validateSearch: zodValidator(searchSchema),
});

function RouteComponent() {
  const LinkButton = createLink(Button);
  const navigate = Route.useNavigate();
  const search = Route.useSearch();
  const network = useSuiNetwork();
  const wallet = useSuiWallet();
  const walletController = useSuiWalletController();
  const user = useSuiUser();
  const mutation = createFindingMutation({
    get network() {
      return network.value as Network;
    },
    get user() {
      return user.value!;
    },
  });
  const escrows = userEscrowsQuery({
    get network() {
      return network.value as Network;
    },
    get user() {
      return user.value;
    },
  });
  const escrowsBalanceTotal = () =>
    escrows.data?.reduce(
      (acc, escrow) => (escrow.isLocked ? acc : acc + escrow.balance),
      0n
    ) || 0n;

  const form = createForm(() => ({
    defaultValues: {
      bugBountyId: search().bugBountyId || "",
      files: [] as File[],
      paymentSui: 0.1,
      budgetSui: 0.1,
    },

    onSubmit: async ({ value }) => {
      await mutation.mutateAsync(
        untrack(() => ({
          wallet: wallet.value!,
          file: value.files[0],
          bugBountyId: value.bugBountyId,
          paymentSui: BigInt(value.paymentSui * Math.pow(10, SUI_DECIMALS)),
          topupSui:
            BigInt(value.budgetSui * Math.pow(10, SUI_DECIMALS)) -
            escrowsBalanceTotal(),
        })),
        {
          onSuccess: ({ findingId, txDigest }) => {
            const toastId = toaster.show((props) => (
              <Toast toastId={props.toastId} class={toastStyles.toast}>
                <div class={toastStyles.toastContent}>
                  <div>
                    <Toast.Title class={toastStyles.toastTitle}>
                      Finding {formatAddress(findingId)} has been created
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
              to: "/finding/$findingId",
              params: {
                findingId,
              },
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
                    Error creating finding
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
            <form.Field
              name="bugBountyId"
              validators={{
                onChange: ({ value }) => {
                  return isValidSuiObjectId(value)
                    ? undefined
                    : "Invalid bug bounty ID";
                },
              }}
            >
              {(field) => (
                <>
                  <label for={field().name}>Bug bounty:</label>
                  <BugBountySelect
                    // class={formStyles.longField}
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
                    <span><Link href="/dummy_pool.tar">(example)</Link></span>
                  </FileField>
                </>
              )}
            </form.Field>
            <form.Field name="paymentSui">
              {(field) => (
                <>
                  <label for={field().name}>Payment:</label>
                  <NumberField
                    id={field().name}
                    class={numberFieldStyles.numberField}
                    rawValue={field().state.value}
                    onRawValueChange={field().handleChange}
                    formatOptions={{
                      style: "currency",
                      currency: "SUI",
                      minimumFractionDigits: 2,
                      maximumFractionDigits: SUI_DECIMALS,
                    }}
                  >
                    <NumberField.HiddenInput />
                    <div class={numberFieldStyles.numberFieldGroup}>
                      <NumberField.DecrementTrigger class={styles.iconButton}>
                        -
                      </NumberField.DecrementTrigger>
                      <NumberField.Input
                        class={numberFieldStyles.numberFieldInput}
                      />
                      <NumberField.IncrementTrigger class={styles.iconButton}>
                        +
                      </NumberField.IncrementTrigger>
                    </div>
                  </NumberField>
                </>
              )}
            </form.Field>
            <form.Field name="budgetSui">
              {(field) => (
                <>
                  <label for={field().name}>Budget:</label>
                  <NumberField
                    id={field().name}
                    class={numberFieldStyles.numberField}
                    rawValue={field().state.value}
                    onRawValueChange={field().handleChange}
                    formatOptions={{
                      style: "currency",
                      currency: "SUI",
                      minimumFractionDigits: 2,
                      maximumFractionDigits: SUI_DECIMALS,
                    }}
                  >
                    <NumberField.HiddenInput />
                    <div class={numberFieldStyles.numberFieldGroup}>
                      <NumberField.DecrementTrigger class={styles.iconButton}>
                        -
                      </NumberField.DecrementTrigger>
                      <NumberField.Input
                        class={numberFieldStyles.numberFieldInput}
                      />
                      <NumberField.IncrementTrigger class={styles.iconButton}>
                        +
                      </NumberField.IncrementTrigger>
                    </div>
                    <span>
                      (
                      {Number(escrowsBalanceTotal()) /
                        Math.pow(10, SUI_DECIMALS)}{" "}
                      SUI deposited)
                    </span>
                  </NumberField>
                </>
              )}
            </form.Field>
          </div>
          <div class={formStyles.actions}>
            <LinkButton
              type="button"
              to="/finding"
              search={(v) => ({ network: v.network, user: v.user })}
              class={buttonStyles.button}
            >
              Cancel
            </LinkButton>
            <form.Subscribe>
              {(state) => (
                <Button
                  class={buttonStyles.button}
                  type="submit"
                  disabled={
                    !state().canSubmit ||
                    !user.value ||
                    walletController.status !== "connected"
                  }
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
