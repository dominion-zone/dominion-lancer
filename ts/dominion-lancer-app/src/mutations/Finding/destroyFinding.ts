import { Transaction } from "@mysten/sui/transactions";
import { useMutation } from "@tanstack/solid-query";
import { createMemo } from "solid-js";
import { SuiWallet } from "~/contexts";
import { queryClient } from "~/queries/client";
import { useFinding } from "~/queries/finding";
import { findingIdsKey } from "~/queries/findingIds";
import { suiDynamicFieldsKey } from "~/queries/suiDynamicFields";
import { suiObjectKey } from "~/queries/suiObject";
import { Finding } from "~/sdk/Finding";
import { Network, useConfig } from "~/stores/config";
import { useSui } from "~/stores/suiClient";
import execTx from "~/utils/execTx";

export type DestroyFindingProps = {
  network: Network;
  findingId: string;
};

export type DestroyFindingKey = [
  network: Network,
  type: "destroyFinding",
  findingId: string
];

export const destroyFindingKey = (
  props: DestroyFindingProps
): DestroyFindingKey => [props.network, "destroyFinding", props.findingId];

export const destroyFindingMutation = (props: DestroyFindingProps) =>
  useMutation(
    createMemo(() => {
      const config = useConfig(props.network);
      const client = useSui(props.network);
      const network = props.network;
      const findingId = props.findingId;
      return {
        mutationKey: destroyFindingKey(props),
        mutationFn: async ({ wallet }: { wallet: SuiWallet }) => {
          const finding = await useFinding({
            network,
            findingId,
          }).promise;
          if (!finding) {
            throw new Error("Finding not loaded");
          }
          const tx = new Transaction();
          for (const payment of finding.payments) {
            tx.moveCall({
              target: `${config.lancer.package}::finding::set_payment_and_withdraw`,
              typeArguments: [payment.type],
              arguments: [
                tx.object(finding.ownerCapId),
                tx.object(findingId),
                tx.pure.u64(0n),
              ],
            });
          }
          tx.moveCall({
            target: `${config.lancer.package}::finding::destroy_v1_and_transfer_wal`,
            typeArguments: [],
            arguments: [tx.object(finding.ownerCapId), tx.object(findingId)],
          });
          const response = await execTx({
            tx,
            wallet,
            user: finding.owner!,
            network,
            client,
            options: {
              showEvents: true,
            },
          });

          return { txDigest: response.digest, finding };
        },
        onSuccess: async ({
          txDigest,
          finding,
        }: {
          txDigest: string;
          finding: Finding;
        }) => {
          setTimeout(() => {
            queryClient.setQueryData(
              findingIdsKey({
                network,
                ownedBy: finding.owner || undefined,
              }),
              (old: string[] | undefined) =>
                old?.filter((id) => id !== findingId)
            );
            queryClient.setQueryData(
              findingIdsKey({
                network,
              }),
              (old: string[] | undefined) =>
                old?.filter((id) => id !== findingId)
            );
            queryClient.removeQueries({
              queryKey: suiObjectKey({
                network,
                id: findingId,
              }),
            });
            queryClient.removeQueries({
              queryKey: suiDynamicFieldsKey({
                network,
                parentId: finding.paymentsParentId,
              }),
            });
            for (const payment of finding.payments) {
              queryClient.removeQueries({
                queryKey: suiObjectKey({
                  network,
                  id: payment.fieldId,
                }),
              });
            }
          }, 10);
        },
      };
    })
  );
