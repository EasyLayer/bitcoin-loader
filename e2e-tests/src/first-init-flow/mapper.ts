import { BaseMapper } from '@easylayer/bitcoin-loader';
import { BlocksRepository } from './blocks';

export default class BlocksMapper extends BaseMapper {
  constructor() {
    super(__filename);
  }

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

  public async onReorganisation() {
    //blocksHashes: string[]
    return {} as any;
  }
}
