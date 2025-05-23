import { CoinStruct, SuiClient } from "@mysten/sui/client";
import { coinWithBalance, Transaction } from "@mysten/sui/transactions";
import { normalizeStructTag, SUI_FRAMEWORK_ADDRESS } from "@mysten/sui/utils";
import { useMutation } from "@tanstack/solid-query";
import { SuiWallet } from "~/contexts";
import { queryClient } from "~/queries/client";
import { findingKey } from "~/queries/finding";
import { Finding } from "~/sdk/Finding";
import { Network, useConfig } from "~/stores/config";
import { useSui } from "~/stores/suiClient";
import execTx from "~/utils/execTx";

export type PayFindingProps = {
  network: Network;
  wallet: SuiWallet;
  user: string;
  finding: Finding;
};

export const payFindingMutation = () =>
  useMutation(() => ({
    mutationKey: ["payFinding"],
    mutationFn: async (props: PayFindingProps) => {
      const config = useConfig(props.network);
      const client = useSui(props.network);
      const tx = new Transaction();
      tx.setSender(props.user);
      for (const payment of props.finding.payments) {
        if (payment.requested <= payment.payed) {
          continue;
        }
        tx.moveCall({
          target: `${config.lancer.package}::finding::pay_coin`,
          typeArguments: [payment.type],
          arguments: [
            tx.object(props.finding.id),
            coinWithBalance({
              type: payment.type,
              balance: payment.requested - payment.payed,
            }),
          ],
        });
      }

      const response = await execTx({
        tx: {
          toJSON() {
            return tx.toJSON({ client });
          },
        },
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
    onSuccess: async (data, props) => {
      await queryClient.invalidateQueries({
        queryKey: findingKey({
          network: props.network,
          findingId: props.finding.id,
        }),
      });
      return data;
    },
  }));
