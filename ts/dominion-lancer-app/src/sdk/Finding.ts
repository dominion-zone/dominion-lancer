import { MoveStruct, MoveValue, SuiClient } from "@mysten/sui/client";
import { BugBounty } from "./BugBounty";
import { toBase64 } from "@mysten/utils";
import { blobIdFromInt } from "@mysten/walrus";

export type FindingStatus = "Draft" | "Active" | "Error";

export type Finding = {
  id: string;
  ownerCapId: string;
  owner: string | null;
  bugBountyId: string;
  submissionHash: Uint8Array;
  publicReportBlobId: string | null;
  privateReportBlobId: string | null;
  errorMessageBlobId: string | null;
  isPublished: boolean;
  walFunds: bigint;
  payments: { payed: bigint; requested: bigint; type: string }[];
  payedCount: bigint;
};

export const findingStatus = (finding: Finding): FindingStatus => {
  return "Draft";
};

export const isPaid = (finding?: Finding) => {
  if (!finding) {
    return false;
  }
  return finding.payedCount >= finding.payments.length;
};

export const hasFundsToWithdraw = (finding?: Finding) => {
  if (!finding) {
    return false;
  }
  return Boolean(finding.payments.find((p) => p.payed > 0n));
};

export const isPublicReportReadable = (props: {
  finding?: Finding;
  bugBounty?: BugBounty;
  user?: string;
}) => {
  if (!props.finding) {
    return false;
  }
  if (props.bugBounty && props.finding.bugBountyId !== props.bugBounty.id) {
    throw new Error(
      `Finding ${props.finding.id} does not belong to Bug Bounty ${props.bugBounty.id}`
    );
  }

  return Boolean(
    props.finding.publicReportBlobId &&
      props.user &&
      (props.finding.owner === props.user ||
        props.bugBounty?.owner === props.user)
  );
};

export const isPrivateReportReadable = (props: {
  finding?: Finding;
  bugBounty?: BugBounty;
  user?: string;
}) => {
  if (!props.finding) {
    return false;
  }
  if (props.bugBounty && props.finding.bugBountyId !== props.bugBounty.id) {
    throw new Error(
      `Finding ${props.finding.id} does not belong to Bug Bounty ${props.bugBounty.id}`
    );
  }
  return Boolean(
    props.finding.privateReportBlobId &&
      props.user &&
      (props.finding.owner === props.user ||
        (props.bugBounty?.owner === props.user &&
          props.finding.payedCount >= props.finding.payments.length))
  );
};

export const isErrorMessageReadable = (props: {
  finding?: Finding;
  user?: string;
}) => {
  if (!props.finding) {
    return false;
  }
  return Boolean(
    props.finding.errorMessageBlobId &&
      props.user &&
      props.finding.owner === props.user
  );
};

export const getFinding = async (client: SuiClient, id: string) => {
  const outer = await client.getObject({
    id,
    options: {
      showContent: true,
    },
  });
  const versioned = (
    (
      (outer.data?.content as { fields: MoveStruct }).fields as {
        inner: MoveStruct;
      }
    ).inner as { fields: MoveStruct }
  ).fields as {
    id: {
      id: string;
    };
    version: string;
  };

  const df = await client.getDynamicFieldObject({
    parentId: versioned.id.id,
    name: { type: "u64", value: versioned.version },
  });
  const inner = (
    (df.data!.content as { fields: MoveStruct }).fields as {
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

  const ownerCap = await client.getObject({
    id: inner.owner_cap_id,
    options: {
      showOwner: true,
    },
  });
  // console.log("Finding", inner);

  let cursor = null;
  const payments = [];
  for (;;) {
    const page = await client.getDynamicFields({
      parentId: inner.payments.fields.id.id,
      cursor,
    });
    const dfs = await client.multiGetObjects({
      ids: page.data.map((p) => p.objectId),
      options: {
        showContent: true,
      },
    });
    for (let i = 0; i < page.data!.length; i++) {
      const start = page.data[i].objectType.indexOf("<");
      payments.push({
        type: page.data[i].objectType.slice(start + 1, -1),
        ...(
          (dfs[i].data!.content as { fields: MoveStruct }).fields as {
            value: { fields: { paid: string; requested: string } };
          }
        ).value.fields,
      });
    }
    if (page.hasNextPage) {
      cursor = page.nextCursor;
    } else {
      break;
    }
  }
  console.log("Payments", payments);

  const finding: Finding = {
    id,
    bugBountyId: inner.bug_bounty_id,
    ownerCapId: inner.owner_cap_id,
    submissionHash: new Uint8Array(inner.submission_hash),
    isPublished: inner.is_published,
    walFunds: BigInt(inner.wal_funds),
    publicReportBlobId: inner.public_report_blob && blobIdFromInt(inner.public_report_blob.fields.blob_id),
    privateReportBlobId: inner.private_report_blob && blobIdFromInt(inner.private_report_blob.fields.blob_id),
    errorMessageBlobId: inner.error_message_blob && blobIdFromInt(inner.error_message_blob.fields.blob_id),
    payedCount: BigInt(inner.payed_count),
    payments: payments.map((p) => ({
      payed: BigInt(p.paid),
      requested: BigInt(p.requested),
      type: p.type,
    })),
    owner:
      (ownerCap.data!.owner as { AddressOwner?: string }).AddressOwner ?? null,
  };
  console.log("Finding", finding);
  return finding;
};
