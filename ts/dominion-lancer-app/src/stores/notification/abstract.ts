import { SuiTransactionBlockResponse } from "@mysten/sui/client";
import { formatDigest } from "@mysten/sui/utils";
import { JSX } from "solid-js";
import { Dynamic } from "solid-js/web";
import { Toast, ToasterStore, ToastProps } from "terracotta";

export abstract class ANotification {
  abstract render(props: ToastProps): JSX.Element;
}
