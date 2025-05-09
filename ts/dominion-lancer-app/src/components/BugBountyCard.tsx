import { normalizeStructTag } from "@mysten/sui/utils";
import { createLink } from "@tanstack/solid-router";
import { Link, Square, SquareCheck } from "lucide-solid";
import { Show } from "solid-js";
import { Button } from "terracotta";
import { useSuiUser } from "~/contexts";
import { BugBounty } from "~/sdk/BugBounty";
import { useConfig } from "~/stores/config";

export type BugBountyCardProps = {
  bugBounty: BugBounty;
};

const BugBountyCard = (props: BugBountyCardProps) => {
  const LinkButton = createLink(Button);

  const user = useSuiUser();

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
      <p>Package: {props.bugBounty.packageId}</p>
      <Show when={props.bugBounty.owner}>
        <p>Owned by: {props.bugBounty.owner}</p>
      </Show>
      <p class="line">
        <span>
          Active:{" "}
          <Show when={props.bugBounty.isActive} fallback={<Square size={18} />}>
            <SquareCheck size={18} />
          </Show>{" "}
        </span>
        <span>
          Approved:{" "}
          <Show when={isApproved()} fallback={<Square size={18} />}>
            <SquareCheck size={18} />
          </Show>
        </span>
        <LinkButton
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
      </p>
    </section>
  );
};

export default BugBountyCard;
