import { ILoaderMapper } from '@easylayer/bitcoin-loader';
import { BlocksRepository, TransactionsRepository } from './repositories';

export class Mapper implements ILoaderMapper {
    public async onLoad(block: any) {
        const { height, hash, previousblockhash, tx } = block;

        const blockRepos: InstanceType<typeof BlocksRepository>[] = [];
        const txsRepos: InstanceType<typeof TransactionsRepository>[] = [];

        if (!tx || tx.length === 0) {
          throw new Error(`Tx length = 0`);
        }

        for (const t of tx) {
            const { txid, vin, vout } = t;
      
            const txsRepo = new TransactionsRepository();
      
            txsRepo.insert({
              txid,
              vin,
              vout,
              block_hash: hash,
            });
      
            txsRepos.push(txsRepo);
        }

        const blockRepo = new BlocksRepository();

        blockRepo.insert({
            hash, 
            height: Number(height),
            previousblockhash: previousblockhash ? previousblockhash : '000000000000000000',
            is_suspended: false
        });
        
        blockRepos.push(blockRepo);

        return [...blockRepos, ...txsRepos];
    }

    public async onReorganisation(lightBlock: any) {
        const { hash } = lightBlock;

        const blockRepo = new BlocksRepository();
    
        blockRepo.update(
            { hash },
            { is_suspended: true },
        );

        return blockRepo;
    }
}