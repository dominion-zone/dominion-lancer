import { Button } from "@kobalte/core/button";
import { formatAddress, normalizeStructTag } from "@mysten/sui/utils";
import { createLink } from "@tanstack/solid-router";
import { Square, SquareCheck } from "lucide-solid";
import { Show } from "solid-js";
import { useSuiNetwork, useSuiUser } from "~/contexts";
import { Network, useConfig } from "~/stores/config";
import styles from "~/styles/bugBounty/index/Card.module.css";
import formStyles from "~/styles/Form.module.css";
import buttonStyles from "~/styles/Button.module.css";
import { Link } from "@kobalte/core/link";
import { useBugBounty } from "~/queries/bugBounty";
import { Link as RouterLink } from "@tanstack/solid-router";

export type BugBountyCardProps = {
  bugBountyId: string;
  solo?: boolean;
};

const BugBountyCard = (props: BugBountyCardProps) => {
  const LinkButton = createLink(Button);

  const user = useSuiUser();
  const network = useSuiNetwork();
  const bugBounty = useBugBounty(() => ({
    network: network.value as Network,
    bugBountyId: props.bugBountyId,
  }));

  const isApproved = () =>
    bugBounty.data?.approves.find(
      (v) =>
        normalizeStructTag(v) ===
        normalizeStructTag(
          `${
            useConfig().lancer.typeOrigins.upgraderApprove.UpgraderApproveV1
          }::upgrader_approve::UpgraderApproveV1`
        )
    );

  return (
    <section class="card">
      <h2>
        <Show
          when={!props.solo}
          fallback={
            <span>
              {bugBounty.data?.name}{" "}
              <Link
                href={`https://${
                  network.value === "mainnet" ? "" : network.value + "."
                }suivision.xyz/object/${props.bugBountyId}`}
                target="_blank"
                rel="noreferrer"
              >
                ({formatAddress(props.bugBountyId)})
              </Link>
            </span>
          }
        >
          <RouterLink
            to="/bug-bounty/$bugBountyId"
            params={{ bugBountyId: props.bugBountyId }}
          >
            {bugBounty.data?.name}
          </RouterLink>
        </Show>
      </h2>
      <div class={formStyles.container}>
        <div class={formStyles.grid}>
          <label for={`packageId${props.bugBountyId}`}>Package:</label>
          <Link
            id={`packageId${props.bugBountyId}`}
            href={`https://${
              network.value === "mainnet" ? "" : network.value + "."
            }suivision.xyz/package/${bugBounty.data?.packageId}`}
            target="_blank"
            rel="noreferrer"
          >
            {bugBounty.data?.packageId}
          </Link>
          <Show when={bugBounty.data?.owner}>
            <label for={`ownedBy${props.bugBountyId}`}>Owned by:</label>
            <Link
              id={`ownedBy${props.bugBountyId}`}
              href={`https://${
                network.value === "mainnet" ? "" : network.value + "."
              }suivision.xyz/account/${bugBounty.data?.owner}`}
              target="_blank"
              rel="noreferrer"
            >
              {bugBounty.data?.owner}
            </Link>
          </Show>
        </div>
        <div class={styles.line}>
          <label>
            Active:
            <Show
              when={bugBounty.data?.isActive}
              fallback={<Square size={18} />}
            >
              <SquareCheck size={18} />
            </Show>
          </label>
          <label>
            Approved:
            <Show when={isApproved()} fallback={<Square size={18} />}>
              <SquareCheck size={18} />
            </Show>
          </label>
          <LinkButton
            class={buttonStyles.button}
            to="/finding"
            search={(v) => ({
              network: v.network,
              user: v.user,
              bugBountyId: props.bugBountyId,
            })}
          >
            Findings
          </LinkButton>
          <LinkButton
            class={buttonStyles.button}
            to="/finding/new"
            search={(v) => ({
              network: v.network,
              user: v.user!,
              bugBountyId: props.bugBountyId,
            })}
            disabled={!bugBounty.data?.isActive || !user.value}
          >
            Report
          </LinkButton>
          <Show when={props.solo}>
            <LinkButton
              class={buttonStyles.button}
              to="/bug-bounty"
              search={{
                network: network.value as Network,
                user: user.value,
              }}
            >
              All
            </LinkButton>
          </Show>
        </div>
      </div>
    </section>
  );
};

export default BugBountyCard;
