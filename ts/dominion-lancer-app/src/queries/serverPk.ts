import { QueryFunction, queryOptions, useQuery } from "@tanstack/solid-query";
import { Network } from "../stores/config";
import { useConfig } from "../stores/config";
import { queryClient } from "./client";
import axios from "axios";
import { Accessor } from "solid-js";

export type ServerPkProps = {
  network: Network;
};

export type ServerPkKey = [network: Network, type: "serverPk"];

export const serverPkKey = (props: ServerPkProps): ServerPkKey => [
  props.network,
  "serverPk",
];

function importSpkiPublicKey(spkiPem: string): Promise<CryptoKey> {
  const b64 = spkiPem
    .replace("-----BEGIN PUBLIC KEY-----", "")
    .replace("-----END PUBLIC KEY-----", "")
    .replace(/\s+/g, "");

  const der = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

  return crypto.subtle.importKey(
    "spki",
    der.buffer,
    { name: "RSA-OAEP", hash: "SHA-256" },
    false,
    ["encrypt"]
  );
}

const queryFn: QueryFunction<CryptoKey, ServerPkKey> = async ({
  queryKey: [network, ,],
}) =>
  await importSpkiPublicKey(
    (
      await axios.get<string>(
        useConfig(network).runner.server.url + "/public_key"
      )
    ).data
  );

export const serverPkOptions = (props: ServerPkProps) =>
  queryOptions({
    queryKey: serverPkKey(props),
    queryFn,
  });

export const serverPkQuery = (props: ServerPkProps) =>
  useQuery(
    () => serverPkOptions(props),
    () => queryClient
  );
