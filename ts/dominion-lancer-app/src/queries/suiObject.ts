import { QueryFunction, queryOptions, useQuery } from "@tanstack/solid-query";
import { Network, networks } from "~/stores/config";
import { useSui } from "~/stores/suiClient";
import { queryClient } from "./client";
import { Accessor, createMemo } from "solid-js";
import { SimpleChannel, TryReceivedKind } from "channel-ts";
import { SuiObjectData } from "@mysten/sui/client";

type Request = {
  id: string;
  resolve: (value: SuiObjectData | null) => void;
  reject: (reason?: Error) => void;
};

const chunkSize = 50;
const requestInterval = 100;
const requestQueues = Object.fromEntries(
  networks.map((network) => [
    network,
    {
      channel: new SimpleChannel<Request>(),
    },
  ])
) as unknown as Record<
  Network,
  { timeout?: NodeJS.Timeout; channel: SimpleChannel<Request> }
>;

async function flushRequestQueue(network: Network) {
  const sui = useSui(network);
  const chunk: Request[] = [];
  for (let i = 0; i < chunkSize; i++) {
    const request = requestQueues[network].channel.tryReceive();
    let isFinished = false;
    switch (request.kind) {
      case TryReceivedKind.value:
        chunk.push(request.value);
        break;
      case TryReceivedKind.notReceived:
      case TryReceivedKind.close:
        isFinished = true;
        break;
    }
    if (isFinished) {
      break;
    }
  }

  if (chunk.length > 0) {
    try {
      const objects = await sui.multiGetObjects({
        ids: chunk.map((r) => r.id),
        options: {
          showType: true,
          showContent: true,
          showOwner: true,
        },
      });
      for (let j = 0; j < chunk.length; j++) {
        const object = objects[j];
        if (object.error) {
          if ((object.error.code = "notExists")) {
            chunk[j].resolve(null);
          } else {
            chunk[j].reject(new Error(JSON.stringify(object.error)));
          }
        } else {
          chunk[j].resolve(object.data || null);
        }
      }
    } catch (e) {
      for (let j = 0; j < chunk.length; j++) {
        chunk[j].reject(e as Error);
      }
    }
  }

  requestQueues[network].timeout = setTimeout(() => {
    flushRequestQueue(network);
  }, requestInterval);
}

export type SuiObjectProps = {
  network: Network;
  id?: string;
};

export type SuiObjectKey = [
  network: Network,
  type: "suiObject",
  id: string | undefined
];

export const suiObjectKey = (props: SuiObjectProps): SuiObjectKey => [
  props.network,
  "suiObject",
  props.id,
];

const queryFn: QueryFunction<SuiObjectData | null | undefined, SuiObjectKey> = ({
  queryKey: [network, , id],
}) => {
  if (!id) {
    return null;
  }
  if (!requestQueues[network].timeout) {
    requestQueues[network].timeout = setTimeout(() => {
      flushRequestQueue(network);
    }, requestInterval);
  }
  return new Promise<SuiObjectData | null>((resolve, reject) => {
    requestQueues[network].channel.send({
      id,
      resolve,
      reject,
    });
  });
};

export const suiObjectOptions = (props: SuiObjectProps) => {
  return queryOptions({
    queryKey: suiObjectKey(props),
    queryFn,
    enabled: Boolean(props.id),
  });
};

export const useSuiObject = (props: SuiObjectProps) =>
  useQuery(
    () => suiObjectOptions(props),
    () => queryClient
  );
