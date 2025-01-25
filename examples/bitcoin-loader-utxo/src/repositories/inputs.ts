import { EntitySchema, generateRepositoryFromSchema } from '@easylayer/bitcoin-loader';
import { IOutput } from './outputs';

export interface IInput {
  txid: string;           // block.tx[].txid
  output_txid: string;    // block.tx[].vin[].txid
  output_n: number;
  output: IOutput;
}

export const InputSchema = new EntitySchema<IInput>({
  name: 'inputs',
  tableName: 'inputs',
  columns: {
    txid: {
      type: 'varchar',
      nullable: false,
    },
    output_txid: {
      type: 'varchar',
      primary: true,
      nullable: false,
    },
    output_n: {
      type: 'integer',
      primary: true,
      nullable: false,
    },
  },
  relations: {
    output: {
      type: 'many-to-one',
      target: 'outputs',
      joinColumn: [
        { name: 'output_txid', referencedColumnName: 'txid' },
        { name: 'output_n', referencedColumnName: 'n' },
      ],
    },
  },
});

export const InputsRepository = generateRepositoryFromSchema(InputSchema);

  

