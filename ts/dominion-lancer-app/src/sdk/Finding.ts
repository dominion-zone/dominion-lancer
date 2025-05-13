import { MoveStruct, MoveValue, SuiClient } from "@mysten/sui/client";

export type FindingStatus =
  | "Draft"
  | "Active"
  | "Error"

export type Finding = {
  id: string;
  ownerCapId: string;
  bugBountyId: string;
  submissionHash: Uint8Array;
  /*
    payments: MoveValue[],
    public_report: Option<Blob>,
    private_report: Option<Blob>,
    */
  walFunds: bigint;
};

export const findingStatus = (finding: Finding): FindingStatus => {
  return "Draft";
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
    /*
    payments: MoveValue[],
    public_report: Option<Blob>,
    private_report: Option<Blob>,
    error_message_blob
    */
    wal_funds: string;
  };

  console.log("Finding", inner);

  const finding: Finding = {
    id,
    bugBountyId: inner.bug_bounty_id,
    ownerCapId: inner.owner_cap_id,
    submissionHash: new Uint8Array(inner.submission_hash),
    walFunds: BigInt(inner.wal_funds),
  };
  return finding;
};
