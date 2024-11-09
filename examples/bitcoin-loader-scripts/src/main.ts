import { bootstrap } from '@easylayer/bitcoin-loader';
import { ScriptSchema } from './scripts';
import { Mapper } from './mapper';

bootstrap({
  appName: 'easylayer',
  schemas: [ScriptSchema],
  mapper: Mapper,
  isServer: true
}).catch((error: Error) => console.error(error));