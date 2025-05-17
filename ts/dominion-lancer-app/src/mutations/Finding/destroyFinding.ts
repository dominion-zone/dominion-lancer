import { CoinStruct, SuiClient } from "@mysten/sui/client";
import { coinWithBalance, Transaction } from "@mysten/sui/transactions";
import { normalizeStructTag, SUI_FRAMEWORK_ADDRESS } from "@mysten/sui/utils";
import { useMutation } from "@tanstack/solid-query";
import { SuiWallet } from "~/contexts";
import { queryClient } from "~/queries/client";
import { findingKey } from "~/queries/finding";
import { findingIdsKey } from "~/queries/findingIds";
import { Finding } from "~/sdk/Finding";
import { Network, useConfig } from "~/stores/config";
import { suiClient } from "~/stores/suiClient";
import execTx from "~/utils/execTx";

export type DestroyFindingProps = {
  network: Network;
  wallet: SuiWallet;
  user: string;
  finding: Finding;
};

export const destroyFindingMutation = () =>
  useMutation(() => ({
    mutationKey: ["destroyFinding"],
    mutationFn: async (props: DestroyFindingProps) => {
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
      tx.moveCall({
        target: `${config.lancer.package}::finding::destroy_v1_and_transfer_wal`,
        typeArguments: [],
        arguments: [
          tx.object(props.finding.ownerCapId),
          tx.object(props.finding.id),
        ],
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

      return { txDigest: response.digest };
    },
    onSuccess: async (data, props) => {
      queryClient.setQueryData(
        findingKey({
          network: props.network,
          findingId: props.finding.id,
        }),
        undefined
      );
      queryClient.setQueryData(
        findingIdsKey({
          network: props.network,
          ownedBy: props.user,
        }),
        (old: string[] | undefined) =>
          old?.filter((id) => id !== props.finding.id)
      );
      queryClient.setQueryData(
        findingIdsKey({
          network: props.network,
        }),
        (old: string[] | undefined) =>
          old?.filter((id) => id !== props.finding.id)
      );
      return data;
    },
  }));
