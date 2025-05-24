import { Transaction } from "@mysten/sui/transactions";
import { useMutation } from "@tanstack/solid-query";
import { createMemo, untrack } from "solid-js";
import { SuiWallet } from "~/contexts";
import { bugBountyIdsKey } from "~/queries/bugBountyIds";
import { queryClient } from "~/queries/client";
import { BugBounty } from "~/sdk/BugBounty";
import { useConfig, Network } from "~/stores/config";

import { useSui } from "~/stores/suiClient";
import execTx from "~/utils/execTx";

export type CreateBugBountyProps = {
  network: Network;
  user: string;
};

export type CreateBugBountyKey = [
  network: Network,
  type: "createBugBounty",
  user: string
];

export const createBugBountyKey = (
  props: CreateBugBountyProps
): CreateBugBountyKey => [props.network, "createBugBounty", props.user];

export const createBugBountyMutation = (props: CreateBugBountyProps) => {
  return useMutation(
    createMemo(() => {
      const config = useConfig(props.network);
      const client = useSui(props.network);
      const user = props.user;
      const network = props.network;

      return {
        mutationKey: createBugBountyKey(props),
        mutationFn: async ({
          wallet,
          packageId,
          name,
          upgradeCapId,
        }: {
          wallet: SuiWallet;
          packageId: string;
          name: string;
          upgradeCapId?: string;
        }) =>
          untrack(async () => {
            const tx = new Transaction();
            const [bugBountyArg, ownerCap] = tx.moveCall({
              target: `${config.lancer.package}::bug_bounty::create_v1`,
              typeArguments: [],
              arguments: [tx.object(packageId), tx.pure.string(name)],
            });
            if (upgradeCapId) {
              tx.moveCall({
                target: `${config.lancer.package}::upgrader_approve::approve`,
                typeArguments: [],
                arguments: [ownerCap, bugBountyArg, tx.object(upgradeCapId)],
              });
            }
            tx.transferObjects([ownerCap], tx.pure.address(user));
            tx.moveCall({
              target: `${config.lancer.package}::bug_bounty::share`,
              typeArguments: [],
              arguments: [bugBountyArg],
            });
            const response = await execTx({
              tx,
              wallet,
              user,
              network,
              client,
              options: {
                showEvents: true,
              },
            });

            const event = response.events!.find(
              (e) =>
                e.type ===
                `${config.lancer.typeOrigins.bugBounty.BugBountyCreatedEvent}::bug_bounty::BugBountyCreatedEvent`
            )!.parsedJson as { bug_bounty_id: string; owner_cap_id: string };

            const bugBounty: BugBounty = {
              id: event.bug_bounty_id,
              name,
              packageId,
              ownerCapId: event.owner_cap_id,
              approves: upgradeCapId
                ? [
                    `${config.lancer.typeOrigins.upgraderApprove.UpgraderApproveV1}::upgrader_approve::UpgraderApproveV1`,
                  ]
                : [],
              owner: user,
              isActive: true,
            };

            return {
              bugBounty,
              txDigest: response.digest,
            };
          }),
        onSuccess: async ({ bugBounty }: { bugBounty: BugBounty }) => {
          {
            setTimeout(() => {
              queryClient.setQueryData(
                bugBountyIdsKey({ network }),
                (old: string[] | undefined) => {
                  if (old === undefined) return undefined;
                  return [...old, bugBounty.id];
                }
              );
              queryClient.setQueryData(
                bugBountyIdsKey({ network, ownedBy: user }),
                (old: string[] | undefined) => {
                  if (old === undefined) return undefined;
                  return [...old, bugBounty.id];
                }
              );
            }, 10);
          }
        },
      };
    })
  );
};
