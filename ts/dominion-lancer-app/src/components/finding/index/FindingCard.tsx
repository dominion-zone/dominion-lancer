import { Button } from "@kobalte/core/button";
import { formatAddress, formatDigest, SUI_DECIMALS } from "@mysten/sui/utils";
import { createLink } from "@tanstack/solid-router";
import { LoaderCircle, Square, SquareCheck, X } from "lucide-solid";
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  Match,
  onCleanup,
  Show,
  Switch,
  untrack,
} from "solid-js";
import {
  useSuiClient,
  useSuiNetwork,
  useSuiUser,
  useSuiWallet,
  useSuiWalletController,
} from "~/contexts";
import { Network } from "~/stores/config";
import formStyles from "~/styles/Form.module.css";
import buttonStyles from "~/styles/Button.module.css";
import { Link } from "@kobalte/core/link";
import { Link as RouterLink } from "@tanstack/solid-router";
import {
  Finding,
  hasFundsToWithdraw,
  isErrorMessageReadable,
  isPaid,
  isPrivateReportReadable,
  isPublicReportReadable,
} from "~/sdk/Finding";
import { downloadBlobMutation } from "~/mutations/downloadBlob";
import { payFindingMutation } from "~/mutations/Finding/payFinding";
import { withdrawFindingMutation } from "~/mutations/Finding/withdrawFinding";
import { publishFindingMutation } from "~/mutations/Finding/publishFinding";
import {
  destroyFindingMutation,
  DestroyFindingProps,
} from "~/mutations/Finding/destroyFinding";
import { removePaymentMutation } from "~/mutations/Finding/removePayment";
import { useFinding } from "~/queries/finding";
import { useBugBounty } from "~/queries/bugBounty";
import { Toast, toaster } from "@kobalte/core/toast";
import toastStyles from "~/styles/Toast.module.css";
import styles from "~/styles/bugBounty/index/Card.module.css";

export type FindingCardProps = {
  findingId: string;
  solo?: boolean;
  filter?: (finding: Finding) => boolean;
};

const FindingCard = (props: FindingCardProps) => {
  const LinkButton = createLink(Button);
  const user = useSuiUser();
  const network = useSuiNetwork();
  const wallet = useSuiWallet();
  const walletController = useSuiWalletController();

  const finding = useFinding({
    network: network.value as Network,
    findingId: props.findingId,
  });

  const bugBounty = useBugBounty({
    get network() {
      return network.value as Network;
    },
    get bugBountyId() {
      return finding.data?.bugBountyId;
    },
  });

  const [publicReportUrl, setPublicReportUrl] = createSignal<
    { url: string; name: string } | undefined
  >();
  const [publicReportLink, setPublicReportLink] = createSignal<
    HTMLAnchorElement | undefined
  >();
  const [privateReportUrl, setPrivateReportUrl] = createSignal<
    { url: string; name: string } | undefined
  >();
  const [privateReportLink, setPrivateReportLink] = createSignal<
    HTMLAnchorElement | undefined
  >();
  const [errorMessageUrl, setErrorMessageUrl] = createSignal<
    { url: string; name: string } | undefined
  >();
  const [errorMessageLink, setErrorMessageLink] = createSignal<
    HTMLAnchorElement | undefined
  >();

  const resetUrls = () => {
    setPublicReportUrl((v) => {
      if (v) {
        URL.revokeObjectURL(v.url);
      }
      return undefined;
    });
    setPrivateReportUrl((v) => {
      if (v) {
        URL.revokeObjectURL(v.url);
      }
      return undefined;
    });
    setErrorMessageUrl((v) => {
      if (v) {
        URL.revokeObjectURL(v.url);
      }
      return undefined;
    });
  };
  onCleanup(resetUrls);

  createEffect<string | undefined>((oldUser) => {
    if (oldUser && user.value !== oldUser) {
      resetUrls();
    }
    return user.value;
  }, user.value);

  createEffect<string | undefined>((url) => {
    const el = publicReportLink();
    if (el?.href && el.href !== url) {
      el.click();
      return el.href;
    }
    return url;
  }, undefined);

  createEffect<string | undefined>((url) => {
    const el = privateReportLink();
    if (el?.href && el.href !== url) {
      el.click();
      return el.href;
    }
    return url;
  }, undefined);

  createEffect<string | undefined>((url) => {
    const el = errorMessageLink();
    if (el?.href && el.href !== url) {
      el.click();
      return el.href;
    }
    return url;
  }, undefined);

  const downloadPublicReport = downloadBlobMutation({
    get network() {
      return network.value as Network;
    },
    get user() {
      return user.value!;
    },
    get findingId() {
      return props.findingId;
    },
    fieldKind: "publicReport",
  });
  const handleDownloadPublicReport = () =>
    downloadPublicReport.mutateAsync(
      {
        wallet: wallet.value!,
        setUrl: setPublicReportUrl,
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
                <X size={12} />
              </Toast.CloseButton>
            </Toast>
          ));
        },
      }
    );

  const downloadPrivateReport = downloadBlobMutation({
    get network() {
      return network.value as Network;
    },
    get user() {
      return user.value!;
    },
    get findingId() {
      return props.findingId;
    },
    fieldKind: "privateReport",
  });
  const handleDownloadPrivateReport = () =>
    downloadPrivateReport.mutateAsync(
      {
        wallet: wallet.value!,
        setUrl: setPrivateReportUrl,
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
                <X size={12} />
              </Toast.CloseButton>
            </Toast>
          ));
        },
      }
    );

  const downloadErrorMessage = downloadBlobMutation({
    get network() {
      return network.value as Network;
    },
    get user() {
      return user.value!;
    },
    get findingId() {
      return props.findingId;
    },
    fieldKind: "errorMessage",
  });
  const handleDownloadErrorMessage = () =>
    downloadErrorMessage.mutateAsync(
      {
        wallet: wallet.value!,
        setUrl: setErrorMessageUrl,
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
                <X size={12} />
              </Toast.CloseButton>
            </Toast>
          ));
        },
      }
    );

  const removePayment = removePaymentMutation({
    get network() {
      return network.value as Network;
    },
    get findingId() {
      return props.findingId;
    },
  });
  const handleRemovePayment = () => {
    removePayment.mutateAsync(
      untrack(() => ({
        wallet: wallet.value!,
      })),
      {
        onSuccess: ({ txDigest, finding }) => {
          const toastId = toaster.show((props) => (
            <Toast toastId={props.toastId} class={toastStyles.toast}>
              <div class={toastStyles.toastContent}>
                <div>
                  <Toast.Title class={toastStyles.toastTitle}>
                    Finding {formatAddress(finding.id)}: payment removed
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
                  <X size={12} />
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
                  Error removing payment
                </Toast.Title>
                <Toast.Description class={toastStyles.toastDescription}>
                  {error.message}
                </Toast.Description>
              </div>
              <Toast.CloseButton class={toastStyles.toastCloseButton}>
                <X size={12} />
              </Toast.CloseButton>
            </Toast>
          ));
        },
      }
    );
  };

  const payFinding = payFindingMutation({
    get network() {
      return network.value as Network;
    },
    get findingId() {
      return props.findingId;
    },
    get user() {
      return user.value!;
    },
  });
  const handlePay = () => {
    payFinding.mutateAsync(
      untrack(() => ({
        wallet: wallet.value!,
      })),
      {
        onSuccess: ({ txDigest, finding }) => {
          const toastId = toaster.show((props) => (
            <Toast toastId={props.toastId} class={toastStyles.toast}>
              <div class={toastStyles.toastContent}>
                <div>
                  <Toast.Title class={toastStyles.toastTitle}>
                    Finding {formatAddress(finding.id)} paid
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
                  <X size={12} />
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
                  Error paying finding
                </Toast.Title>
                <Toast.Description class={toastStyles.toastDescription}>
                  {error.message}
                </Toast.Description>
              </div>
              <Toast.CloseButton class={toastStyles.toastCloseButton}>
                <X size={12} />
              </Toast.CloseButton>
            </Toast>
          ));
        },
      }
    );
  };

  const publishFinding = publishFindingMutation({
    get network() {
      return network.value as Network;
    },
    get findingId() {
      return props.findingId;
    },
  });
  const handlePublish = () => {
    publishFinding.mutateAsync(
      untrack(() => ({
        wallet: wallet.value!,
      })),
      {
        onSuccess: ({ txDigest, finding }) => {
          const toastId = toaster.show((props) => (
            <Toast toastId={props.toastId} class={toastStyles.toast}>
              <div class={toastStyles.toastContent}>
                <div>
                  <Toast.Title class={toastStyles.toastTitle}>
                    Finding {formatAddress(finding.id)} published
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
                  <X size={12} />
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
                  Error publishing finding
                </Toast.Title>
                <Toast.Description class={toastStyles.toastDescription}>
                  {error.message}
                </Toast.Description>
              </div>
              <Toast.CloseButton class={toastStyles.toastCloseButton}>
                <X size={12} />
              </Toast.CloseButton>
            </Toast>
          ));
        },
      }
    );
  };

  const destroyFinding = destroyFindingMutation({
    get network() {
      return network.value as Network;
    },
    get findingId() {
      return props.findingId;
    },
  });
  const handleDestroy = () => {
    destroyFinding.mutateAsync(
      untrack(() => ({
        wallet: wallet.value!,
      })),
      {
        onSuccess: ({
          txDigest,
          finding,
        }: {
          txDigest: string;
          finding: Finding;
        }) => {
          console.log("Finding destroyed", finding);
          const toastId = toaster.show((props) => (
            <Toast toastId={props.toastId} class={toastStyles.toast}>
              <div class={toastStyles.toastContent}>
                <div>
                  <Toast.Title class={toastStyles.toastTitle}>
                    Finding {formatAddress(finding.id)} destroyed
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
                  <X size={12} />
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
                  Error destroying finding
                </Toast.Title>
                <Toast.Description class={toastStyles.toastDescription}>
                  {error.message}
                </Toast.Description>
              </div>
              <Toast.CloseButton class={toastStyles.toastCloseButton}>
                <X size={12} />
              </Toast.CloseButton>
            </Toast>
          ));
        },
      }
    );
  };

  const withdrawFinding = withdrawFindingMutation({
    get network() {
      return network.value as Network;
    },
    get findingId() {
      return props.findingId;
    },
  });
  const handleWithdraw = () => {
    withdrawFinding.mutateAsync(
      untrack(() => ({
        wallet: wallet.value!,
      })),
      {
        onSuccess: ({ txDigest, finding }) => {
          const toastId = toaster.show((props) => (
            <Toast toastId={props.toastId} class={toastStyles.toast}>
              <div class={toastStyles.toastContent}>
                <div>
                  <Toast.Title class={toastStyles.toastTitle}>
                    Finding {formatAddress(finding.id)}: payment withdrawn
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
                  <X size={12} />
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
                  Error withdrawing finding payment
                </Toast.Title>
                <Toast.Description class={toastStyles.toastDescription}>
                  {error.message}
                </Toast.Description>
              </div>
              <Toast.CloseButton class={toastStyles.toastCloseButton}>
                <X size={12} />
              </Toast.CloseButton>
            </Toast>
          ));
        },
      }
    );
  };

  return (
    <Show when={finding.data && (!props.filter || props.filter(finding.data))}>
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
              search={(v) => ({ network: v.network, user: v.user })}
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
                <Switch>
                  <Match when={publicReportUrl()}>
                    <Link
                      href={publicReportUrl()!.url}
                      download={publicReportUrl()!.name}
                      ref={(el) => setPublicReportLink(el)}
                    >
                      {publicReportUrl()!.name}
                    </Link>
                  </Match>
                  <Match when={!publicReportUrl()}>
                    <Button
                      class={buttonStyles.button}
                      disabled={
                        !isPublicReportReadable({
                          finding: finding.data!,
                          bugBounty: bugBounty.data!,
                          user: user.value,
                        }) || downloadPublicReport.isPending
                      }
                      onClick={handleDownloadPublicReport}
                    >
                      <Show when={downloadPublicReport.isPending}>
                        <LoaderCircle size={10} />
                      </Show>
                      Prepare
                    </Button>
                  </Match>
                </Switch>
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
              <Switch>
                <Match when={privateReportUrl()}>
                  <Link
                    href={privateReportUrl()!.url}
                    download={privateReportUrl()!.name}
                    ref={(el) => setPrivateReportLink(el)}
                  >
                    {privateReportUrl()!.name}
                  </Link>
                </Match>
                <Match when={!privateReportUrl()}>
                  <Button
                    class={buttonStyles.button}
                    disabled={
                      !isPrivateReportReadable({
                        finding: finding.data!,
                        bugBounty: bugBounty.data!,
                        user: user.value,
                      }) || downloadPrivateReport.isPending
                    }
                    onClick={handleDownloadPrivateReport}
                  >
                    <Show when={downloadPrivateReport.isPending}>
                      <LoaderCircle size={10} />
                    </Show>
                    Prepare
                  </Button>
                </Match>
              </Switch>
            </Show>
            <Show when={finding.data?.errorMessageBlobId}>
              <label for={`errorMessage${props.findingId}`}>
                Error message:
              </label>
              <Switch>
                <Match when={errorMessageUrl()}>
                  <Link
                    href={errorMessageUrl()!.url}
                    download={errorMessageUrl()!.name}
                    ref={(el) => setErrorMessageLink(el)}
                  >
                    {errorMessageUrl()!.name}
                  </Link>
                </Match>
                <Match when={!errorMessageUrl()}>
                  <Button
                    class={buttonStyles.button}
                    disabled={
                      !isErrorMessageReadable({
                        finding: finding.data!,
                        user: user.value,
                      }) || downloadErrorMessage.isPending
                    }
                    onClick={handleDownloadErrorMessage}
                  >
                    <Show when={downloadErrorMessage.isPending}>
                      <LoaderCircle size={10} />
                    </Show>
                    Prepare
                  </Button>
                </Match>
              </Switch>
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
                      !user.value ||
                      walletController.status !== "connected" ||
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
                  disabled={
                    finding.data?.isPublished ||
                    !user.value ||
                    walletController.status !== "connected" ||
                    finding.data?.owner !== user.value
                  }
                  onClick={handleRemovePayment}
                >
                  Remove
                </Button>
                <Button
                  class={buttonStyles.button}
                  disabled={
                    isPaid(finding.data!) ||
                    !user.value ||
                    walletController.status !== "connected"
                  }
                  onClick={handlePay}
                >
                  Pay
                </Button>
                <Button
                  class={buttonStyles.button}
                  disabled={
                    !hasFundsToWithdraw(finding.data!) ||
                    !user.value ||
                    walletController.status !== "connected" ||
                    finding.data?.owner !== user.value
                  }
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
                    user.value !== finding.data?.owner ||
                    walletController.status !== "connected"
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
                    user.value !== finding.data?.owner ||
                    walletController.status !== "connected"
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
    </Show>
  );
};

export default FindingCard;
