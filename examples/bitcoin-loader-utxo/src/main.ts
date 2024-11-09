import { bootstrap } from '@easylayer/bitcoin-loader';
import { OutputSchema, InputSchema } from './repositories';
import { Mapper } from './mapper';

bootstrap({
  appName: 'easylayer',
  schemas: [OutputSchema, InputSchema],
  mapper: Mapper,
  isServer: true
}).catch((error: Error) => console.error(error));