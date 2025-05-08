import { useMutation } from "@tanstack/solid-query";
import { suiClient } from "../stores/suiClient";
import { useConfig, Network } from "../stores/config";
import { coinWithBalance, Transaction } from "@mysten/sui/transactions";
import execTx from "~/utils/execTx";
import { SuiWallet } from "~/contexts";
import { queryClient } from "~/queries/client";

export type TopupUserProps = {
  network: Network;
  wallet: SuiWallet;
  user: string;
  amount: bigint;
};

export const topupUserMutation = useMutation(
  () => ({
    mutationKey: ["topupUser"],
    mutationFn: async (props: TopupUserProps) => {
      const config = useConfig(props.network);
      const client = suiClient(props.network);
      const tx = new Transaction();
      const coinArg = tx.splitCoins(tx.gas, [props.amount]);
      tx.moveCall({
        package: config.runner.package,
        module: "escrow",
        function: "create_escrow_and_transfer_cap",
        typeArguments: ["0x2::sui::SUI"],
        arguments: [
          tx.object(config.runner.server.object),
          coinArg,
        ],
      });
      await execTx({
        tx,
        wallet: props.wallet,
        user: props.user,
        network: props.network,
        client,
      });
    },
  }),
  () => queryClient
);
