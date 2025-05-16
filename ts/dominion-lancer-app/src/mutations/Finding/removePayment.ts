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

export type RemovePaymentProps = {
  network: Network;
  wallet: SuiWallet;
  user: string;
  finding: Finding;
};

export const removePaymentMutation = () =>
  useMutation(() => ({
    mutationKey: ["removePayment"],
    mutationFn: async (props: RemovePaymentProps) => {
      const config = useConfig(props.network);
      const client = suiClient(props.network);
      const tx = new Transaction();
      for (const payment of props.finding.payments) {
        tx.moveCall({
          target: `${config.lancer.package}::finding::set_payment_and_withdraw`,
          typeArguments: [payment.type],
          arguments: [
            tx.object(props.finding.ownerCapId),
            tx.object(props.finding.id),
            tx.pure.u64(0n),
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

      return response;
    },
    onSuccess: async (data, props) => {
      await queryClient.invalidateQueries({
        queryKey: findingKey({
          network: props.network,
          findingId: props.finding.id,
        }),
      });

      await queryClient.invalidateQueries({
        predicate: (query) =>
          query.queryKey[0] === props.network &&
          query.queryKey[1] === "filteredFindingIds",
      });
      return data;
    },
  }));
