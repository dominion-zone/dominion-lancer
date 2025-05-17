import { MoveStruct, ObjectOwner, SuiClient } from "@mysten/sui/client";
import { Config } from "~/stores/config";

export type BugBounty = {
  id: string;
  ownerCapId: string;
  packageId: string;
  name: string;
  isActive: boolean;
  approves: string[];
  owner: string | null;
};

const parseBugBounty = async ({
  client,
  id,
  fields,
}: {
  client: SuiClient;
  id: string;
  fields: MoveStruct;
}) => {
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
    approves: {
      fields: {
        id: {
          id: string;
        };
      };
    };
    is_active: boolean;
    name: string;
    owner_cap_id: string;
    package_id: string;
  };
  const approves = await client.getDynamicFields({
    parentId: inner.approves.fields.id.id,
  });
  const ownerCap = await client.getObject({
    id: inner.owner_cap_id,
    options: {
      showOwner: true,
    },
  });

  return {
    id,
    ownerCapId: inner.owner_cap_id,
    packageId: inner.package_id,
    name: inner.name,
    isActive: inner.is_active,
    approves: approves.data.map(
      (approve) => (approve.name.value as { name: string }).name
    ),
    owner:
      (ownerCap.data!.owner as { AddressOwner?: string }).AddressOwner ?? null,
  };
};

export const getAllBugBountyIds = async ({
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
        MoveEventType: `${config.lancer.typeOrigins.bugBounty.BugBountyCreatedEvent}::bug_bounty::BugBountyCreatedEvent`,
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
          ).parsedJson.bug_bounty_id as string
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

export const getUserBugBountyIds = async ({
  config,
  client,
  user,
}: {
  config: Config;
  client: SuiClient;
  user: string;
}) => {
  const ids: string[] = [];
  let cursor = null;
  for (;;) {
    const page = await client.getOwnedObjects({
      owner: user,
      filter: {
        StructType: `${config.lancer.typeOrigins.bugBounty.OwnerCap}::bug_bounty::OwnerCap`,
      },
      cursor,
      options: {
        showContent: true,
      },
    });
    ids.push(
      ...page.data.map(
        (obj) =>
          (
            (obj.data!.content as { fields: MoveStruct }).fields as {
              bug_bounty_id: string;
            }
          ).bug_bounty_id
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

export const getBugBounty = async ({
  client,
  id,
}: {
  client: SuiClient;
  id: string;
}): Promise<BugBounty> => {
  const outer = await client.getObject({
    id,
    options: {
      showContent: true,
    },
  });
  return await parseBugBounty({
    id,
    fields: (outer.data?.content as { fields: MoveStruct }).fields,
    client,
  });
};

export const getBugBounties = async ({
  client,
  ids,
}: {
  client: SuiClient;
  ids: string[];
}): Promise<BugBounty[]> => {
  const outers = await client.multiGetObjects({
    ids,
    options: {
      showContent: true,
    },
  });
  return await Promise.all(
    ids.map((id, i) =>
      parseBugBounty({
        id,
        client,
        fields: (outers[i].data?.content as { fields: MoveStruct }).fields,
      })
    ).filter((p) => p) as Promise<BugBounty>[]
  );
};
