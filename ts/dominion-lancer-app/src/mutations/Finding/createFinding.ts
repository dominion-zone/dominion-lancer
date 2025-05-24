import { useMutation } from "@tanstack/solid-query";
import { queryClient } from "../../queries/client";
import { serverPkOptions } from "../../queries/serverPk";
import { useConfig, Network } from "../../stores/config";
import axios from "axios";
import { SuiWallet } from "~/contexts";
import { fromHex } from "@mysten/utils";
import { coinWithBalance, Transaction } from "@mysten/sui/transactions";
import { SUI_FRAMEWORK_ADDRESS } from "@mysten/sui/utils";
import { useSui } from "~/stores/suiClient";
import execTx from "~/utils/execTx";
import { Escrow } from "~/sdk/Escrow";
import { Finding } from "~/sdk/Finding";
import { findingIdsKey } from "~/queries/findingIds";
import { createMemo, untrack } from "solid-js";
import { userEscrowsOptions } from "~/queries/userEscrows";

export type CreateFindingProps = {
  network: Network;
  user: string;
};

export type CreateFindingKey = [
  network: Network,
  type: "createFinding",
  user: string
];
export const createFindingKey = (
  props: CreateFindingProps
): CreateFindingKey => [props.network, "createFinding", props.user];

export const createFindingMutation = (props: CreateFindingProps) => {
  return useMutation(
    createMemo(() => {
      const config = useConfig(props.network);
      const client = useSui(props.network);
      const user = props.user;
      const network = props.network;
      return {
        mutationKey: createFindingKey(props),
        mutationFn: async ({
          wallet,
          bugBountyId,
          paymentSui,
          topupSui,
          file,
        }: {
          wallet: SuiWallet;
          bugBountyId: string;
          paymentSui: bigint;
          topupSui: bigint;
          file: File;
        }) =>
          untrack(async () => {
            const serverPublicKey = await queryClient.ensureQueryData(
              serverPkOptions({ network })
            );
            const escrows = await queryClient.ensureQueryData(
              userEscrowsOptions({
                network,
                user,
              })
            );
            const aesKey = await crypto.subtle.generateKey(
              { name: "AES-GCM", length: 256 },
              true,
              ["encrypt", "decrypt"]
            );
            const iv = crypto.getRandomValues(new Uint8Array(12));
            const encryptedFile = await crypto.subtle.encrypt(
              { name: "AES-GCM", iv },
              aesKey,
              await file.arrayBuffer()
            );

            const rawAesKey = await crypto.subtle.exportKey("raw", aesKey);
            const encryptedKey = await crypto.subtle.encrypt(
              { name: "RSA-OAEP" },
              serverPublicKey,
              rawAesKey
            );

            const formData = new FormData();
            formData.append(
              "iv",
              new Blob([iv], { type: "application/octet-stream" }),
              "iv.bin"
            );
            formData.append(
              "encryptedFile",
              new Blob([encryptedFile], { type: "application/octet-stream" }),
              "file.enc"
            );
            formData.append(
              "encryptedKey",
              new Blob([encryptedKey], { type: "application/octet-stream" }),
              "key.enc"
            );
            formData.append("bugBountyId", bugBountyId);

            const parts: Uint8Array<ArrayBufferLike>[] = [iv];
            parts.push(new Uint8Array(encryptedFile));
            parts.push(new Uint8Array(encryptedKey));
            parts.push(fromHex(bugBountyId));

            const totalLength = parts.reduce((acc, cur) => acc + cur.length, 0);
            const data = new Uint8Array(totalLength);
            let offset = 0;
            for (const part of parts) {
              data.set(part, offset);
              offset += part.length;
            }
            const submissionHash = await crypto.subtle.digest("SHA-256", data);

            /*
        if (toHex(new Uint8Array(hash)) !== result.data as string) {
          throw new Error("Hash mismatch");
        }
          */

            const tx = new Transaction();
            tx.setSender(user);

            const [findingArg, ownerCapArg] = tx.moveCall({
              target: `${config.lancer.package}::finding::create_v1`,
              arguments: [
                tx.object(bugBountyId),
                tx.pure.vector(
                  "u8",
                  Array.from(new Uint8Array(submissionHash))
                ),
              ],
            });

            if (paymentSui > 0n) {
              tx.moveCall({
                target: `${config.lancer.package}::finding::add_payment`,
                arguments: [ownerCapArg, findingArg, tx.pure.u64(paymentSui)],
                typeArguments: [`${SUI_FRAMEWORK_ADDRESS}::sui::SUI`],
              });
            }

            tx.transferObjects([ownerCapArg], user);
            tx.moveCall({
              target: `${config.lancer.package}::finding::share`,
              arguments: [findingArg],
              typeArguments: [],
            });

            const escrowArgs = escrows.map((escrow) => tx.object(escrow.id));

            if (topupSui > 0n) {
              if (escrowArgs.length > 0) {
                tx.moveCall({
                  target: `${config.runner.package}::escrow::deposit_coin`,
                  arguments: [
                    tx.object(escrowArgs[0]),
                    coinWithBalance({ balance: topupSui }),
                  ],
                  typeArguments: [`${SUI_FRAMEWORK_ADDRESS}::sui::SUI`],
                });
              } else {
                tx.moveCall({
                  target: `${config.runner.package}::escrow::create_and_transfer_cap`,
                  arguments: [
                    tx.object(config.runner.server.object),
                    coinWithBalance({ balance: topupSui }),
                  ],
                  typeArguments: [`${SUI_FRAMEWORK_ADDRESS}::sui::SUI`],
                });
              }
            }

            while (escrowArgs.length > 1) {
              const sourceEscrowArg = escrowArgs.pop()!;
              tx.moveCall({
                target: `${config.runner.package}::escrow::merge`,
                arguments: [
                  tx.object(escrows[0].ownerCapId),
                  tx.object(escrowArgs[0]),
                  tx.object(sourceEscrowArg),
                ],
                typeArguments: [`${SUI_FRAMEWORK_ADDRESS}::sui::SUI`],
              });
            }

            const response = await execTx({
              tx: {
                toJSON: () => tx.toJSON({ client }),
              },
              wallet,
              user,
              network,
              client,
              options: {
                showEvents: true,
              },
            });

            const findingCreatedEvent = response.events!.find(
              (e) =>
                e.type ===
                `${config.lancer.typeOrigins.finding.FindingCreatedEvent}::finding::FindingCreatedEvent`
            )!.parsedJson as {
              finding_id: string;
              owner_cap_id: string;
              bug_bounty_id: string;
            };
            formData.append("findingId", findingCreatedEvent.finding_id);

            if (escrows.length > 0) {
              formData.append("escrowId", escrows[0].id);
            } else {
              const escrowCreatedEvent = response.events!.find(
                (e) =>
                  e.type ===
                  `${config.runner.typeOrigins.escrow.EscrowCreatedEvent}::escrow::EscrowCreatedEvent`
              )!.parsedJson as {
                escrow_id: string;
                server_id: string;
                owner_cap_id: string;
              };
              formData.append("escrowId", escrowCreatedEvent.escrow_id);
            }

            const r = await axios.post(
              `${config.runner.server.url}/new_finding`,
              formData
            );

            return {
              findingId: findingCreatedEvent.finding_id,
              txDigest: response.digest,
            };
          }),
        onSuccess: async ({ findingId }: { findingId: string }) => {
          setTimeout(() => {
            queryClient.setQueryData(
              findingIdsKey({
                network,
                ownedBy: user,
              }),
              (old: string[] | undefined) => {
                if (old === undefined) return undefined;
                return [...old, findingId];
              }
            );
            queryClient.setQueryData(
              findingIdsKey({
                network,
              }),
              (old: string[] | undefined) => {
                if (old === undefined) return undefined;
                return [...old, findingId];
              }
            );
          }, 10);
        },
      };
    }),
    () => queryClient
  );
};
