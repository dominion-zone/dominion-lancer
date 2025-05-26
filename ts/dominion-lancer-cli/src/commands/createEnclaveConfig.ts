import { Command } from "commander";
import { context } from "../context";
import { Transaction } from "@mysten/sui/transactions";
import { ObjectOwner } from "@mysten/sui/client";
import { fromHex } from "@mysten/sui/utils";

export const installCreateEnclaveConfig = (program: Command) => {
  program
    .command("create-enclave-config")
    .option("--name <name>", "Name of the enclave")
    .option(
      "--pcr0 <pcr0>",
      "PCR0 value for the enclave",
      "000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"
    )
    .option(
      "--pcr1 <pcr1>",
      "PCR1 value for the enclave",
      "000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"
    )
    .option(
      "--pcr2 <pcr2>",
      "PCR2 value for the enclave",
      "000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"
    )
    .action(
      async ({
        name,
        pcr0,
        pcr1,
        pcr2,
      }: {
        name: string;
        pcr0: string;
        pcr1: string;
        pcr2: string;
      }) => {
        const { client, wallet, config } = context;

        const enclaveCap = await client.getOwnedObjects({
          owner: wallet!.getPublicKey().toSuiAddress(),
          filter: {
            StructType: `${config.nautilus.package}::enclave::Cap`,
          },
        });
        if (enclaveCap.data.length === 0) {
          console.error("No enclave cap found");
          return;
        }

        const tx = new Transaction();

        tx.moveCall({
          package: config.nautilus.package,
          module: "enclave",
          function: "create_enclave_config",
          typeArguments: [
            `${config.lancer.typeOrigins.executor.EXECUTOR}::executor::EXECUTOR`,
          ],
          arguments: [
            tx.object(enclaveCap.data[0].data!.objectId),
            tx.pure.string(name),
            tx.pure.vector("u8", fromHex(pcr0)),
            tx.pure.vector("u8", fromHex(pcr1)),
            tx.pure.vector("u8", fromHex(pcr2)),
          ],
        });

        const result = await client.signAndExecuteTransaction({
          signer: wallet!,
          transaction: tx,
        });
        const r = await client.waitForTransaction({
          digest: result.digest,
          options: {
            showObjectChanges: true,
          },
        });
        if (r.errors) {
          console.log(`Tx ${result.digest} error`);
          console.error(r.errors);
          return;
        }
        const enclaveConfigId = (
          r.objectChanges!.find((o) => {
            return (
              o.type === "created" &&
              o.objectType.includes("::enclave::EnclaveConfig<")
            );
          }) as {
            digest: string;
            objectId: string;
            objectType: string;
            owner: ObjectOwner;
            sender: string;
            type: "created";
            version: string;
          }
        ).objectId;
        console.log(`Enclave config created: ${enclaveConfigId}`);
      }
    );
};
