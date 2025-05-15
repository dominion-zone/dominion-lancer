import { createSignal } from "solid-js";
import "./Counter.css";
import { getFullnodeUrl, SuiClient } from "@mysten/sui/client";
import { WalrusClient } from "@mysten/walrus";

export default function Counter() {
  const suiClient = new SuiClient({
    url: getFullnodeUrl("testnet"),
  });

  const walrusClient = new WalrusClient({
    network: "testnet",
    suiClient,
    wasmUrl:
      "https://unpkg.com/@mysten/walrus-wasm@latest/web/walrus_wasm_bg.wasm",
  });

  const test = async () => {
    const blobId = "zCn87n4s4SfJMFcXTvL8holiJglE9CIwuXm5Bjvbqmo";
    const b = await walrusClient.readBlob({ blobId });
    const blob = new Blob([b], { type: "application/x-tar" });

    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "walrus.tar";

    document.body.appendChild(a);
    a.click();

    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <button class="increment" onClick={test} type="button">
      Test
    </button>
  );
}
