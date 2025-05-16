import { WalrusClient } from "@mysten/walrus";
import { useMutation } from "@tanstack/solid-query";

export type DownloadBlobProps = {
  blobId: string;
  name: string;
  walrusClient: WalrusClient;
};

export const downloadBlobMutation = () => {
  return useMutation(() => ({
    mutationKey: ["downloadBlob"],
    mutationFn: async (props: DownloadBlobProps) => {
      const b = await props.walrusClient.readBlob({
        blobId: props.blobId,
      });
      const blob = new Blob([b], { type: "application/x-tar" });

      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = props.name;

      document.body.appendChild(a);
      a.click();

      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
  }));
};
