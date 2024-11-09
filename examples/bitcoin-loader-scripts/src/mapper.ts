import { ScriptUtilService } from '@easylayer/components/bitcoin-network-provider';
import { ILoaderMapper } from '@easylayer/bitcoin-loader';
import { ScriptsRepository } from './scripts';

export class Mapper implements ILoaderMapper {
    public async onLoad(block: any) {
        const { height, tx } = block;

        const scriptsRepos: InstanceType<typeof ScriptsRepository>[] = [];

        for (const t of tx) {
            const txid = t.txid;
      
            for (const vout of t.vout) {
                const isOPReturn = ScriptUtilService.isOPReturn(vout.scriptPubKey);
      
                if (isOPReturn) {
                    const scriptRepo = new ScriptsRepository();

                    scriptRepo.insert({
                        txid,
                        script: vout.scriptPubKey,
                        n: Number(vout.n),
                        block_height: Number(height),
                    });
              
                    scriptsRepos.push(scriptRepo);
                }
            }
        }

        return scriptsRepos;
    }

    public async onReorganisation(lightBlock: any) {
        const { tx } = lightBlock;

        const scriptsRepos: InstanceType<typeof ScriptsRepository>[] = [];

        for (let txid of tx) {
        const scriptRepo = new ScriptsRepository();

        scriptRepo.update(
            { txid },
            { is_suspended: true },
        );

        scriptsRepos.push(scriptRepo);
        }

        return scriptsRepos;
    }
}