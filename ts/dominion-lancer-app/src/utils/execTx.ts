import { GetTransactionBlockParams, SuiClient } from "@mysten/sui/client";
import { signAndExecuteTransaction } from "@mysten/wallet-standard";
import { SuiWallet } from "~/contexts";

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
    throw new Error(r.errors.join(", "));
  }
  return r;
};

export default execTx;
