import { bootstrap } from '@easylayer/bitcoin-loader';
import { BlockSchema, TransactionSchema } from './repositories';
import { Mapper } from './mapper';

bootstrap({
  appName: 'easylayer',
  schemas: [BlockSchema, TransactionSchema],
  mapper: Mapper,
  isServer: true
}).catch((error: Error) => console.error(error));