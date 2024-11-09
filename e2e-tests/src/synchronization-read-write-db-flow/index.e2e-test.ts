import { resolve } from 'node:path';
import { config } from 'dotenv';
import { bootstrap } from '@easylayer/bitcoin-loader';
import { BitcoinLoaderInitializedEvent } from '@easylayer/common/domain-cqrs-components/bitcoin-loader';
import { NetworkProviderService } from '@easylayer/components/bitcoin-network-provider';
import { SQLiteService } from '../+helpers/sqlite/sqlite.service';
import { cleanDataFolder } from '../+helpers/clean-data-folder';
import { BlockSchema } from './blocks';
import { BlocksMapper } from './mapper';
import { mockLoaderEvent } from './mocks/events';
import { mockBlocks } from './mocks/blocks';

// Mock the NetworkProviderService to return mockBlocks when getManyBlocksByHashes is called
// eslint-disable-next-line @typescript-eslint/no-unused-vars
jest.spyOn(NetworkProviderService.prototype, 'getManyBlocksByHashes').mockImplementation(async (hashes, verbosity) => {
  return mockBlocks;
});

describe('/Bitcoin Loader: Synchronization of Read and Write Databases', () => {
  let writeDbService!: SQLiteService;
  let readDbService!: SQLiteService;

  afterAll(async () => {
    // Close the write database connection if it exists
    if (writeDbService) {
      try {
        await writeDbService.close();
      } catch (error) {
        console.error(error);
      }
    }
    // Close the read database connection if it exists
    if (readDbService) {
      try {
        await readDbService.close();
      } catch (error) {
        console.error(error);
      }
    }
  });

  beforeAll(async () => {
    // Use fake timers to control time-based functions in tests
    jest.useFakeTimers({ advanceTimers: true });

    // Clean the data folder to ensure a fresh start for tests
    await cleanDataFolder('data');

    // Load environment variables from the specified .env file
    config({ path: resolve(process.cwd(), 'src/synchronization-read-write-db-flow/.env') });

    // Initialize the write database
    writeDbService = new SQLiteService({ path: resolve(process.cwd(), 'data/loader-eventstore.db') });
    await writeDbService.initializeDatabase(resolve(process.cwd(), 'src/+dumps/events-table.sql'));

    // Insert events into the write database
    for (const event of mockLoaderEvent) {
      const { aggregateId, extra, version, requestId, type, payload } = event;

      const eventValues = [
        `'${aggregateId}'`,
        extra ? `'${extra}'` : 'NULL',
        version,
        requestId ? `'${requestId}'` : 'NULL',
        `'${type}'`,
        `'${payload}'`,
      ];

      const query = `INSERT INTO events (aggregateId, extra, version, requestId, type, payload) VALUES (${eventValues.join(
        ', ',
      )});`;

      await writeDbService.exec(query);
    }

    // Close the write database connection after inserting events
    await writeDbService.close();

    // Initialize the read database
    readDbService = new SQLiteService({ path: resolve(process.cwd(), 'data/loader-views.db') });
    await readDbService.initializeDatabase(resolve(process.cwd(), 'src/+dumps/views-tables.sql'));

    // Insert a single block into the read database
    const singleBlock = mockBlocks[0]; // Insert the first block
    const blockValues = [
      `'${singleBlock.hash}'`,
      singleBlock.height,
      singleBlock.previousblockhash ? `'${singleBlock.previousblockhash}'` : 'NULL',
      0,
      `'${JSON.stringify(singleBlock.tx)}'`,
    ];

    const insertBlockQuery = `
      INSERT INTO blocks (hash, height, previousblockhash, is_suspended, tx)
      VALUES (${blockValues.join(', ')});
    `;

    await readDbService.exec(insertBlockQuery);

    // Insert a record into the system table with the last block height
    const insertSystemQuery = `
      INSERT INTO system (id, last_block_height)
      VALUES (1, ${singleBlock.height});
    `;
    await readDbService.exec(insertSystemQuery);

    // Close the read database connection after inserting the block and system record
    await readDbService.close();

    // Start the bootstrap process after setting up the databases
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

  it('should truncate model blocks data to read views last height and verify initialization event', async () => {
    // Re-open the write database to verify its contents
    writeDbService = new SQLiteService({ path: resolve(process.cwd(), 'data/loader-eventstore.db') });
    await writeDbService.connect();

    // Retrieve all events from the write database
    const events = await writeDbService.all(`SELECT * FROM events`);
    // Filter events to find all BitcoinLoaderInitializedEvent
    const initEvents = events.filter((event: any) => event.type === BitcoinLoaderInitializedEvent.name);

    // Ensure that at least one BitcoinLoaderInitializedEvent exists
    expect(initEvents.length).toBeGreaterThan(0);

    // Retrieve the last BitcoinLoaderInitializedEvent
    const lastInitEvent = initEvents[initEvents.length - 1];

    // Parse the payload of the initialization event to extract the last indexed height
    const initPayload = JSON.parse(lastInitEvent.payload);
    const initIndexedHeight = parseInt(initPayload.indexedHeight, 10);

    // Re-open the read database to retrieve the last block height from the system table
    readDbService = new SQLiteService({ path: resolve(process.cwd(), 'data/loader-views.db') });
    await readDbService.connect();

    const systemRecords = await readDbService.all(`
      SELECT 
        s.last_block_height AS lastBlockHeight
      FROM 
        system s
      WHERE 
        s.id = 1
    `);

    // Ensure exactly one record exists in the system table
    expect(systemRecords).toHaveLength(1);
    const systemRecord = systemRecords[0];

    const expectedLastBlockHeight = systemRecord.lastBlockHeight;

    // Verify that the initialization event's indexedHeight matches the system's last block height
    expect(initIndexedHeight).toEqual(expectedLastBlockHeight);
  });

  it('should have the correct last block height in the system table', async () => {
    // Re-open the read database to verify the system table
    readDbService = new SQLiteService({ path: resolve(process.cwd(), 'data/loader-views.db') });
    await readDbService.connect();

    const systemRecords = await readDbService.all(`
      SELECT
        s.last_block_height AS lastBlockHeight
      FROM 
        system s
      WHERE 
        s.id = 1
    `);

    // Expect exactly one record in the system table
    expect(systemRecords).toHaveLength(1);
    const systemRecord = systemRecords[0];

    const expectedLastBlockHeight = mockBlocks[0].height;

    // Verify that the last block height in the system table matches the expected value
    expect(systemRecord.lastBlockHeight).toEqual(expectedLastBlockHeight);
  });
});
