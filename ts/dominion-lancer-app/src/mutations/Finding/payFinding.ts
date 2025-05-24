import { CoinStruct, SuiClient } from "@mysten/sui/client";
import { coinWithBalance, Transaction } from "@mysten/sui/transactions";
import { normalizeStructTag, SUI_FRAMEWORK_ADDRESS } from "@mysten/sui/utils";
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

export type PayFindingProps = {
  network: Network;
  user: string;
  findingId: string;
};

export type PayFindingKey = [
  network: Network,
  type: "payFinding",
  user: string,
  findingId: string
];

export const payFindingKey = (props: PayFindingProps): PayFindingKey => [
  props.network,
  "payFinding",
  props.user,
  props.findingId,
];

export const payFindingMutation = (props: PayFindingProps) =>
  useMutation(
    createMemo(() => {
      const config = useConfig(props.network);
      const client = useSui(props.network);
      const network = props.network;
      const findingId = props.findingId;
      const user = props.user;
      return {
        mutationKey: payFindingKey(props),
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
            tx.setSender(user);
            const affectedFields = [];
            for (const payment of finding.payments) {
              if (
                payment.requested === undefined ||
                payment.payed === undefined ||
                payment.requested <= payment.payed
              ) {
                continue;
              }
              affectedFields.push(payment.fieldId);
              tx.moveCall({
                target: `${config.lancer.package}::finding::pay_coin`,
                typeArguments: [payment.type],
                arguments: [
                  tx.object(findingId),
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
              wallet,
              user,
              network,
              client,
              options: {
                showEvents: true,
              },
            });

            return { txDigest: response.digest, finding, affectedFields };
          }),
        onSuccess: async ({
          txDigest,
          finding,
          affectedFields,
        }: {
          txDigest: string;
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
