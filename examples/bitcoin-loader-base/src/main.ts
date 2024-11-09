import { bootstrap } from '@easylayer/bitcoin-loader';
import { BlockSchema } from './blocks';
import { BlocksMapper } from './mapper';

bootstrap({
  appName: 'easylayer',
  schemas: [BlockSchema],
  mapper: BlocksMapper,
  isServer: true
}).catch((error: Error) => console.error(error));