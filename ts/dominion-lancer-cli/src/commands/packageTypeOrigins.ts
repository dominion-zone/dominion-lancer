import { Command } from "commander";
import { context } from "../context";
import { TypeOrigin, UpgradeInfo } from "@mysten/sui/client";

export const installPackageTypeOrigins = (program: Command) => {
  program
    .command("package-type-origins")
    .argument("id", "Package ID")
    .action(async (id: string) => {
      const { client, wallet, config } = context;
      console.log(id);
      const p = await client.getObject({
        id,
        options: {
          showBcs: true,
        },
      });
      const table: {
        [module: string]: {
          [type: string]: string;
        };
      } = {};
      for (const typeOrigin of (
        p.data?.bcs as {
          dataType: "package";
          id: string;
          linkageTable: {
            [key: string]: UpgradeInfo;
          };
          moduleMap: {
            [key: string]: string;
          };
          typeOriginTable: TypeOrigin[];
          version: string;
        }
      ).typeOriginTable) {
        table[typeOrigin.module_name] = table[typeOrigin.module_name] || {};
        table[typeOrigin.module_name][typeOrigin.datatype_name] =
          typeOrigin.package;
      }

      console.log(table);
    });
};
