import { createFileRoute, Link } from "@tanstack/solid-router";
import { SquarePlus } from "lucide-solid";
import { createEffect, For } from "solid-js";
import { useSuiNetwork, useSuiUser } from "~/contexts";
import { bugBountiesQuery } from "~/queries/bugBounties";
import { Network } from "~/stores/config";

export const Route = createFileRoute("/bug-bounties/")({
  component: RouteComponent,
});

function RouteComponent() {
  const user = useSuiUser();
  const network = useSuiNetwork();
  const bugBounties = bugBountiesQuery({
    network: network.value as Network,
  });

  return (
    <main>
      <For each={bugBounties.data || []}>
        {(bugBounty) => (
          <div>
            <h2>{bugBounty.name}</h2>
            <p>{bugBounty.packageId}</p>
          </div>
        )}
      </For>
      <Link
        disabled={!user.value}
        to="/bug-bounties/new"
        search={(v) => ({ user: v.user!, ...v })}
      >
        <SquarePlus />
      </Link>
    </main>
  );
}
