import { resolve } from 'node:path';
import { config } from 'dotenv';
import { bootstrap } from '@easylayer/bitcoin-loader';
import { BitcoinSchemaSynchronisedEvent } from '@easylayer/common/domain-cqrs-components/bitcoin';
import { SQLiteService } from '../+helpers/sqlite/sqlite.service';
import { cleanDataFolder } from '../+helpers/clean-data-folder';
import { BlockSchema } from './blocks';
import { BlocksMapper } from './mapper';
import { BlockSchemaWithIndex, INDEX_NAME } from './blocks-with-index';

describe('/Bitcoin Loader: Synchronisation Schema Flow', () => {
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
    config({ path: resolve(process.cwd(), 'src/synchronization-schema-flow/.env') });

    // Step 1: Launching application with a schema without indexes
    await bootstrap({
      schemas: [BlockSchema],
      mapper: BlocksMapper,
      testing: {
        sagaEventsToWait: [
          {
            eventType: BitcoinSchemaSynchronisedEvent,
            count: 1,
          },
        ],
      },
    });

    // Step 2: Launching application with a schema with indexes for the same database
    await bootstrap({
      schemas: [BlockSchemaWithIndex],
      mapper: BlocksMapper,
      testing: {
        sagaEventsToWait: [
          {
            eventType: BitcoinSchemaSynchronisedEvent,
            count: 1,
          },
        ],
      },
    });
  });

  it('should have new index on blocks table', async () => {
    // Connect to the read database (views)
    dbService = new SQLiteService({ path: resolve(process.cwd(), 'data/loader-views.db') });
    await dbService.connect();

    // Run a query on sqlite_master to check if the index exists
    const indexInfo = await dbService.all(
      `
      SELECT name, tbl_name, sql 
      FROM sqlite_master 
      WHERE type = 'index' AND name = ?;
    `,
      [INDEX_NAME]
    );

    // Check if the index exists
    expect(indexInfo.length).toBe(1);

    const index = indexInfo[0];
    expect(index.tbl_name).toBe('blocks');
    expect(index.name).toBe(INDEX_NAME);
    expect(index.sql).toContain('CREATE INDEX "IDX_PREVIOUSBLOCKHASH" ON "blocks" ("previousblockhash")');
  });
});
