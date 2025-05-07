import { Transaction } from "@mysten/sui/transactions";
import { useMutation } from "@tanstack/solid-query";
import { SuiWallet } from "~/contexts";
import { config, Network } from "~/stores/config";
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
      const client = suiClient(props.network);
      const tx = new Transaction();
      const [bugBounty, ownerCap] = tx.moveCall({
        target: `${config[props.network].lancer.package}::bug_bounty::create_v1`,
        typeArguments: [],
        arguments: [tx.object(props.packageId), tx.pure.string(props.name)],
      });
      if (props.upgradeCapId) {
        tx.moveCall({
          target: `${config[props.network].lancer.package}::upgrader_approve::approve`,
          typeArguments: [],
          arguments: [ownerCap, bugBounty, tx.object(props.upgradeCapId)],
        });
      }
      tx.transferObjects([ownerCap], tx.pure.address(props.user));
      tx.moveCall({
        target: `${config[props.network].lancer.package}::bug_bounty::share`,
        typeArguments: [],
        arguments: [bugBounty],
      })
      execTx({
        tx,
        wallet: props.wallet,
        user: props.user,
        network: props.network,
        client,
      });
    },
  }));
};
