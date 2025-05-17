import { useMutation } from "@tanstack/solid-query";
import { queryClient } from "../../queries/client";
import { serverPkOptions } from "../../queries/serverPk";
import { useConfig, Network } from "../../stores/config";
import axios from "axios";
import { SuiWallet } from "~/contexts";
import { fromHex } from "@mysten/utils";
import { coinWithBalance, Transaction } from "@mysten/sui/transactions";
import { SUI_FRAMEWORK_ADDRESS } from "@mysten/sui/utils";
import { suiClient } from "~/stores/suiClient";
import execTx from "~/utils/execTx";
import { Escrow } from "~/sdk/Escrow";
import { Finding } from "~/sdk/Finding";
import { findingKey } from "~/queries/finding";
import { findingIdsKey } from "~/queries/findingIds";

export type CreateFindingProps = {
  network: Network;
  wallet: SuiWallet;
  user: string;
  bugBountyId: string;
  paymentSui: bigint;
  topupSui: bigint;
  escrows: Escrow[];
  file: File;
};

export const createFindingMutation = () => {
  return useMutation(
    () => ({
      mutationKey: ["createFinding"],
      mutationFn: async (props: CreateFindingProps) => {
        const config = useConfig(props.network);
        const client = suiClient(props.network);

        const serverPublicKey = await queryClient.ensureQueryData(
          serverPkOptions({ network: props.network })
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
          await props.file.arrayBuffer()
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
        formData.append("bugBountyId", props.bugBountyId);

        const parts: Uint8Array<ArrayBufferLike>[] = [iv];
        parts.push(new Uint8Array(encryptedFile));
        parts.push(new Uint8Array(encryptedKey));
        parts.push(fromHex(props.bugBountyId));

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
        tx.setSender(props.user);

        const [findingArg, ownerCapArg] = tx.moveCall({
          target: `${config.lancer.package}::finding::create_v1`,
          arguments: [
            tx.object(props.bugBountyId),
            tx.pure.vector("u8", Array.from(new Uint8Array(submissionHash))),
          ],
        });

        if (props.paymentSui > 0n) {
          tx.moveCall({
            target: `${config.lancer.package}::finding::add_payment`,
            arguments: [ownerCapArg, findingArg, tx.pure.u64(props.paymentSui)],
            typeArguments: [`${SUI_FRAMEWORK_ADDRESS}::sui::SUI`],
          });
        }

        tx.transferObjects([ownerCapArg], props.user);
        tx.moveCall({
          target: `${config.lancer.package}::finding::share`,
          arguments: [findingArg],
          typeArguments: [],
        });

        const escrowArgs = props.escrows.map((escrow) => tx.object(escrow.id));

        if (props.topupSui > 0n) {
          if (escrowArgs.length > 0) {
            tx.moveCall({
              target: `${config.runner.package}::escrow::deposit_coin`,
              arguments: [
                tx.object(escrowArgs[0]),
                coinWithBalance({ balance: props.topupSui }),
              ],
              typeArguments: [`${SUI_FRAMEWORK_ADDRESS}::sui::SUI`],
            });
          } else {
            tx.moveCall({
              target: `${config.runner.package}::escrow::create_and_transfer_cap`,
              arguments: [
                tx.object(config.runner.server.object),
                coinWithBalance({ balance: props.topupSui }),
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
              tx.object(props.escrows[0].ownerCapId),
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
          wallet: props.wallet,
          user: props.user,
          network: props.network,
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

        if (props.escrows.length > 0) {
          formData.append("escrowId", props.escrows[0].id);
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

        const finding: Finding = {
          id: findingCreatedEvent.finding_id,
          bugBountyId: findingCreatedEvent.bug_bounty_id,
          ownerCapId: findingCreatedEvent.owner_cap_id,
          submissionHash: new Uint8Array(submissionHash),
          walFunds: 0n,
          owner: props.user,
          publicReportBlobId: null,
          privateReportBlobId: null,
          errorMessageBlobId: null,
          isPublished: false,
          payments:
            props.paymentSui > 0n
              ? [
                  {
                    payed: 0n,
                    requested: props.paymentSui,
                    type: `${SUI_FRAMEWORK_ADDRESS}::sui::SUI`,
                  },
                ]
              : [],
          payedCount: 0n,
        };

        return {
          finding,
          txDigest: response.digest,
        };
      },
      onSuccess: async ({ finding }, props) => {
        queryClient.setQueryData(
          findingKey({
            network: props.network,
            findingId: finding.id,
          }),
          finding
        );
        queryClient.setQueryData(
          findingIdsKey({
            network: props.network,
            ownedBy: props.user,
          }),
          (old: string[] | undefined) => {
            if (old === undefined) return undefined;
            return [...old, finding.id];
          }
        );
        queryClient.setQueryData(
          findingIdsKey({
            network: props.network,
          }),
          (old: string[] | undefined) => {
            if (old === undefined) return undefined;
            return [...old, finding.id];
          }
        );
      },
    }),
    () => queryClient
  );
};
