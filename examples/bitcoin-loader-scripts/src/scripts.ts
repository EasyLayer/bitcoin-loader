import { EntitySchema, generateRepositoryFromSchema } from '@easylayer/bitcoin-loader';

const isPostgres = process.env.BITCOIN_LOADER_READ_DB_TYPE === 'postgres';

export const ScriptSchema = new EntitySchema({
  name: 'scripts',
  tableName: 'scripts',
  columns: {
    txid: {
      type: 'varchar',
      primary: true,
      nullable: false,
    },
    block_height: {
      type: 'integer',
      nullable: false,
    },
    script: {
      type: isPostgres ? 'jsonb' : 'simple-json',
      nullable: false,
    },
    n: {
      type: 'integer',
      primary: true,
      nullable: false,
    },
    is_suspended: {
      type: 'boolean',
      default: false,
    },
  },
});

export const ScriptsRepository = generateRepositoryFromSchema(ScriptSchema);