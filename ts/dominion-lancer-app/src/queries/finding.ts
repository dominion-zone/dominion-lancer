import { Network } from "~/stores/config";
import { Accessor, createEffect, createMemo, untrack } from "solid-js";
import { suiObjectOptions, useSuiObject } from "./suiObject";
import {
  DynamicFieldInfo,
  MoveStruct,
  SuiObjectData,
} from "@mysten/sui/client";
import { deriveDynamicFieldID } from "@mysten/sui/utils";
import { bcs } from "@mysten/sui/bcs";
import { useSuiDynamicFields } from "./suiDynamicFields";
import { Finding } from "~/sdk/Finding";
import { blobIdFromInt } from "@mysten/walrus";
import { useQueries } from "@tanstack/solid-query";
import { queryClient } from "./client";

export type FindingProps = {
  network: Network;
  findingId: string;
};

const extractInnerInfo = (data?: SuiObjectData | null) => {
  if (!data) {
    return undefined;
  }

  const versioned = (
    (
      (data.content! as { fields: MoveStruct }).fields as {
        inner: MoveStruct;
      }
    ).inner as { fields: MoveStruct }
  ).fields as {
    id: {
      id: string;
    };
    version: string;
  };

  const id = deriveDynamicFieldID(
    versioned.id.id,
    "u64",
    bcs.U64.serialize(versioned.version).toBytes()
  );

  return {
    id,
    version: versioned.version,
  };
};

const extractInnerData = (data?: SuiObjectData | null) => {
  if (!data) {
    return undefined;
  }

  return (
    (data!.content as { fields: MoveStruct }).fields as {
      value: { fields: MoveStruct };
    }
  ).value.fields as {
    owner_cap_id: string;
    bug_bounty_id: string;
    submission_hash: number[];
    payed_count: string;
    payments: {
      fields: { id: { id: string }; size: string };
    };
    public_report_blob: {
      fields: {
        blob_id: string;
        certified_epoch: number;
        deletable: boolean;
        encoding_type: number;
        id: { id: string };
        registered_epoch: number;
        size: string;
      };
    } | null;
    private_report_blob: {
      fields: {
        blob_id: string;
        certified_epoch: number;
        deletable: boolean;
        encoding_type: number;
        id: { id: string };
        registered_epoch: number;
        size: string;
      };
    } | null;
    error_message_blob: {
      fields: {
        blob_id: string;
        certified_epoch: number;
        deletable: boolean;
        encoding_type: number;
        id: { id: string };
        registered_epoch: number;
        size: string;
      };
    } | null;
    is_published: boolean;
    wal_funds: string;
  };
};

const buildFinding = ({
  findingId,
  outerData,
  innerInfo,
  innerData,
  paymentFields,
  paymentsData,
  ownerCapData,
}: {
  findingId?: string;
  outerData?: SuiObjectData | null;
  innerInfo?: { id: string; version: string };
  innerData?: ReturnType<typeof extractInnerData>;
  paymentFields?: DynamicFieldInfo[] | null;
  paymentsData: (SuiObjectData | undefined | null)[];
  ownerCapData?: SuiObjectData | null;
}) => {
  if (!findingId) {
    return undefined;
  }
  if (outerData === null) {
    return null;
  }
  if (!innerInfo) {
    return undefined;
  }
  if (!innerData || !paymentFields || !ownerCapData) {
    return undefined;
  }

  return {
    id: findingId,
    innerId: innerInfo.id,
    bugBountyId: innerData.bug_bounty_id,
    ownerCapId: innerData.owner_cap_id,
    submissionHash: new Uint8Array(innerData.submission_hash),
    isPublished: innerData.is_published,
    walFunds: BigInt(innerData.wal_funds),
    publicReportBlobId:
      innerData.public_report_blob &&
      blobIdFromInt(innerData.public_report_blob.fields.blob_id),
    privateReportBlobId:
      innerData.private_report_blob &&
      blobIdFromInt(innerData.private_report_blob.fields.blob_id),
    errorMessageBlobId:
      innerData.error_message_blob &&
      blobIdFromInt(innerData.error_message_blob.fields.blob_id),
    payedCount: BigInt(innerData.payed_count),
    paymentsParentId: innerData.payments.fields.id.id,
    payments: paymentFields.map((p, i) => {
      let payed: bigint | undefined = undefined;
      let requested: bigint | undefined = undefined;
      if (paymentsData[i]) {
        const fields = (
          (paymentsData[i].content as { fields: MoveStruct }).fields as {
            value: { fields: { paid: string; requested: string } };
          }
        ).value.fields;
        payed = BigInt(fields.paid);
        requested = BigInt(fields.requested);
      }
      const start = p.objectType.indexOf("<");
      return {
        fieldId: p.objectId,
        payed,
        requested,
        type: p.objectType.slice(start + 1, -1),
      };
    }),
    owner:
      (ownerCapData!.owner as { AddressOwner?: string }).AddressOwner ?? null,
  };
};

export const useFinding = (props: FindingProps) =>
  untrack(() => {
    const outer = useSuiObject({
      get network() {
        return props.network;
      },
      get id() {
        return props.findingId;
      },
    });

    const innerInfo = createMemo(() => extractInnerInfo(outer.data));

    const inner = useSuiObject({
      get network() {
        return props.network;
      },
      get id() {
        return innerInfo()?.id;
      },
    });

    const innerData = createMemo(() => extractInnerData(inner.data));

    const ownerCap = useSuiObject({
      get network() {
        return props.network;
      },
      get id() {
        return innerData()?.owner_cap_id;
      },
    });

    const paymentFields = useSuiDynamicFields({
      get network() {
        return props.network;
      },
      get parentId() {
        return innerData()?.payments.fields.id.id;
      },
    });

    const paymentsData = useQueries(
      () => ({
        queries:
          paymentFields.data?.map((p) =>
            suiObjectOptions({
              network: props.network,
              id: p.objectId,
            })
          ) || [],
      }),
      () => queryClient
    );

    const finding: Accessor<Finding | null | undefined> = createMemo(() =>
      buildFinding({
        findingId: props.findingId,
        outerData: outer.data,
        innerInfo: innerInfo(),
        innerData: innerData(),
        paymentFields: paymentFields.data,
        paymentsData: paymentsData.map((p) => p.data),
        ownerCapData: ownerCap.data,
      })
    );

    return {
      get data() {
        return finding();
      },
      get isLoading() {
        return (
          outer.isLoading ||
          inner.isLoading ||
          ownerCap.isLoading ||
          paymentFields.isLoading ||
          paymentsData.some((p) => p.isLoading)
        );
      },
      get isError() {
        return (
          outer.isError ||
          inner.isError ||
          ownerCap.isError ||
          paymentFields.isError ||
          paymentsData.some((p) => p.isError)
        );
      },
      get promise() {
        return (async () =>
          buildFinding({
            findingId: props.findingId,
            outerData: await outer.promise,
            innerInfo: extractInnerInfo(await outer.promise),
            innerData: extractInnerData(await inner.promise),
            paymentFields: await paymentFields.promise,
            paymentsData: await Promise.all(paymentsData.map((p) => p.promise)),
            ownerCapData: await ownerCap.promise,
          }))();
      },
    };
  });
