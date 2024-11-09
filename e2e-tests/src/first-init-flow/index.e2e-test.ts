import { resolve } from 'node:path';
import { config } from 'dotenv';
import { bootstrap } from '@easylayer/bitcoin-loader';
import { BitcoinLoaderInitializedEvent } from '@easylayer/common/domain-cqrs-components/bitcoin-loader';
import { SQLiteService } from '../+helpers/sqlite/sqlite.service';
import { cleanDataFolder } from '../+helpers/clean-data-folder';
import { BlockSchema } from './blocks';
import { BlocksMapper } from './mapper';

describe('/Bitcoin Loader: First Initializaton Flow', () => {
  let dbService!: SQLiteService;

  afterAll(async () => {
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
    config({ path: resolve(process.cwd(), 'src/first-init-flow/.env') });

    await bootstrap({
      schemas: [BlockSchema],
      mapper: BlocksMapper,
      testing: {
        sagaEventsToWait: [
          {
            eventType: BitcoinLoaderInitializedEvent,
            count: 1,
          },
        ],
      },
    });
  });

  it('should create new loader aggregate', async () => {
    // Connect to the write database (event store)
    dbService = new SQLiteService({ path: resolve(process.cwd(), 'data/loader-eventstore.db') });
    await dbService.connect();

    // Check if the loader aggregate is created
    const events = await dbService.all(`SELECT * FROM events WHERE aggregateId = 'loader'`);

    expect(events.length).toBe(1);
    expect(events[0].aggregateId).toBe('loader');
    expect(events[0].version).toBe(1);
    expect(events[0].type).toBe('BitcoinLoaderInitializedEvent');

    const payload = JSON.parse(events[0].payload);
    expect(payload.status).toBe('awaiting');
  });
});
