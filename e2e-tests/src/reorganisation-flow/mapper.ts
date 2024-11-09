import { ILoaderMapper } from '@easylayer/bitcoin-loader';
import { BlocksRepository } from './blocks';

export class BlocksMapper implements ILoaderMapper {
  public async onLoad(block: any) {
    const { height, hash, previousblockhash, tx } = block;

    const repo = new BlocksRepository();

    repo.insert({
      hash,
      height: Number(height),
      previousblockhash: previousblockhash ? previousblockhash : '000000000000000000',
      tx: tx.map((t: any) => t.txid),
    });

    return repo;
  }

  public async onReorganisation(lightBlock: any) {
    const { hash } = lightBlock;

    const repo = new BlocksRepository();

    repo.update({ hash }, { is_suspended: true });

    return repo;
  }
}
