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
  const tasks: Promise<string>[] = [];
  for (let i = 0; i < ids.length; i++) {
    const fields = (outers[i].data?.content as { fields: MoveStruct })
      .fields as {
      inner: MoveStruct;
    };
    tasks.push(
      client
        .getDynamicFields({
          parentId: (
            (fields.inner as { fields: MoveStruct }).fields as {
              id: {
                id: string;
              };
            }
          ).id.id,
        })
        .then((fields) => fields.data[0].objectId)
    );
  }
  const inners = await Promise.all(tasks).then((ids) =>
    client.multiGetObjects({
      ids,
      options: {
        showContent: true,
      },
    })
  );
  for (let i = 0; i < ids.length; i++) {
    const fields = (inners[i].data!.content as { fields: MoveStruct })
      .fields as {
      value: {
        fields: {
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
      };
    };
    const approves = await client.getDynamicFields({
      parentId: fields.value.fields.approves.fields.id.id,
    });
    const ownerCap = await client.getObject({
      id: fields.value.fields.owner_cap_id,
      options: {
        showOwner: true,
      },
    });

    bugBounties.push({
      id: ids[i],
      ownerCapId: fields.value.fields.owner_cap_id,
      packageId: fields.value.fields.package_id,
      name: fields.value.fields.name,
      isActive: fields.value.fields.is_active,
      approves: approves.data.map(
        (approve) =>
          (approve.name.value as { name: string}).name
      ),
      owner: (ownerCap.data!.owner as { AddressOwner?: string }).AddressOwner ?? null,
    });
  }

  return bugBounties;
};
