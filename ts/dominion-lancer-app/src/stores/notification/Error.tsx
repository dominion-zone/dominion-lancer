import { SuiTransactionBlockResponse } from "@mysten/sui/client";
import { formatDigest } from "@mysten/sui/utils";
import { JSX } from "solid-js";
import { Dynamic } from "solid-js/web";
import { Toast, ToasterStore, ToastProps } from "terracotta";
import { ANotification } from "./abstract";

export class ErrorNotification extends ANotification {
  constructor(public readonly error: Error) {
    super();
  }

  override render(props: ToastProps) {
    const error = this.error;
    return <Toast {...props}>{error.message}</Toast>;
  }
}
