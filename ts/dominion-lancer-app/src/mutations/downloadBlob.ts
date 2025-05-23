import { SealClient, SessionKey } from "@mysten/seal";
import { SuiClient } from "@mysten/sui/client";
import { Transaction } from "@mysten/sui/transactions";
import { formatAddress } from "@mysten/sui/utils";
import { fromHex } from "@mysten/utils";
import { WalrusClient } from "@mysten/walrus";
import { useMutation } from "@tanstack/solid-query";
import { Accessor } from "solid-js";
import { SuiWallet } from "~/contexts";
import { queryClient } from "~/queries/client";
import { sealSessionOptions } from "~/queries/sealSession";
import { BugBounty } from "~/sdk/BugBounty";
import { Finding } from "~/sdk/Finding";
import { Network, useConfig } from "~/stores/config";
import { sealClient } from "~/stores/seal";
import { useSui } from "~/stores/suiClient";
import { walrusClient } from "~/stores/walrus";

export type FieldKind = "publicReport" | "privateReport" | "errorMessage";

export type DownloadBlobProps = {
  network: Network;
  user: string;
  finding: Finding;
  bugBounty?: BugBounty;
  fieldKind: FieldKind;
  wallet: SuiWallet;
};

export const downloadBlobMutation = () => {
  return useMutation(() => ({
    mutationKey: ["downloadBlob"],
    mutationFn: async (props: DownloadBlobProps) => {
      const sui = useSui(props.network);
      const walrus = walrusClient(props.network);
      const seal = sealClient(props.network);
      const sessionKey = await queryClient.ensureQueryData(
        sealSessionOptions({
          network: props.network,
          user: props.user,
          wallet: props.wallet,
        })
      );

      const sealId = new Uint8Array(33);
      sealId.set(fromHex(props.finding.id));
      let blobId: string;
      let name: string;
      let type: string;
      switch (props.fieldKind) {
        case "publicReport":
          blobId = props.finding.publicReportBlobId!;
          sealId.set([0], 32);
          name = `public_${formatAddress(props.finding.id)}.tar`;
          type = "application/x-tar";
          break;
        case "privateReport":
          blobId = props.finding.privateReportBlobId!;
          sealId.set([1], 32);
          name = `private_${formatAddress(props.finding.id)}.tar`;
          type = "application/x-tar";
          break;
        case "errorMessage":
          blobId = props.finding.errorMessageBlobId!;
          sealId.set([2], 32);
          name = `error_${formatAddress(props.finding.id)}.txt`;
          type = "text/plain";
          break;
      }
      const data = await walrus.readBlob({
        blobId,
      });

      const config = useConfig(props.network);
      const tx = new Transaction();
      if (props.finding.owner === props.user) {
        tx.moveCall({
          target: `${config.lancer.package}::finding::seal_approve_with_owner_cap`,
          arguments: [
            tx.pure.vector("u8", sealId),
            tx.object(props.finding.ownerCapId),
            tx.object(props.finding.id),
          ],
        });
      } else {
        tx.moveCall({
          target: `${config.lancer.package}::finding::seal_approve_with_bug_bounty`,
          arguments: [
            tx.pure.vector("u8", sealId),
            tx.object(props.bugBounty!.ownerCapId),
            tx.object(props.finding.id),
          ],
        });
      }
      const txBytes = await tx.build({
        client: sui,
        onlyTransactionKind: true,
      });
      tx.setSender(props.user);
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

      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = name;

      document.body.appendChild(a);
      a.click();

      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
  }));
};
