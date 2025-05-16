import { Transaction } from "@mysten/sui/transactions";
import { useMutation } from "@tanstack/solid-query";
import { SuiWallet } from "~/contexts";
import { bugBountiesKey } from "~/queries/bugBounties";
import { queryClient } from "~/queries/client";
import { BugBounty } from "~/sdk/BugBounty";
import { useConfig, Network } from "~/stores/config";

import { suiClient } from "~/stores/suiClient";
import execTx from "~/utils/execTx";

export type CreateBugBountyProps = {
  network: Network;
  wallet: SuiWallet;
  user: string;
  packageId: string;
  name: string;
  upgradeCapId?: string;
};

export const createBugBountyMutation = () => {
  return useMutation(() => ({
    mutationKey: ["createBugBounty"],
    mutationFn: async (props: CreateBugBountyProps) => {
      const config = useConfig(props.network);
      const client = suiClient(props.network);
      const tx = new Transaction();
      const [bugBountyArg, ownerCap] = tx.moveCall({
        target: `${config.lancer.package}::bug_bounty::create_v1`,
        typeArguments: [],
        arguments: [tx.object(props.packageId), tx.pure.string(props.name)],
      });
      if (props.upgradeCapId) {
        tx.moveCall({
          target: `${config.lancer.package}::upgrader_approve::approve`,
          typeArguments: [],
          arguments: [ownerCap, bugBountyArg, tx.object(props.upgradeCapId)],
        });
      }
      tx.transferObjects([ownerCap], tx.pure.address(props.user));
      tx.moveCall({
        target: `${config.lancer.package}::bug_bounty::share`,
        typeArguments: [],
        arguments: [bugBountyArg],
      });
      const response = await execTx({
        tx,
        wallet: props.wallet,
        user: props.user,
        network: props.network,
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
        name: props.name,
        packageId: props.packageId,
        ownerCapId: event.owner_cap_id,
        approves: props.upgradeCapId
          ? [
              `${config.lancer.typeOrigins.upgraderApprove.UpgraderApproveV1}::upgrader_approve::UpgraderApproveV1`,
            ]
          : [],
        owner: props.user,
        isActive: true,
      };

      return {
        bugBounty,
        txDigest: response.digest,
      };
    },
    onSuccess: ({bugBounty}, props) => {
      {
        const queryKey = bugBountiesKey({ network: props.network });
        queryClient.setQueryData(
          queryKey,
          (oldData?: BugBounty[]): BugBounty[] | undefined => {
            if (oldData === undefined) {
              return undefined;
            }
            if (oldData.find((b) => b.id === bugBounty.id)) {
              return oldData;
            }
            return [bugBounty, ...oldData];
          }
        );
        queryClient.invalidateQueries({queryKey});
      }
    },
  }));
};
