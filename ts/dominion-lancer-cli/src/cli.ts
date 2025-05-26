import {Command} from 'commander';
import {readFile} from 'mz/fs';
import expandTilde from 'expand-tilde';
import {SuiClient} from '@mysten/sui/client';
import * as YAML from 'yaml';
import {fromBase64} from '@mysten/sui/utils';
import {Ed25519Keypair} from '@mysten/sui/keypairs/ed25519';
import {setContext} from './context';
import {config, Config, Network} from './config';
import { installCreateBugBounty } from './commands/createBugBounty';
import { installPackageTypeOrigins } from './commands/packageTypeOrigins';
import { installShow } from './commands/show';
import { installCreateEnclaveConfig } from './commands/createEnclaveConfig';

export const cli = () => {
  const program = new Command();

  program
    .version('0.0.1')
    .allowExcessArguments(false)
    .hook('preAction', async () => {
      const suiConfig = YAML.parse(
        await readFile(expandTilde('~/.sui/sui_config/client.yaml'), 'utf8'),
      );
      const env: string = suiConfig.active_env;
      const walletAddress = suiConfig.active_address;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const suiEnvConfig = suiConfig.envs.find((e: any) => e.alias === env);
      const keystore: string[] = JSON.parse(
        await readFile(suiConfig.keystore.File, 'utf8'),
      );
      let wallet;
      for (const key of keystore) {
        const raw = fromBase64(key);
        if (raw[0] !== 0) {
          continue;
        }
        const imported = Ed25519Keypair.fromSecretKey(raw.slice(1));
        if (imported.getPublicKey().toSuiAddress() === walletAddress) {
          wallet = imported;
          break;
        }
      }

      const client = new SuiClient({url: suiEnvConfig.rpc});
      // const config: Record<string, Config> = JSON.parse(await readFile('config.json', 'utf8'));

      setContext({
        config: config[env as Network],
        wallet,
        client,
      });
    });

  installCreateBugBounty(program);
  installPackageTypeOrigins(program);
  installCreateEnclaveConfig(program);
  installShow(program);

  return program;
};
