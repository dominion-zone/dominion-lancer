import { MoveStruct, SuiClient } from "@mysten/sui/client";
import { SUI_FRAMEWORK_ADDRESS } from "@mysten/sui/utils";
import { Config } from "~/stores/config";

export type Escrow = {
  id: string;
  ownerCapId: string;
  serverId: string;
  balance: bigint;
  isLocked: boolean;
};

export const getOwnedEscrows = async (
  config: Config,
  client: SuiClient,
  user: string
) => {
  const escrows: Escrow[] = [];
  let cursor = null;
  for (;;) {
    const ownerCaps = await client.getOwnedObjects({
      owner: user,
      filter: {
        StructType: `${config.runner.typeOrigins.escrow.OwnerCap}::escrow::OwnerCap<${SUI_FRAMEWORK_ADDRESS}::sui::SUI>`,
      },
      options: {
        showContent: true,
      },
      cursor,
    });

    const ids = [];
    for (const ownerCap of ownerCaps.data) {
      const fields = (ownerCap.data!.content as { fields: MoveStruct })
        .fields as {
        escrow_id: string;
      };
      ids.push(fields.escrow_id as string);
    }

    const raw = await client.multiGetObjects({
      ids,
      options: {
        showContent: true,
      },
    });
    for (const escrow of raw) {
      if (!escrow.data) {
        continue;
      }
      const fields = (escrow.data!.content as { fields: MoveStruct })
        .fields as {
        id: { id: string };
        owner_cap_id: string;
        server_id: string;
        balance: string;
        is_locked: boolean;
      };
      if (fields.server_id === config.runner.server.object) {
        escrows.push({
          id: fields.id.id,
          ownerCapId: fields.owner_cap_id,
          serverId: fields.server_id,
          balance: BigInt(fields.balance),
          isLocked: fields.is_locked,
        });
      }
    }

    if (ownerCaps.hasNextPage) {
      cursor = ownerCaps.nextCursor;
    } else {
      break;
    }
  }
  return escrows;
};
