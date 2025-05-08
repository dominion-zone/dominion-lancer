import { GetTransactionBlockParams, SuiClient, SuiTransactionBlockResponse } from "@mysten/sui/client";
import { signAndExecuteTransaction } from "@mysten/wallet-standard";
import { SuiWallet } from "~/contexts";

export class SuiTransactionError extends Error {
  constructor(public result: SuiTransactionBlockResponse) {
    super(result.errors!.join(", "));
    this.name = "SuiTransactionError";
  }
}

const execTx = async ({
  tx,
  wallet,
  user,
  network,
  client,
  options,
}: {
  tx: {
    toJSON: () => Promise<string>;
  };
  wallet: SuiWallet;
  user: string;
  network: string;
  client: SuiClient;
} & Omit<GetTransactionBlockParams, "digest">) => {
  const result = await signAndExecuteTransaction(wallet, {
    transaction: tx,
    account: wallet.accounts.find((w) => w.address === user)!,
    chain: `sui:${network}`,
  });
  const r = await client.waitForTransaction({ digest: result.digest, options });
  if (r.errors) {
    throw new SuiTransactionError(r);
  }
  return r;
};

export default execTx;
