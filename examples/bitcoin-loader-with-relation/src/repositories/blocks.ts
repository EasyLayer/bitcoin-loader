import { EntitySchema, generateRepositoryFromSchema } from '@easylayer/bitcoin-loader';
import { ITransaction } from './txs';

export interface IBlock {
  hash: string;
  height: number;
  previousblockhash?: string;
  is_suspended: boolean;
  tx?: ITransaction[];
}

export const BlockSchema = new EntitySchema<IBlock>({
  name: 'blocks',
  tableName: 'blocks',
  columns: {
    hash: {
      type: 'varchar',
      primary: true,
    },
    height: {
      type: 'integer',
    },
    previousblockhash: {
      type: 'varchar',
      nullable: true,
    },
    is_suspended: {
      type: 'boolean',
      default: false,
    },
  },
  relations: {
    tx: {
      type: 'one-to-many',
      target: 'txs',
      inverseSide: 'block',
      cascade: true,
    },
  },
});

export const BlocksRepository = generateRepositoryFromSchema(BlockSchema);