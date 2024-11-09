import { EntitySchema, generateRepositoryFromSchema } from '@easylayer/bitcoin-loader';

export interface IOutput {
  script_hash: string | null;
  txid: string;           // block.tx[].txid
  n: number;              // block.tx[].vout[].n
  value: string;
  block_height: number;
  is_suspended: boolean;
}

export const OutputSchema = new EntitySchema<IOutput>({
  name: 'outputs',
  tableName: 'outputs',
  columns: {
    script_hash: {
      type: 'varchar',
      nullable: true,
    },
    txid: {
      type: 'varchar',
      primary: true,
      nullable: false,
    },
    n: {
      type: 'integer',
      primary: true,
      nullable: false,
    },
    value: {
      type: 'bigint',
      default: '0',
    },
    block_height: {
      type: 'integer',
      nullable: false,
    },
    is_suspended: {
      type: 'boolean',
      default: false,
    },
  },
});

export const OutputsRepository = generateRepositoryFromSchema(OutputSchema);
  