import { CommandHandler, ICommandHandler } from '@easylayer/components/cqrs';
import { Transactional, EventStoreRepository } from '@easylayer/components/eventstore';
import { SyncSchemaCommand } from '@easylayer/common/domain-cqrs-components/bitcoin';
import { AppLogger } from '@easylayer/components/logger';
import { InjectDataSource, DataSource } from '@easylayer/components/views-rdbms-db';
import { Schema, SchemaStatuses } from '@easylayer/components/bitcoin-network-state';
import { SchemaModelFactoryService } from '../services';
import { ReadDatabaseConfig } from '../../config';

@CommandHandler(SyncSchemaCommand)
export class SyncSchemaCommandHandler implements ICommandHandler<SyncSchemaCommand> {
  constructor(
    private readonly log: AppLogger,
    @InjectDataSource('loader-views')
    private readonly datasource: DataSource,
    private readonly eventStore: EventStoreRepository,
    private readonly schemaModelFactory: SchemaModelFactoryService,
    private readonly readDatabaseConfig: ReadDatabaseConfig
  ) {}

  @Transactional({ connectionName: 'loader-eventstore' })
  async execute({ payload }: SyncSchemaCommand) {
    try {
      const { requestId } = payload;

      const schemaModel: Schema = await this.schemaModelFactory.initModel();

      // IMPORTANT: if synchronization is not finished we publish the old event and exit the command
      // Due to recursion in sagas we will be able to update the following changes if there are any
      if (schemaModel.status === SchemaStatuses.SYNCHRONISING) {
        return await this.schemaModelFactory.publishLastEvent();
      }

      await schemaModel.checkSync({
        requestId,
        dataSource: this.datasource,
        logger: this.log,
        isUnlogged: this.readDatabaseConfig.isUnlogged(),
      });

      await this.eventStore.save(schemaModel);
      await schemaModel.commit();
    } catch (error) {
      this.log.error('execute()', error, this.constructor.name);
      throw error;
    }
  }
}
