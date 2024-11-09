import { resolve } from 'node:path';
import { config } from 'dotenv';
import { bootstrap } from '@easylayer/bitcoin-loader';
import { BitcoinLoaderReorganisationFinishedEvent } from '@easylayer/common/domain-cqrs-components/bitcoin-loader';
import { NetworkProviderService } from '@easylayer/components/bitcoin-network-provider';
import { SQLiteService } from '../+helpers/sqlite/sqlite.service';
import { cleanDataFolder } from '../+helpers/clean-data-folder';
import { BlockSchema } from './blocks';
import { BlocksMapper } from './mapper';
import { mockFakeChainBlocks, mockRealChainBlocks } from './mocks/fake-and-real-blockschain';

jest
  .spyOn(NetworkProviderService.prototype, 'getManyBlocksStatsByHeights')
  .mockImplementation(async (heights: (string | number)[]): Promise<any> => {
    return mockFakeChainBlocks
      .filter((block) => heights.includes(block.height))
      .map((block) => ({
        blockhash: block.hash,
        total_size: 1,
        height: block.height,
      }));
  });

// eslint-disable-next-line @typescript-eslint/no-unused-vars
jest.spyOn(NetworkProviderService.prototype, 'getManyBlocksByHashes').mockImplementation(async (hashes, verbosity) => {
  return mockFakeChainBlocks;
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
jest.spyOn(NetworkProviderService.prototype, 'getOneBlockByHeight').mockImplementation(async (height, verbosity) => {
  return mockRealChainBlocks.find((block) => block.height === height);
});

describe('/Bitcoin Loader: Reorganisation Flow', () => {
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
    config({ path: resolve(process.cwd(), 'src/reorganisation-flow/.env') });

    await bootstrap({
      schemas: [BlockSchema],
      mapper: BlocksMapper,
      testing: {
        handlerEventsToWait: [
          {
            eventType: BitcoinLoaderReorganisationFinishedEvent,
            count: 1,
          },
        ],
        sagaEventsToWait: [
          {
            eventType: BitcoinLoaderReorganisationFinishedEvent,
            count: 1,
          },
        ],
      },
    });
  });

  it('should truncate reorganisation blocks from loader aggregate', async () => {
    // Connect to the write database (event store)
    dbService = new SQLiteService({ path: resolve(process.cwd(), 'data/loader-eventstore.db') });
    await dbService.connect();

    // Retrieve all events from the database
    const events = await dbService.all(`SELECT * FROM events`);

    // Filter events for BitcoinLoaderReorganisationFinishedEvent type
    const reorgEvents = events.filter((event) => event.type === BitcoinLoaderReorganisationFinishedEvent.name);

    // Ensure we have at least one event
    expect(reorgEvents.length).toBeGreaterThan(0);

    reorgEvents.forEach((event) => {
      // Parse the payload of the event
      const payload = JSON.parse(event.payload);

      // Find the last height where the blocks match (common blocks)
      const lastMatchingBlockHeight =
        mockRealChainBlocks.findIndex((realBlock, index) => {
          const fakeBlock = mockFakeChainBlocks[index];
          return realBlock.hash !== fakeBlock.hash;
        }) - 1; // Last matching block height (subtract 1 because findIndex returns the first non-matching block)

      // The reorganisation height should match the last height where blocks match
      expect(payload.height).toBe(String(lastMatchingBlockHeight));

      // Get the blocks that need to be reorganised, starting after the last matching block
      // Exclude the last block because it was the one that triggered the reorganisation
      const reorganisationBlocks = mockFakeChainBlocks.slice(
        lastMatchingBlockHeight + 1,
        mockFakeChainBlocks.length - 1,
      );

      // The blocks array should contain the correct blocks for reorganisation
      const reorganisationBlockHashes = reorganisationBlocks.map((block) => block.hash);
      const eventBlockHashes = payload.blocks.map((block: any) => block.hash);

      // Sort both arrays if the order doesn't matter
      const sortedReorganisationBlockHashes = reorganisationBlockHashes.sort();
      const sortedEventBlockHashes = eventBlockHashes.sort();

      // Compare the block hashes, excluding the last block from the fake chain (block with height 4)
      expect(sortedEventBlockHashes).toEqual(sortedReorganisationBlockHashes);
    });
  });

  it('should update correct data into views db after reorganisation', async () => {
    // Connect to the read database (views)
    dbService = new SQLiteService({ path: resolve(process.cwd(), 'data/loader-views.db') });
    await dbService.connect();

    // Fetch blocks with from the database
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

    // Find the last matching block height (last common block)
    const lastMatchingBlockHeight =
      mockRealChainBlocks.findIndex((realBlock, index) => {
        const fakeBlock = mockFakeChainBlocks[index];
        return realBlock.hash !== fakeBlock.hash;
      }) - 1; // Subtract 1 to get the last matching block

    // Get the blocks that were reorganised (those after the last matching block)
    const reorganisationBlocks = mockFakeChainBlocks.slice(lastMatchingBlockHeight + 1, mockFakeChainBlocks.length - 1); // Exclude the last block

    // Extract the hashes of blocks that should be suspended
    const reorganisationBlockHashes = reorganisationBlocks.map((block) => block.hash);

    // Validate that the reorganised blocks have `is_suspended = true`
    reorganisationBlockHashes.forEach((hash) => {
      const blockInDb = blocksWithTransactions.find((block) => block.blockHash === hash);

      // Ensure the block exists in the database
      expect(blockInDb).toBeDefined();

      // Check that the block is marked as suspended
      expect(blockInDb.blockSuspended).toBeTruthy();
    });
  });
});
