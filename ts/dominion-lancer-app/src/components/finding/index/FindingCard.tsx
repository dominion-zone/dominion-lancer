import { Button } from "@kobalte/core/button";
import {
  formatAddress,
  normalizeStructTag,
  parseStructTag,
  SUI_DECIMALS,
} from "@mysten/sui/utils";
import { createLink } from "@tanstack/solid-router";
import { Square, SquareCheck } from "lucide-solid";
import { For, Match, Show, Switch } from "solid-js";
import {
  useSuiClient,
  useSuiNetwork,
  useSuiUser,
  useSuiWallet,
} from "~/contexts";
import { BugBounty } from "~/sdk/BugBounty";
import { Network, useConfig } from "~/stores/config";
import styles from "~/styles/bugBounty/index/Card.module.css";
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
import { queryClient } from "~/queries/client";
import { bugBountiesQuery } from "~/queries/bugBounties";
import { WalrusClient } from "@mysten/walrus";
import { downloadBlobMutation } from "~/mutations/downloadBlob";
import { payFindingMutation } from "~/mutations/Finding/payFinding";
import { withdrawFindingMutation } from "~/mutations/Finding/withdrawFinding";
import { publishFindingMutation } from "~/mutations/Finding/publishFinding";
import { destroyFindingMutation } from "~/mutations/Finding/destroyFinding";
import { removePaymentMutation } from "~/mutations/Finding/removePayment";
import { findingQuery } from "~/queries/finding";

export type FindingCardProps = {
  findingId: string;
};

const FindingCard = (props: FindingCardProps) => {
  const user = useSuiUser();
  const network = useSuiNetwork();
  const bugBounties = bugBountiesQuery({
    network: network.value as Network,
  });
  const suiClient = useSuiClient();
  const wallet = useSuiWallet();

  const finding = findingQuery({
    network: network.value as Network,
    findingId: props.findingId,
  });

  const bugBounty = () =>
    bugBounties.data?.find((b) => b.id === finding.data?.bugBountyId);

  const walrusClient = () =>
    new WalrusClient({
      network: "testnet",
      suiClient: suiClient(),
      wasmUrl:
        "https://unpkg.com/@mysten/walrus-wasm@latest/web/walrus_wasm_bg.wasm",
    });

  const downloadBlob = downloadBlobMutation();
  const handleDownloadPublicReport = () =>
    downloadBlob.mutateAsync({
      blobId: finding.data!.publicReportBlobId!,
      name: `public_${formatAddress(props.findingId)}.tar`,
      walrusClient: walrusClient(),
    });
  const handleDownloadPrivateReport = () =>
    downloadBlob.mutateAsync({
      blobId: finding.data!.privateReportBlobId!,
      name: `private_${formatAddress(props.findingId)}.tar`,
      walrusClient: walrusClient(),
    });

  const handleDownloadErrorMessage = () =>
    downloadBlob.mutateAsync({
      blobId: finding.data!.errorMessageBlobId!,
      name: `error_${formatAddress(props.findingId)}.txt`,
      walrusClient: walrusClient(),
    });

  const removePayment = removePaymentMutation();
  const handleRemovePayment = () => {
    removePayment.mutateAsync({
      network: network.value as Network,
      wallet: wallet.value!,
      user: user.value!,
      finding: finding.data!,
    });
  };

  const payFinding = payFindingMutation();
  const handlePay = () => {
    payFinding.mutateAsync({
      network: network.value as Network,
      wallet: wallet.value!,
      user: user.value!,
      finding: finding.data!,
    });
  };

  const publishFinding = publishFindingMutation();
  const handlePublish = () => {
    publishFinding.mutateAsync({
      network: network.value as Network,
      wallet: wallet.value!,
      user: user.value!,
      finding: finding.data!,
    });
  };

  const destroyFinding = destroyFindingMutation();
  const handleDestroy = () => {
    destroyFinding.mutateAsync({
      network: network.value as Network,
      wallet: wallet.value!,
      user: user.value!,
      finding: finding.data!,
    });
  };

  const withdrawFinding = withdrawFindingMutation();
  const handleWithdraw = () => {
    withdrawFinding.mutateAsync({
      network: network.value as Network,
      wallet: wallet.value!,
      user: user.value!,
      finding: finding.data!,
    });
  };

  return (
    <section class="card">
      <h2>Finding {formatAddress(props.findingId)}</h2>
      <div class={formStyles.container}>
        <div class={formStyles.grid}>
          <label for={`bugBounty${props.findingId}`}>Bug bounty:</label>
          <RouterLink
            id={`packageId${props.findingId}`}
            to="/bug-bounties"
            search={{
              network: network.value as Network,
              user: user.value,
            }}
          >
            {bugBounty()?.name} (
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
                    bugBounty: bugBounty(),
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
                  bugBounty: bugBounty(),
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
    </section>
  );
};

export default FindingCard;
