import { EntitySchema, generateRepositoryFromSchema } from '@easylayer/bitcoin-loader';

export const INDEX_NAME = 'IDX_PREVIOUSBLOCKHASH';

export const BlockSchemaWithIndex = new EntitySchema({
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
    tx: {
      type: 'json',
      nullable: false,
    },
  },
  indices: [
    {
      name: INDEX_NAME,
      columns: ['previousblockhash'],
      unique: false,
    },
  ],
});

export const BlocksRepository = generateRepositoryFromSchema(BlockSchemaWithIndex);
