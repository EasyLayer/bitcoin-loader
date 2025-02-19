import { resolve } from 'node:path';
import { config } from 'dotenv';
import { bootstrap } from '@easylayer/bitcoin-loader';
import {
  BitcoinNetworkBlocksAddedEvent,
  BitcoinNetworkInitializedEvent,
} from '@easylayer/common/domain-cqrs-components/bitcoin';
import { NetworkProviderService } from '@easylayer/components/bitcoin-network-provider';
import { SQLiteService } from '../+helpers/sqlite/sqlite.service';
import { cleanDataFolder } from '../+helpers/clean-data-folder';
import { BlockSchema } from './blocks';
import { mockBlocks } from './mocks/blocks';
import BlocksMapper from './mapper';

jest.mock('piscina', () => {
  return jest.fn().mockImplementation(() => ({
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    run: jest.fn().mockImplementation(({ fn, blocks, mapperPath }) => {
      if (fn === 'onLoad') {
        const operations = mockBlocks.map((block) => ({
          entityName: 'blocks',
          method: 'insert',
          params: {
            hash: block.hash,
            height: block.height,
            previousblockhash: block.previousblockhash || '000000000000000000',
            tx: block.tx.map((t: any) => t.txid),
          },
        }));
        return Promise.resolve(operations);
      } else if (fn === 'onReorganisation') {
        return Promise.resolve([]);
      }
      return Promise.resolve([]);
    }),
    destroy: jest.fn().mockResolvedValue(undefined),
  }));
});

jest
  .spyOn(NetworkProviderService.prototype, 'getManyBlocksStatsByHeights')
  .mockImplementation(async (heights: (string | number)[]): Promise<any> => {
    return mockBlocks
      .filter((block) => heights.includes(block.height))
      .map((block) => ({
        blockhash: block.hash,
        total_size: 1,
        height: block.height,
      }));
  });

jest
  .spyOn(NetworkProviderService.prototype, 'getManyBlocksByHashes')
  .mockImplementation(async (hashes: string[]): Promise<any> => {
    return mockBlocks.filter((block) => hashes.includes(block.hash));
  });

describe('/Bitcoin Loader: Load Flow', () => {
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
    config({ path: resolve(process.cwd(), 'src/load-flow/.env') });

    await bootstrap({
      schemas: [BlockSchema],
      mapper: BlocksMapper,
      testing: {
        handlerEventsToWait: [
          {
            eventType: BitcoinNetworkBlocksAddedEvent,
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

  it('should save and verify loader events with correct payload structure', async () => {
    // Connect to the write database (event store)
    dbService = new SQLiteService({ path: resolve(process.cwd(), 'data/loader-eventstore.db') });
    await dbService.connect();

    // Retrieve all events from the database
    const events = await dbService.all(`SELECT * FROM events`);

    // Check that the loader initialization event is saved correctly
    const initEvent = events.find((event) => event.type === BitcoinNetworkInitializedEvent.name);

    // Ensure the initialization event exists
    expect(initEvent).toBeDefined();

    // Verify the aggregateId is always 'network'
    expect(initEvent.aggregateId).toBe('network');

    const initPayload = JSON.parse(initEvent.payload);

    // Verify the status in the payload is 'awaiting'
    expect(initPayload.status).toBe('awaiting');

    // Check the block indexing events (BitcoinNetworkBlocksAddedEvent)
    const blockEvents = events.filter((event) => event.type === BitcoinNetworkBlocksAddedEvent.name);

    // Ensure there are block indexing events
    expect(blockEvents.length).toBeGreaterThan(0);

    blockEvents.forEach((event) => {
      // Verify the aggregateId matches the expected value ('network')
      expect(event.aggregateId).toBe('network');

      const blockPayload = JSON.parse(event.payload);

      // Check that the blocks are present in the payload
      expect(blockPayload.blocks).toBeDefined();

      // Verify that blocks are in array format
      expect(Array.isArray(blockPayload.blocks)).toBe(true);

      blockPayload.blocks.forEach((block: any) => {
        // Verify the block height is defined
        expect(block.height).toBeDefined();

        // Verify the block hash is defined
        expect(block.hash).toBeDefined();

        // Ensure transactions are present in the block
        expect(block.tx).toBeDefined();

        // Check that the block contains transactions
        expect(block.tx.length).toBeGreaterThan(0);
      });
    });
  });

  it('should save correct data into views db and match mock data', async () => {
    // Connect to the read database (views)
    dbService = new SQLiteService({ path: resolve(process.cwd(), 'data/loader-views.db') });
    await dbService.connect();

    // Fetch blocks with their transactions from the database
    const blocksWithTransactions = await dbService.all(`
      SELECT
        b.hash AS blockHash, 
        b.height AS blockHeight,
        b.previousblockhash AS previousBlockHash,
        b.is_suspended AS blockSuspended,
        b.tx AS blockTransactions
      FROM 
        blocks b
    `);

    // Compare blocks fetched from DB with mock blocks
    expect(blocksWithTransactions.length).toBe(3);

    blocksWithTransactions.forEach((block, index) => {
      const mockBlock = mockBlocks[index];

      // Check each block's attributes
      expect(block.blockHash).toBe(mockBlock.hash);
      expect(block.blockHeight).toBe(mockBlock.height);
      expect(block.blockSuspended).toBeFalsy();
    });
  });
});
