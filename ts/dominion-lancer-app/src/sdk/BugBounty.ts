import { MoveStruct, ObjectOwner, SuiClient } from "@mysten/sui/client";

export type BugBounty = {
  id: string;
  ownerCapId: string;
  packageId: string;
  name: string;
  isActive: boolean;
  approves: string[];
  owner: string | null;
};

export const getBugBounties = async (
  client: SuiClient,
  ids: string[]
): Promise<BugBounty[]> => {
  const bugBounties: BugBounty[] = [];
  const outers = await client.multiGetObjects({
    ids,
    options: {
      showContent: true,
    },
  });
  for (let i = 0; i < ids.length; i++) {
    const versioned = (((outers[i].data?.content as { fields: MoveStruct }).fields as {
      inner: MoveStruct;
    }).inner as { fields: MoveStruct }).fields as {
      id: {
        id: string;
      };
      version: string;
    };
    const df = await client.getDynamicFieldObject({
        parentId: versioned.id.id,
        name: { type: 'u64', value: versioned.version },
      });
    const inner = ((df.data!.content as { fields: MoveStruct }).fields as { value: { fields:  MoveStruct }}).value.fields as {
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

    bugBounties.push({
      id: ids[i],
      ownerCapId: inner.owner_cap_id,
      packageId: inner.package_id,
      name: inner.name,
      isActive: inner.is_active,
      approves: approves.data.map(
        (approve) =>
          (approve.name.value as { name: string}).name
      ),
      owner: (ownerCap.data!.owner as { AddressOwner?: string }).AddressOwner ?? null,
    });
  }

  return bugBounties;
};
