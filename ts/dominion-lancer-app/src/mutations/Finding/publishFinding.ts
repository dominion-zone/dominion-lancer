import { Transaction } from "@mysten/sui/transactions";
import { useMutation } from "@tanstack/solid-query";
import { createMemo, untrack } from "solid-js";
import { SuiWallet } from "~/contexts";
import { queryClient } from "~/queries/client";
import { useFinding } from "~/queries/finding";
import { suiObjectKey } from "~/queries/suiObject";
import { Finding } from "~/sdk/Finding";
import { Network, useConfig } from "~/stores/config";
import { useSui } from "~/stores/suiClient";
import execTx from "~/utils/execTx";

export type PublishFindingProps = {
  network: Network;
  findingId: string;
};

export type PublishFindingKey = [
  network: Network,
  type: "publishFinding",
  findingId: string
];

export const publishFindingKey = (
  props: PublishFindingProps
): PublishFindingKey => [props.network, "publishFinding", props.findingId];

export const publishFindingMutation = (props: PublishFindingProps) =>
  useMutation(
    createMemo(() => {
      const config = useConfig(props.network);
      const client = useSui(props.network);
      const network = props.network;
      const findingId = props.findingId;
      return {
        mutationKey: publishFindingKey(props),
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
            tx.moveCall({
              target: `${config.lancer.package}::finding::publish`,
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
          }),
        onSuccess: async ({ finding }: { finding: Finding }) => {
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
