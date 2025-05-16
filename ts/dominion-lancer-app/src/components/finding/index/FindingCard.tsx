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

export type FindingCardProps = {
  finding: Finding;
};

const FindingCard = (props: FindingCardProps) => {
  const LinkButton = createLink(Button);

  const user = useSuiUser();
  const network = useSuiNetwork();
  const bugBounties = bugBountiesQuery({
    network: network.value as Network,
  });
  const suiClient = useSuiClient();
  const wallet = useSuiWallet();

  const bugBounty = () =>
    bugBounties.data?.find((b) => b.id === props.finding.bugBountyId);

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
      blobId: props.finding.publicReportBlobId!,
      name: `public_${formatAddress(props.finding.id)}.tar`,
      walrusClient: walrusClient(),
    });
  const handleDownloadPrivateReport = () =>
    downloadBlob.mutateAsync({
      blobId: props.finding.privateReportBlobId!,
      name: `private_${formatAddress(props.finding.id)}.tar`,
      walrusClient: walrusClient(),
    });

  const handleDownloadErrorMessage = () =>
    downloadBlob.mutateAsync({
      blobId: props.finding.errorMessageBlobId!,
      name: `error_${formatAddress(props.finding.id)}.txt`,
      walrusClient: walrusClient(),
    });

  const removePayment = removePaymentMutation();
  const handleRemovePayment = () => {
    removePayment.mutateAsync({
      network: network.value as Network,
      wallet: wallet.value!,
      user: user.value!,
      finding: props.finding,
    });
  }

  const payFinding = payFindingMutation();
  const handlePay = () => {
    payFinding.mutateAsync({
      network: network.value as Network,
      wallet: wallet.value!,
      user: user.value!,
      finding: props.finding,
    });
  };

  const publishFinding = publishFindingMutation();
  const handlePublish = () => {
    publishFinding.mutateAsync({
      network: network.value as Network,
      wallet: wallet.value!,
      user: user.value!,
      finding: props.finding,
    });
  };

  const destroyFinding = destroyFindingMutation();
  const handleDestroy = () => {
    destroyFinding.mutateAsync({
      network: network.value as Network,
      wallet: wallet.value!,
      user: user.value!,
      finding: props.finding,
    });
  };

  const withdrawFinding = withdrawFindingMutation();
  const handleWithdraw = () => {
    withdrawFinding.mutateAsync({
      network: network.value as Network,
      wallet: wallet.value!,
      user: user.value!,
      finding: props.finding,
    });
  };

  return (
    <section class="card">
      <h2>Finding {formatAddress(props.finding.id)}</h2>
      <div class={formStyles.container}>
        <div class={formStyles.grid}>
          <label for={`bugBounty${props.finding.id}`}>Bug bounty:</label>
          <RouterLink
            id={`packageId${props.finding.id}`}
            to="/bug-bounties"
            search={{
              network: network.value as Network,
              user: user.value,
            }}
          >
            {bugBounty()?.name} ({formatAddress(props.finding.bugBountyId)})
          </RouterLink>
          <Show when={props.finding.owner}>
            <label for={`owner${props.finding.id}`}>Owner:</label>
            <Link
              id={`owner${props.finding.id}`}
              href={`https://${
                network.value === "mainnet" ? "" : network.value + "."
              }suivision.xyz/address/${props.finding.ownerCapId}`}
              target="_blank"
              rel="noreferrer"
            >
              {props.finding.owner}
            </Link>
          </Show>
          <Switch>
            <Match when={props.finding.publicReportBlobId}>
              <label for={`publicReport${props.finding.id}`}>
                Public report:
              </label>
              <Button
                class={buttonStyles.button}
                disabled={
                  !isPublicReportReadable({
                    finding: props.finding,
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
                !props.finding.publicReportBlobId &&
                !props.finding.errorMessageBlobId
              }
            >
              <label for={`reports${props.finding.id}`}>Reports:</label>
              <span id={`reports${props.finding.id}`}>Processing...</span>
            </Match>
          </Switch>
          <Show when={props.finding.privateReportBlobId}>
            <label for={`privateReport${props.finding.id}`}>
              Private report:
            </label>
            <Button
              class={buttonStyles.button}
              disabled={
                !isPrivateReportReadable({
                  finding: props.finding,
                  bugBounty: bugBounty(),
                  user: user.value,
                })
              }
              onClick={handleDownloadPrivateReport}
            >
              Download
            </Button>
          </Show>
          <Show when={props.finding.errorMessageBlobId}>
            <label for={`errorMessage${props.finding.id}`}>
              Error message:
            </label>
            <Button
              class={buttonStyles.button}
              disabled={
                !isErrorMessageReadable({
                  finding: props.finding,
                  user: user.value,
                })
              }
              onClick={handleDownloadErrorMessage}
            >
              Download
            </Button>
          </Show>
          <label for={`payment${props.finding.id}`}>Payment:</label>
          <Show
            when={props.finding.payments.length > 0}
            fallback={
              <span id={`payment${props.finding.id}`}>
                <Button
                  class={buttonStyles.button}
                  disabled={props.finding.isPublished}
                >
                  Add
                </Button>
              </span>
            }
          >
            <span
              id={`payment${props.finding.id}`}
              style={{
                display: "flex",
                "flex-direction": "row",
                gap: "10px",
                "align-items": "end",
              }}
            >
              <ul style={{ display: "inline-block" }}>
                <For each={props.finding.payments}>
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
                disabled={props.finding.isPublished}
                onClick={handleRemovePayment}
              >
                Remove
              </Button>
              <Button
                class={buttonStyles.button}
                disabled={isPaid(props.finding)}
                onClick={handlePay}
              >
                Pay
              </Button>
              <Button
                class={buttonStyles.button}
                disabled={hasFundsToWithdraw(props.finding)}
                onClick={handleWithdraw}
              >
                Withdraw
              </Button>
            </span>
          </Show>
          <label for={`payment${props.finding.id}`}>Publicity:</label>
          <Show
            when={!props.finding.isPublished}
            fallback={<span>Published</span>}
          >
            <span style={{ display: "flex", gap: "10px" }}>
              <Button
                class={buttonStyles.button}
                disabled={
                  !props.finding.publicReportBlobId ||
                  !user.value ||
                  user.value !== props.finding.owner
                }
                onClick={handlePublish}
              >
                Publish
              </Button>
              <Button
                class={buttonStyles.button}
                disabled={
                  props.finding.isPublished ||
                  !user.value ||
                  user.value !== props.finding.owner
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
