import { Button } from "@kobalte/core/button";
import { formatAddress, normalizeStructTag } from "@mysten/sui/utils";
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
import { Finding } from "~/sdk/Finding";

export type FindingCardProps = {
  finding: Finding;
};

const FindingCard = (props: FindingCardProps) => {
  const LinkButton = createLink(Button);

  const user = useSuiUser();
  const network = useSuiNetwork();


  return (
    <section class="card">
      <h2>Finding {formatAddress(props.finding.id)}</h2>
      <div class={formStyles.container}>
        <div class={formStyles.grid}>
          <label for={`bugBounty${props.finding.id}`}>Bug bounty:</label>
          <Link
            id={`packageId${props.finding.id}`}
            href={`https://${
              network.value === "mainnet" ? "" : network.value + "."
            }suivision.xyz/package/${props.finding.bugBountyId}`}
            target="_blank"
            rel="noreferrer"
          >
            {props.finding.bugBountyId}
          </Link>
        </div>
      </div>
    </section>
  );
};

export default FindingCard;
