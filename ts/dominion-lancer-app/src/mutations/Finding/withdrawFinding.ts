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

export type WithdrawFindingProps = {
  network: Network;
  findingId: string;
};

export type WithdrawFindingKey = [
  network: Network,
  type: "withdrawFinding",
  findingId: string
];

export const withdrawFindingKey = (
  props: WithdrawFindingProps
): WithdrawFindingKey => [props.network, "withdrawFinding", props.findingId];

export const withdrawFindingMutation = (props: WithdrawFindingProps) =>
  useMutation(
    createMemo(() => {
      const config = useConfig(props.network);
      const client = useSui(props.network);
      const network = props.network;
      const findingId = props.findingId;

      return {
        mutationKey: withdrawFindingKey(props),
        mutationFn: async ({
          wallet,
        }: {
          wallet: SuiWallet;
        }) =>
          untrack(async () => {
            const finding = await useFinding({
              network,
              findingId,
            }).promise;
            if (!finding) {
              throw new Error("Finding not loaded");
            }
            const tx = new Transaction();
            const affectedFields = [];
            for (const payment of finding.payments) {
              if (payment.payed === undefined || payment.payed <= 0n) {
                continue;
              }
              affectedFields.push(payment.fieldId);
              tx.moveCall({
                target: `${config.lancer.package}::finding::withdraw_coin`,
                typeArguments: [payment.type],
                arguments: [
                  tx.object(finding.ownerCapId),
                  tx.object(findingId),
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

            return { txDigest: response.digest, finding, affectedFields };
          }),
        onSuccess: async ({
          finding,
          affectedFields,
        }: {
          finding: Finding;
          affectedFields: string[];
        }) => {
          await Promise.all([
            queryClient.invalidateQueries({
              queryKey: suiObjectKey({
                network,
                id: finding.innerId,
              }),
            }),
            queryClient.invalidateQueries({
              queryKey: suiDynamicFieldsKey({
                network,
                parentId: finding.paymentsParentId,
              }),
            }),
            ...affectedFields.map((fieldId) =>
              queryClient.invalidateQueries({
                queryKey: suiObjectKey({
                  network,
                  id: fieldId,
                }),
              })
            ),
          ]);
        },
      };
    })
  );
