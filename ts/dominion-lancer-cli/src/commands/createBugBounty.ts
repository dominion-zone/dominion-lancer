import { Command } from "commander";
import { context } from "../context";
import { Transaction } from "@mysten/sui/transactions";
import { ObjectOwner } from "@mysten/sui/client";

export const installCreateBugBounty = (program: Command) => {
  program
    .command("create-bug-bounty")
    .option("--description <description>", "Description of the bug bounty")
    .option("--contract <contract>", "Contract address of the bug bounty")
    .action(
      async ({
        description,
        contract,
      }: {
        description: string;
        contract: string;
      }) => {
        const { client, wallet, config } = context;
        const tx = new Transaction();

        tx.moveCall({
          typeArguments: [],
          arguments: [tx.pure.string(description), tx.pure.address(contract)],
          package: config.lancer.package,
          module: "bug_bounty",
          function: "create_v1_and_transfer_cap",
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
        const bugBountyId = (
          r.objectChanges!.find((o) => {
            return (
              o.type === "created" &&
              o.objectType.endsWith("::bug_bounty::BugBounty")
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
        console.log(`Bug bounty created: ${bugBountyId}`);
      }
    );
};
