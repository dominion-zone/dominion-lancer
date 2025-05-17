import { CoinStruct, SuiClient } from "@mysten/sui/client";
import { coinWithBalance, Transaction } from "@mysten/sui/transactions";
import { normalizeStructTag, SUI_FRAMEWORK_ADDRESS } from "@mysten/sui/utils";
import { useMutation } from "@tanstack/solid-query";
import { SuiWallet } from "~/contexts";
import { queryClient } from "~/queries/client";
import { findingKey } from "~/queries/finding";
import { Finding } from "~/sdk/Finding";
import { Network, useConfig } from "~/stores/config";
import { suiClient } from "~/stores/suiClient";
import execTx from "~/utils/execTx";

export type WithdrawFindingProps = {
  network: Network;
  wallet: SuiWallet;
  user: string;
  finding: Finding;
};

export const withdrawFindingMutation = () =>
  useMutation(() => ({
    mutationKey: ["withdrawFinding"],
    mutationFn: async (props: WithdrawFindingProps) => {
      const config = useConfig(props.network);
      const client = suiClient(props.network);
      const tx = new Transaction();
      for (const payment of props.finding.payments) {
        if (payment.payed <= 0n) {
          continue;
        }
        tx.moveCall({
          target: `${config.lancer.package}::finding::withdraw_coin`,
          typeArguments: [payment.type],
          arguments: [
            tx.object(props.finding.ownerCapId),
            tx.object(props.finding.id),
          ],
        });
      }

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

      return { txDigest: response.digest };
    },
    onSuccess: (data, props) => {
      queryClient.invalidateQueries({
        queryKey: findingKey({
          network: props.network,
          findingId: props.finding.id,
        }),
      });
      return data;
    },
  }));
