import { useMutation } from "@tanstack/solid-query";
import { queryClient } from "../queries/client";
import { UploadFile } from "@solid-primitives/upload";
import { serverPkOptions, serverPkQuery } from "../queries/serverPk";
import { useConfig, Network } from "../stores/config";
import axios from "axios";
import { SuiWallet, useSuiWallet } from "~/contexts";

export type CreateFindingProps = {
  network: Network;
  wallet: SuiWallet;
  user: string;
  file: UploadFile;
};

export const createFindingMutation = () => {
  const wallet = useSuiWallet();
  return useMutation(
    () => ({
      mutationKey: ["createFinding"],
      mutationFn: async (props: CreateFindingProps) => {
        const config = useConfig(props.network);
        const serverPublicKey = await queryClient.fetchQuery(
          serverPkOptions({ network: props.network })
        );
        console.log("Public key", serverPublicKey.toString());
        const aesKey = await crypto.subtle.generateKey(
          { name: "AES-GCM", length: 256 },
          true,
          ["encrypt", "decrypt"]
        );
        const blob = await (await fetch(props.file.source)).blob();
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const encryptedFile = await crypto.subtle.encrypt(
          { name: "AES-GCM", iv },
          aesKey,
          await blob.arrayBuffer()
        );

        const rawAesKey = await crypto.subtle.exportKey("raw", aesKey);
        const encryptedKey = await crypto.subtle.encrypt(
          { name: "RSA-OAEP" },
          serverPublicKey,
          rawAesKey
        );

        const formData = new FormData();
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
        formData.append(
          "iv",
          new Blob([iv], { type: "application/octet-stream" }),
          "iv.bin"
        );
        formData.append("user", props.user);

        const salt = crypto.getRandomValues(new Uint8Array(16));
        formData.append(
          "salt",
          new Blob([salt], { type: "application/octet-stream" }),
          "salt.bin"
        );
        const parts = [salt];
        parts.push(new Uint8Array(encryptedFile));
        parts.push(new Uint8Array(encryptedKey));
        parts.push(iv);

        const totalLength = parts.reduce((acc, cur) => acc + cur.length, 0);
        const data = new Uint8Array(totalLength);
        let offset = 0;
        for (const part of parts) {
          data.set(part, offset);
          offset += part.length;
        }
        const h = await crypto.subtle.digest("SHA-256", data);
        const signature = await wallet.value!.features[
          "sui:signPersonalMessage"
        ]?.signPersonalMessage({
          message: new Uint8Array(h),
          account: wallet.value!.accounts.find(
            ({ address }) => address === props.user
          )!,
        })!;
        console.log("Hash", signature.bytes);
        formData.append("signature", signature.signature);

        console.log("Sending new finding to server ", encryptedFile.byteLength);

        const result = await axios.post(
          `${config.runner.server.url}/new_finding`,
          formData
        );
      },
    }),
    () => queryClient
  );
};
