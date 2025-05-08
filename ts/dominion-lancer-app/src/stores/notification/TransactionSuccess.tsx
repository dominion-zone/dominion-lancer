import { SuiTransactionBlockResponse } from "@mysten/sui/client";
import { formatDigest } from "@mysten/sui/utils";
import { JSX } from "solid-js";
import { Dynamic } from "solid-js/web";
import { Toast, ToasterStore, ToastProps } from "terracotta";
import { ANotification } from "./abstract";

export class TransactionSuccessNotification extends ANotification {
  constructor(
    public readonly response: SuiTransactionBlockResponse,
    public readonly network: string,
    public readonly user: string,
  ) {
    super();
  }

  transactionLink() {
    const digest = this.response.digest;
    const network = this.network;
    return (
      <a
        target="_blank"
        rel="noreferrer"
        href={`https://${
          network === 'mainnet' ? '' : network + '.'
        }suivision.xyz/txblock/${digest}`}
      >
        {formatDigest(digest)}
      </a>
    );
  }

  override render(props: ToastProps) {
    console.log('TransactionSuccessNotification render');
    const l = () => this.transactionLink();
    return (
      <Toast {...props}>
        Tx <Dynamic component={l} /> success
      </Toast>
    );
  }
}