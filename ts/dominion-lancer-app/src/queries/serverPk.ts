import { queryOptions, useQuery } from "@tanstack/solid-query";
import { Network } from "../stores/config";
import { suiClient } from "../stores/suiClient";
import { config } from "../stores/config";
import { queryClient } from "./client";
import axios from "axios";

export type ServerPkProps = {
  network: Network;
};

export const serverPkKey = (props: ServerPkProps) => [
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

export const serverPkOptions = (props: ServerPkProps) =>
  queryOptions({
    queryKey: serverPkKey(props),
    queryFn: async () => {
      return importSpkiPublicKey(
        (
          await axios.get<string>(
            config[props.network].runner.server.url + "/public_key"
          )
        ).data
      );
    },
  });

export const serverPkQuery = (props: ServerPkProps) =>
  useQuery(
    () => serverPkOptions(props),
    () => queryClient
  );
