import { Command } from "commander";
import { context } from "../context";
import { MoveStruct } from "@mysten/sui/client";
import { deriveDynamicFieldID } from "@mysten/sui/utils";
import { bcs } from "@mysten/sui/bcs";

export const installShow = (program: Command) => {
  program
    .command("show")
    .argument("<id>", "ID of the object to show")
    .action(async (id: string) => {
      const { client, config } = context;
      const object = await client.getObject({
        id,
        options: {
          showContent: true,
          showOwner: true,
          showType: true,
        },
      });
      if (object.error) {
        console.error(object.error);
        return;
      }
      if (
        (object.data!.content! as { type: string }).type ===
        `${config.lancer.typeOrigins.bugBounty.BugBounty}::bug_bounty::BugBounty`
      ) {
        const versioned = (
          (
            (object.data!.content! as { fields: MoveStruct }).fields as {
              inner: MoveStruct;
            }
          ).inner as { fields: MoveStruct }
        ).fields as {
          id: {
            id: string;
          };
          version: string;
        };
        const dfId = deriveDynamicFieldID(
          versioned.id.id,
          "u64",
          bcs.U64.serialize(versioned.version).toBytes()
        );
        console.log(`Dynamic field ID: ${dfId}`);
        const df = await client.getObject({
          id: dfId,
          options: { showContent: true, showOwner: true, showType: true },
        });
        /*
        const df = await client.getDynamicFieldObject({
          parentId: versioned.id.id,
          name: { type: "u64", value: versioned.version },
        });
        */
        console.log(JSON.stringify(df, null, 2));
      } else {
        console.log(JSON.stringify(object, null, 2));
      }
    });
};
