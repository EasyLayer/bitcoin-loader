import { resolve } from 'node:path';
import { config } from 'dotenv';
import { bootstrap } from '@easylayer/bitcoin-loader';
import { BitcoinNetworkInitializedEvent } from '@easylayer/common/domain-cqrs-components/bitcoin';
import { SQLiteService } from '../+helpers/sqlite/sqlite.service';
import { cleanDataFolder } from '../+helpers/clean-data-folder';
import { BlockSchema } from './blocks';
import BlocksMapper from './mapper';

jest.mock('piscina');

describe('/Bitcoin Loader: Second Initializaton Flow', () => {
  let dbService!: SQLiteService;

  afterAll(async () => {
    jest.useRealTimers();
    if (dbService) {
      try {
        await dbService.close();
      } catch (error) {
        console.error(error);
      }
    }
  });

  beforeAll(async () => {
    jest.useFakeTimers({ advanceTimers: true });

    // Clear the database
    await cleanDataFolder('data');

    // Load environment variables
    config({ path: resolve(process.cwd(), 'src/second-init-flow/.env') });

    await bootstrap({
      schemas: [BlockSchema],
      mapper: BlocksMapper,
      testing: {
        handlerEventsToWait: [
          {
            eventType: BitcoinNetworkInitializedEvent,
            count: 1,
          },
        ],
      },
    });

    jest.runAllTimers();
  });

  afterEach(async () => {
    jest.clearAllMocks();
  });

  it('should make correct migration for schema', async () => {
    // TODO
  });

  it('Should init network with correct height', async () => {
    // TODO
  });
});
