import { Button } from "@kobalte/core/button";
import { normalizeStructTag } from "@mysten/sui/utils";
import { createLink } from "@tanstack/solid-router";
import { Square, SquareCheck } from "lucide-solid";
import { Show } from "solid-js";
import { useSuiNetwork, useSuiUser } from "~/contexts";
import { BugBounty } from "~/sdk/BugBounty";
import { useConfig } from "~/stores/config";
import styles from "~/styles/bugBounty/index/Card.module.css";
import formStyles from "~/styles/Form.module.css";
import buttonStyles from "~/styles/Button.module.css";
import { Link } from "@kobalte/core/link";

export type BugBountyCardProps = {
  bugBounty: BugBounty;
};

const BugBountyCard = (props: BugBountyCardProps) => {
  const LinkButton = createLink(Button);

  const user = useSuiUser();
  const network = useSuiNetwork();

  const isApproved = () =>
    props.bugBounty.approves.find(
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
      <h2>{props.bugBounty.name}</h2>
      <div class={formStyles.container}>
        <div class={formStyles.grid}>
          <label for={`packageId${props.bugBounty.id}`}>Package:</label>
          <Link
            id={`packageId${props.bugBounty.id}`}
            href={`https://${
              network.value === "mainnet" ? "" : network.value + "."
            }suivision.xyz/package/${props.bugBounty.packageId}`}
            target="_blank"
            rel="noreferrer"
          >
            {props.bugBounty.packageId}
          </Link>
          <Show when={props.bugBounty.owner}>
            <label for={`ownedBy${props.bugBounty.id}`}>Owned by:</label>
            <Link
              id={`ownedBy${props.bugBounty.id}`}
              href={`https://${
                network.value === "mainnet" ? "" : network.value + "."
              }suivision.xyz/account/${props.bugBounty.owner}`}
              target="_blank"
              rel="noreferrer"
            >
              {props.bugBounty.owner}
            </Link>
          </Show>
        </div>
        <div class={styles.line}>
          <label>
            Active:
            <Show
              when={props.bugBounty.isActive}
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
            to="/findings"
            search={(v) => ({
              network: v.network,
              user: v.user,
              bugBountyId: props.bugBounty.id,
            })}
          >
            Findings
          </LinkButton>
          <LinkButton
            class={buttonStyles.button}
            to="/findings/new"
            search={(v) => ({
              network: v.network,
              user: v.user!,
              bugBountyId: props.bugBounty.id,
            })}
            disabled={!props.bugBounty.isActive || !user.value}
          >
            Report
          </LinkButton>
        </div>
      </div>
    </section>
  );
};

export default BugBountyCard;
