import { generateRepositoryFromSchema, EntitySchema } from '../../protocol';

export interface ISystem {
  id: number;
  last_block_height: number;
}

export const SystemSchema = new EntitySchema<ISystem>({
  name: 'system',
  tableName: 'system',
  columns: {
    id: {
      type: 'integer',
      primary: true,
    },
    last_block_height: {
      type: 'integer',
      nullable: false,
      default: -1,
    },
  },
});

export const SystemsRepository = generateRepositoryFromSchema(SystemSchema);
