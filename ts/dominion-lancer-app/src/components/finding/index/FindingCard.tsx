import { Button } from "@kobalte/core/button";
import { formatAddress, formatDigest, SUI_DECIMALS } from "@mysten/sui/utils";
import { createLink } from "@tanstack/solid-router";
import { Square, SquareCheck, X } from "lucide-solid";
import { For, Match, Show, Switch } from "solid-js";
import {
  useSuiClient,
  useSuiNetwork,
  useSuiUser,
  useSuiWallet,
} from "~/contexts";
import { Network } from "~/stores/config";
import formStyles from "~/styles/Form.module.css";
import buttonStyles from "~/styles/Button.module.css";
import { Link } from "@kobalte/core/link";
import { Link as RouterLink } from "@tanstack/solid-router";
import {
  hasFundsToWithdraw,
  isErrorMessageReadable,
  isPaid,
  isPrivateReportReadable,
  isPublicReportReadable,
} from "~/sdk/Finding";
import { WalrusClient } from "@mysten/walrus";
import { downloadBlobMutation } from "~/mutations/downloadBlob";
import { payFindingMutation } from "~/mutations/Finding/payFinding";
import { withdrawFindingMutation } from "~/mutations/Finding/withdrawFinding";
import { publishFindingMutation } from "~/mutations/Finding/publishFinding";
import { destroyFindingMutation } from "~/mutations/Finding/destroyFinding";
import { removePaymentMutation } from "~/mutations/Finding/removePayment";
import { useFinding } from "~/queries/finding";
import { useBugBounty } from "~/queries/bugBounty";
import { Toast, toaster } from "@kobalte/core/toast";
import toastStyles from "~/styles/Toast.module.css";
import styles from "~/styles/bugBounty/index/Card.module.css";

export type FindingCardProps = {
  findingId: string;
  solo?: boolean;
};

const FindingCard = (props: FindingCardProps) => {
  const LinkButton = createLink(Button);
  const user = useSuiUser();
  const network = useSuiNetwork();
  const suiClient = useSuiClient();
  const wallet = useSuiWallet();

  const finding = useFinding({
    network: network.value as Network,
    findingId: props.findingId,
  });

  const bugBounty = useBugBounty(() => ({
    network: network.value as Network,
    bugBountyId: finding.data?.bugBountyId,
  }));

  const walrusClient = () =>
    new WalrusClient({
      network: "testnet",
      suiClient: suiClient(),
      wasmUrl:
        "https://unpkg.com/@mysten/walrus-wasm@latest/web/walrus_wasm_bg.wasm",
    });

  const downloadBlob = downloadBlobMutation();
  const handleDownloadPublicReport = () =>
    downloadBlob.mutateAsync(
      {
        blobId: finding.data!.publicReportBlobId!,
        name: `public_${formatAddress(props.findingId)}.tar`,
        walrusClient: walrusClient(),
      },
      {
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
                  Error downloading public report
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

  const handleDownloadPrivateReport = () =>
    downloadBlob.mutateAsync(
      {
        blobId: finding.data!.privateReportBlobId!,
        name: `private_${formatAddress(props.findingId)}.tar`,
        walrusClient: walrusClient(),
      },
      {
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
                  Error downloading private report
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

  const handleDownloadErrorMessage = () =>
    downloadBlob.mutateAsync(
      {
        blobId: finding.data!.errorMessageBlobId!,
        name: `error_${formatAddress(props.findingId)}.txt`,
        walrusClient: walrusClient(),
      },
      {
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
                  Error downloading error message
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

  const removePayment = removePaymentMutation();
  const handleRemovePayment = () => {
    removePayment.mutateAsync(
      {
        network: network.value as Network,
        wallet: wallet.value!,
        user: user.value!,
        finding: finding.data!,
      },
      {
        onSuccess: ({ txDigest }, mutationProps) => {
          const toastId = toaster.show((props) => (
            <Toast toastId={props.toastId} class={toastStyles.toast}>
              <div class={toastStyles.toastContent}>
                <div>
                  <Toast.Title class={toastStyles.toastTitle}>
                    Finding {mutationProps.finding.id}: payment removed
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
  };

  const payFinding = payFindingMutation();
  const handlePay = () => {
    payFinding.mutateAsync(
      {
        network: network.value as Network,
        wallet: wallet.value!,
        user: user.value!,
        finding: finding.data!,
      },
      {
        onSuccess: ({ txDigest }, mutationProps) => {
          const toastId = toaster.show((props) => (
            <Toast toastId={props.toastId} class={toastStyles.toast}>
              <div class={toastStyles.toastContent}>
                <div>
                  <Toast.Title class={toastStyles.toastTitle}>
                    Finding {mutationProps.finding.id} paid
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
  };

  const publishFinding = publishFindingMutation();
  const handlePublish = () => {
    publishFinding.mutateAsync(
      {
        network: network.value as Network,
        wallet: wallet.value!,
        user: user.value!,
        finding: finding.data!,
      },
      {
        onSuccess: ({ txDigest }, mutationProps) => {
          const toastId = toaster.show((props) => (
            <Toast toastId={props.toastId} class={toastStyles.toast}>
              <div class={toastStyles.toastContent}>
                <div>
                  <Toast.Title class={toastStyles.toastTitle}>
                    Finding {mutationProps.finding.id} published
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
  };

  const destroyFinding = destroyFindingMutation();
  const handleDestroy = () => {
    destroyFinding.mutateAsync(
      {
        network: network.value as Network,
        wallet: wallet.value!,
        user: user.value!,
        finding: finding.data!,
      },
      {
        onSuccess: ({ txDigest }, mutationProps) => {
          const toastId = toaster.show((props) => (
            <Toast toastId={props.toastId} class={toastStyles.toast}>
              <div class={toastStyles.toastContent}>
                <div>
                  <Toast.Title class={toastStyles.toastTitle}>
                    Finding {mutationProps.finding.id} destroyed
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
  };

  const withdrawFinding = withdrawFindingMutation();
  const handleWithdraw = () => {
    withdrawFinding.mutateAsync(
      {
        network: network.value as Network,
        wallet: wallet.value!,
        user: user.value!,
        finding: finding.data!,
      },
      {
        onSuccess: ({ txDigest }, mutationProps) => {
          const toastId = toaster.show((props) => (
            <Toast toastId={props.toastId} class={toastStyles.toast}>
              <div class={toastStyles.toastContent}>
                <div>
                  <Toast.Title class={toastStyles.toastTitle}>
                    Finding {mutationProps.finding.id}: payment withdrawn
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
  };

  return (
    <section class="card">
      <h2>
        <Show
          when={!props.solo}
          fallback={
            <span>
              Finding{" "}
              <Link
                href={`https://${
                  network.value === "mainnet" ? "" : network.value + "."
                }suivision.xyz/object/${props.findingId}`}
                target="_blank"
                rel="noreferrer"
              >
                ({formatAddress(props.findingId)})
              </Link>
            </span>
          }
        >
          <RouterLink
            to="/finding/$findingId"
            params={{ findingId: props.findingId }}
          >
            Finding {formatAddress(props.findingId)}
          </RouterLink>
        </Show>
      </h2>
      <div class={formStyles.container}>
        <div class={formStyles.grid}>
          <label for={`bugBounty${props.findingId}`}>Bug bounty:</label>
          <RouterLink
            id={`packageId${props.findingId}`}
            to="/bug-bounty/$bugBountyId"
            params={{ bugBountyId: finding.data?.bugBountyId! }}
            search={{
              network: network.value as Network,
              user: user.value,
            }}
          >
            {bugBounty.data?.name} (
            {finding.data?.bugBountyId &&
              formatAddress(finding.data?.bugBountyId)}
            )
          </RouterLink>
          <Show when={finding.data?.owner}>
            <label for={`owner${props.findingId}`}>Owner:</label>
            <Link
              id={`owner${props.findingId}`}
              href={`https://${
                network.value === "mainnet" ? "" : network.value + "."
              }suivision.xyz/address/${finding.data?.owner}`}
              target="_blank"
              rel="noreferrer"
            >
              {finding.data?.owner}
            </Link>
          </Show>
          <Switch>
            <Match when={finding.data?.publicReportBlobId}>
              <label for={`publicReport${props.findingId}`}>
                Public report:
              </label>
              <Button
                class={buttonStyles.button}
                disabled={
                  !isPublicReportReadable({
                    finding: finding.data,
                    bugBounty: bugBounty.data,
                    user: user.value,
                  })
                }
                onClick={handleDownloadPublicReport}
              >
                Download
              </Button>
            </Match>
            <Match
              when={
                !finding.data?.publicReportBlobId &&
                !finding.data?.errorMessageBlobId
              }
            >
              <label for={`reports${props.findingId}`}>Reports:</label>
              <span id={`reports${props.findingId}`}>Processing...</span>
            </Match>
          </Switch>
          <Show when={finding.data?.privateReportBlobId}>
            <label for={`privateReport${props.findingId}`}>
              Private report:
            </label>
            <Button
              class={buttonStyles.button}
              disabled={
                !isPrivateReportReadable({
                  finding: finding.data,
                  bugBounty: bugBounty.data,
                  user: user.value,
                })
              }
              onClick={handleDownloadPrivateReport}
            >
              Download
            </Button>
          </Show>
          <Show when={finding.data?.errorMessageBlobId}>
            <label for={`errorMessage${props.findingId}`}>Error message:</label>
            <Button
              class={buttonStyles.button}
              disabled={
                !isErrorMessageReadable({
                  finding: finding.data,
                  user: user.value,
                })
              }
              onClick={handleDownloadErrorMessage}
            >
              Download
            </Button>
          </Show>
          <label for={`payment${props.findingId}`}>Payment:</label>
          <Show
            when={finding.data?.payments.length || 0 > 0}
            fallback={
              <span id={`payment${props.findingId}`}>
                <Button
                  class={buttonStyles.button}
                  disabled={
                    finding.data?.isPublished ||
                    finding.data?.owner !== user.value
                  }
                >
                  Add
                </Button>
              </span>
            }
          >
            <span
              id={`payment${props.findingId}`}
              style={{
                display: "flex",
                "flex-direction": "row",
                gap: "10px",
                "align-items": "end",
              }}
            >
              <ul style={{ display: "inline-block" }}>
                <For each={finding.data?.payments}>
                  {(p) => (
                    <li>
                      {Number(p.payed) / Math.pow(10, SUI_DECIMALS)} /{" "}
                      {Number(p.requested) / Math.pow(10, SUI_DECIMALS)}{" "}
                      {p.type.split("::").at(-1)}
                    </li>
                  )}
                </For>
              </ul>
              <Button
                class={buttonStyles.button}
                disabled={finding.data?.isPublished}
                onClick={handleRemovePayment}
              >
                Remove
              </Button>
              <Button
                class={buttonStyles.button}
                disabled={isPaid(finding.data)}
                onClick={handlePay}
              >
                Pay
              </Button>
              <Button
                class={buttonStyles.button}
                disabled={hasFundsToWithdraw(finding.data)}
                onClick={handleWithdraw}
              >
                Withdraw
              </Button>
            </span>
          </Show>
          <label for={`payment${props.findingId}`}>Publicity:</label>
          <Show
            when={!finding.data?.isPublished}
            fallback={<span>Published</span>}
          >
            <span style={{ display: "flex", gap: "10px" }}>
              <Button
                class={buttonStyles.button}
                disabled={
                  !finding.data?.publicReportBlobId ||
                  !user.value ||
                  user.value !== finding.data?.owner
                }
                onClick={handlePublish}
              >
                Publish
              </Button>
              <Button
                class={buttonStyles.button}
                disabled={
                  finding.data?.isPublished ||
                  !user.value ||
                  user.value !== finding.data?.owner
                }
                onClick={handleDestroy}
              >
                Destroy
              </Button>
            </span>
          </Show>
        </div>
      </div>
      <Show when={props.solo}>
        <div class={styles.line}>
          <LinkButton
            class={buttonStyles.button}
            to="/finding"
            search={{
              network: network.value as Network,
              user: user.value,
            }}
          >
            All
          </LinkButton>
        </div>
      </Show>
    </section>
  );
};

export default FindingCard;
