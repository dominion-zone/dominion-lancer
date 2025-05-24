import { MoveStruct, MoveValue, SuiClient } from "@mysten/sui/client";
import { BugBounty } from "./BugBounty";
import { toBase64 } from "@mysten/utils";
import { blobIdFromInt } from "@mysten/walrus";
import { Config } from "~/stores/config";

export type FindingStatus = "Processing" | "Draft" | "Error" | "Published";
export const findingStatuses: [FindingStatus, ...FindingStatus[]] = [
  "Processing",
  "Draft",
  "Error",
  "Published",
];

export type Finding = {
  id: string;
  innerId: string;
  ownerCapId: string;
  owner: string | null;
  bugBountyId: string;
  submissionHash: Uint8Array;
  publicReportBlobId: string | null;
  privateReportBlobId: string | null;
  errorMessageBlobId: string | null;
  isPublished: boolean;
  walFunds: bigint;
  payments: { fieldId: string; payed?: bigint; requested?: bigint; type: string }[];
  paymentsParentId: string;
  payedCount: bigint;
};

export const findingStatus = (finding: Finding): FindingStatus => {
  if (finding.errorMessageBlobId) {
    return "Error";
  }
  if (!finding.publicReportBlobId) {
    return "Processing";
  }
  if (finding.isPublished) {
    return "Published";
  }
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
  return Boolean(finding.payments.find((p) => (p.payed || 0n) > 0n));
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
        (props.bugBounty?.owner === props.user && props.finding.isPublished))
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
          props.finding.isPublished &&
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

/*
const parseFinding = async ({
  client,
  id,
  fields,
}: {
  client: SuiClient;
  id: string;
  fields: MoveStruct;
}): Promise<Finding> => {
  const versioned = (
    (
      fields as {
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

  return {
    id,
    bugBountyId: inner.bug_bounty_id,
    ownerCapId: inner.owner_cap_id,
    submissionHash: new Uint8Array(inner.submission_hash),
    isPublished: inner.is_published,
    walFunds: BigInt(inner.wal_funds),
    publicReportBlobId:
      inner.public_report_blob &&
      blobIdFromInt(inner.public_report_blob.fields.blob_id),
    privateReportBlobId:
      inner.private_report_blob &&
      blobIdFromInt(inner.private_report_blob.fields.blob_id),
    errorMessageBlobId:
      inner.error_message_blob &&
      blobIdFromInt(inner.error_message_blob.fields.blob_id),
    payedCount: BigInt(inner.payed_count),
    payments: payments.map((p) => ({
      payed: BigInt(p.paid),
      requested: BigInt(p.requested),
      type: p.type,
    })),
    owner:
      (ownerCap.data!.owner as { AddressOwner?: string }).AddressOwner ?? null,
  };
};
*/

export const getAllFindingIds = async ({
  config,
  client,
}: {
  config: Config;
  client: SuiClient;
}) => {
  const ids: string[] = [];
  let cursor = null;
  for (;;) {
    const page = await client.queryEvents({
      query: {
        MoveEventType: `${config.lancer.typeOrigins.finding.FindingCreatedEvent}::finding::FindingCreatedEvent`,
      },
      cursor,
    });
    ids.push(
      ...page.data.map(
        (event) =>
          (
            event as {
              parsedJson: any;
            }
          ).parsedJson.finding_id as string
      )
    );
    if (page.hasNextPage) {
      cursor = page.nextCursor;
    } else {
      break;
    }
  }
  return ids;
};

export const getUserFindingIds = async ({
  config,
  client,
  user,
}: {
  config: Config;
  client: SuiClient;
  user: string;
}) => {
  let ids: string[] = [];
  let cursor = null;
  for (;;) {
    const page = await client.getOwnedObjects({
      owner: user,
      cursor,
      filter: {
        StructType: `${config.lancer.typeOrigins.finding.OwnerCap}::finding::OwnerCap`,
      },
      options: {
        showContent: true,
      },
    });

    for (const obj of page.data) {
      ids.push(
        (
          (obj.data!.content as { fields: MoveStruct }).fields as {
            finding_id: string;
          }
        ).finding_id as string
      );
    }
    if (page.hasNextPage) {
      cursor = page.nextCursor;
    } else {
      break;
    }
  }

  return ids;
};

/*
export const getFinding = async ({
  client,
  id,
}: {
  client: SuiClient;
  id: string;
}) => {
  const outer = await client.getObject({
    id,
    options: {
      showContent: true,
    },
  });

  return await parseFinding({
    client,
    id,
    fields: (outer.data!.content as { fields: MoveStruct }).fields,
  });
};

export const getFindings = async ({
  client,
  ids,
}: {
  client: SuiClient;
  ids: string[];
}): Promise<Finding[]> => {
  const outers = await client.multiGetObjects({
    ids,
    options: {
      showContent: true,
    },
  });
  return await Promise.all(
    ids
      .map(
        (id, i) =>
          outers[i].data &&
          parseFinding({
            id,
            client,
            fields: (outers[i].data.content as { fields: MoveStruct }).fields,
          })
      )
      .filter((p) => p) as Promise<Finding>[]
  );
};
*/
