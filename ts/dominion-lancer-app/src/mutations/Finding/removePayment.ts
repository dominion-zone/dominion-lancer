import { Transaction } from "@mysten/sui/transactions";
import { useMutation } from "@tanstack/solid-query";
import { createMemo, untrack } from "solid-js";
import { SuiWallet } from "~/contexts";
import { queryClient } from "~/queries/client";
import { useFinding } from "~/queries/finding";
import { suiDynamicFieldsKey } from "~/queries/suiDynamicFields";
import { suiObjectKey } from "~/queries/suiObject";
import { Finding } from "~/sdk/Finding";
import { Network, useConfig } from "~/stores/config";
import { useSui } from "~/stores/suiClient";
import execTx from "~/utils/execTx";

export type RemovePaymentProps = {
  network: Network;
  findingId: string;
};

export type RemovePaymentKey = [
  network: Network,
  type: "removePayment",
  findingId: string
];

export const removePaymentKey = (
  props: RemovePaymentProps
): RemovePaymentKey => [props.network, "removePayment", props.findingId];

export const removePaymentMutation = (props: RemovePaymentProps) =>
  useMutation(
    createMemo(() => {
      const config = useConfig(props.network);
      const client = useSui(props.network);
      const network = props.network;
      const findingId = props.findingId;

      return {
        mutationKey: removePaymentKey(props),
        mutationFn: async ({ wallet }: { wallet: SuiWallet }) =>
          untrack(async () => {
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
                  tx.object(finding.id),
                  tx.pure.u64(0n),
                ],
              });
            }
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
          }),
        onSuccess: async ({ finding }: { finding: Finding }) => {
          setTimeout(() => {
            queryClient.setQueryData(
              suiDynamicFieldsKey({
                network,
                parentId: finding.paymentsParentId,
              }),
              []
            );
            for (const payment of finding.payments) {
              queryClient.removeQueries({
                queryKey: suiObjectKey({
                  network,
                  id: payment.fieldId,
                }),
              });
            }
          }, 10);
          await queryClient.invalidateQueries({
            queryKey: suiObjectKey({
              network,
              id: finding.innerId,
            }),
          });
        },
      };
    })
  );
