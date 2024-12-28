import { resolve } from 'node:path';
import { config } from 'dotenv';
import { bootstrap } from '@easylayer/bitcoin-loader';
import { BitcoinNetworkInitializedEvent } from '@easylayer/common/domain-cqrs-components/bitcoin';
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
            eventType: BitcoinNetworkInitializedEvent,
            count: 1,
          },
        ],
      },
    });
  });

  it('should create new schema aggregate', async () => {
    // Connect to the write database (event store)
    dbService = new SQLiteService({ path: resolve(process.cwd(), 'data/loader-eventstore.db') });
    await dbService.connect();

    // Check if the loader aggregate is created
    const events = await dbService.all(`SELECT * FROM events WHERE aggregateId = 'schema'`);

    expect(events.length).toBe(3);
    expect(events[0].aggregateId).toBe('schema');
    expect(events[0].version).toBe(1);
    expect(events[0].type).toBe('BitcoinSchemaUpMigrationStartedEvent');
    expect(events[2].version).toBe(3);
    expect(events[2].type).toBe('BitcoinSchemaSynchronisedEvent');
  });

  it('should create new network aggregate', async () => {
    // Connect to the write database (event store)
    dbService = new SQLiteService({ path: resolve(process.cwd(), 'data/loader-eventstore.db') });
    await dbService.connect();

    // Check if the loader aggregate is created
    const events = await dbService.all(`SELECT * FROM events WHERE aggregateId = 'network'`);

    expect(events.length).toBe(1);
    expect(events[0].aggregateId).toBe('network');
    expect(events[0].version).toBe(1);
    expect(events[0].type).toBe('BitcoinNetworkInitializedEvent');

    const payload = JSON.parse(events[0].payload);
    expect(payload.status).toBe('awaiting');
  });

  it('should init views system schema', async () => {
    // Connect to the write database (event store)
    dbService = new SQLiteService({ path: resolve(process.cwd(), 'data/loader-views.db') });
    await dbService.connect();

    // Check if the loader aggregate is created
    const events = await dbService.all(`SELECT * FROM system`);

    expect(events[0].last_block_height).toBe(-1);
  });
});
