import { SealClient, SessionKey } from "@mysten/seal";
import { SuiClient } from "@mysten/sui/client";
import { Transaction } from "@mysten/sui/transactions";
import { formatAddress } from "@mysten/sui/utils";
import { fromHex } from "@mysten/utils";
import { WalrusClient } from "@mysten/walrus";
import { useMutation } from "@tanstack/solid-query";
import { Accessor, createMemo, untrack } from "solid-js";
import { SuiWallet } from "~/contexts";
import { useBugBounty } from "~/queries/bugBounty";
import { queryClient } from "~/queries/client";
import { useFinding } from "~/queries/finding";
import { sealSessionOptions } from "~/queries/sealSession";
import { BugBounty } from "~/sdk/BugBounty";
import { Finding } from "~/sdk/Finding";
import { Network, useConfig } from "~/stores/config";
import { sealClient } from "~/stores/seal";
import { useSui } from "~/stores/suiClient";
import { walrusClient } from "~/stores/walrus";

export type FieldKind = "publicReport" | "privateReport" | "errorMessage";

export type DownloadBlobKey = [
  network: Network,
  type: "downloadBlob",
  user: string,
  findingId: string,
  fieldKind: FieldKind
];

export const downloadBlobKey = (props: DownloadBlobProps): DownloadBlobKey => [
  props.network,
  "downloadBlob",
  props.user,
  props.findingId,
  props.fieldKind,
];

export type DownloadBlobProps = {
  network: Network;
  user: string;
  findingId: string;
  fieldKind: FieldKind;
};

export const downloadBlobMutation = (props: DownloadBlobProps) =>
  useMutation(
    createMemo(() => {
      const sui = useSui(props.network);
      const walrus = walrusClient(props.network);
      const seal = sealClient(props.network);
      const config = useConfig(props.network);
      const findingId = props.findingId;
      const fieldKind = props.fieldKind;
      const network = props.network;
      const user = props.user;
      return {
        mutationKey: downloadBlobKey(props),
        mutationFn: async ({
          wallet,
          setUrl,
        }: {
          wallet: SuiWallet;
          setUrl: ({name, url}: {name: string, url: string}) => void;
        }) =>
          untrack(async () => {
            const finding = await useFinding({
              network,
              findingId,
            }).promise;
            if (!finding) {
              throw new Error("Finding is not loaded");
            }
            const bugBounty = useBugBounty({
              network,
              bugBountyId: finding.bugBountyId,
            });
            if (!bugBounty.data) {
              throw new Error("Bug Bounty is not loaded");
            }
            const sessionKey = await queryClient.ensureQueryData(
              sealSessionOptions({
                network,
                user,
                wallet,
              })
            );

            const sealId = new Uint8Array(33);
            sealId.set(fromHex(findingId));
            let blobId: string;
            let name: string;
            let type: string;
            switch (fieldKind) {
              case "publicReport":
                blobId = finding.publicReportBlobId!;
                sealId.set([0], 32);
                name = `public_${formatAddress(findingId)}.tar`;
                type = "application/x-tar";
                break;
              case "privateReport":
                blobId = finding.privateReportBlobId!;
                sealId.set([1], 32);
                name = `private_${formatAddress(findingId)}.tar`;
                type = "application/x-tar";
                break;
              case "errorMessage":
                blobId = finding.errorMessageBlobId!;
                sealId.set([2], 32);
                name = `error_${formatAddress(findingId)}.txt`;
                type = "text/plain";
                break;
            }
            const data = await walrus.readBlob({
              blobId,
            });

            const tx = new Transaction();
            if (finding.owner === user) {
              tx.moveCall({
                target: `${config.lancer.package}::finding::seal_approve_with_owner_cap`,
                arguments: [
                  tx.pure.vector("u8", sealId),
                  tx.object(finding.ownerCapId),
                  tx.object(findingId),
                ],
              });
            } else {
              tx.moveCall({
                target: `${config.lancer.package}::finding::seal_approve_with_bug_bounty`,
                arguments: [
                  tx.pure.vector("u8", sealId),
                  tx.object(bugBounty.data.ownerCapId),
                  tx.object(findingId),
                ],
              });
            }
            const txBytes = await tx.build({
              client: sui,
              onlyTransactionKind: true,
            });
            tx.setSender(user);
            tx.setGasBudget(1000000);
            const r = await sui.dryRunTransactionBlock({
              transactionBlock: await tx.build({
                client: sui,
              }),
            });
            console.log(r);
            const decryptedBytes = await seal.decrypt({
              data,
              sessionKey,
              txBytes,
            });
            const blob = new Blob([decryptedBytes], { type });

            setUrl({name, url: URL.createObjectURL(blob)});
          }),
      };
    })
  );
