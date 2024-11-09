import { EntitySchema, generateRepositoryFromSchema } from '@easylayer/bitcoin-loader';
import { IBlock } from './blocks';

const isPostgres = process.env.BITCOIN_LOADER_READ_DB_TYPE === 'postgres';

export interface ITransaction {
  txid: string;
  hex: string;
  vin: string;
  vout: string;
  block_hash: string;
  block?: IBlock;
}

export const TransactionSchema = new EntitySchema<ITransaction>({
  name: 'txs',
  tableName: 'txs',
  columns: {
    txid: {
      type: 'varchar',
      primary: true,
    },
    vin: {
      type: isPostgres ? 'jsonb' : 'simple-json',
      nullable: false,
    },
    vout: {
      type: isPostgres ? 'jsonb' : 'simple-json',
      nullable: false,
    },
    block_hash: {
      type: 'varchar',
      nullable: false,
    },
  },
  relations: {
    block: {
      type: 'many-to-one',
      target: 'blocks',
      inverseSide: 'tx',
      joinColumn: {
        name: 'block_hash',
        referencedColumnName: 'hash',
      },
    },
  },
});

export const TransactionsRepository = generateRepositoryFromSchema(TransactionSchema);
