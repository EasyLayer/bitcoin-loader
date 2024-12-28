import { CommandHandler, ICommandHandler } from '@easylayer/components/cqrs';
import { Transactional, EventStoreRepository } from '@easylayer/components/eventstore';
import { SchemaMigrationUpCommand } from '@easylayer/common/domain-cqrs-components/bitcoin';
import { AppLogger } from '@easylayer/components/logger';
import { InjectDataSource, DataSource } from '@easylayer/components/views-rdbms-db';
import { Schema } from '@easylayer/components/bitcoin-network-state';
import { SchemaModelFactoryService } from '../services';

@CommandHandler(SchemaMigrationUpCommand)
export class SchemaMigrationUpCommandHandler implements ICommandHandler<SchemaMigrationUpCommand> {
  constructor(
    private readonly log: AppLogger,
    @InjectDataSource('loader-views')
    private readonly datasource: DataSource,
    private readonly eventStore: EventStoreRepository,
    private readonly schemaModelFactory: SchemaModelFactoryService
  ) {}

  @Transactional({ connectionName: 'loader-eventstore' })
  async execute({ payload }: SchemaMigrationUpCommand) {
    try {
      const { requestId, upQueries } = payload;

      const schemaModel: Schema = await this.schemaModelFactory.initModel();

      // ISSUE: This method has a flaw;
      // This flow is not fully transactional. We have a potential scenario where the read database has been updated,
      // but the state was not saved to the write database.
      // In this case, we faced problems because updates to the read database are non-idempotent
      // and cannot be invoked a second time.
      // We do not yet know how to determine when to trigger migration for the read database and when not to.

      await schemaModel.up({ requestId, dataSource: this.datasource, upQueries, logger: this.log });

      await this.eventStore.save(schemaModel);
      await schemaModel.commit();

      this.log.info('Schema Migration Up successfully finished', null, this.constructor.name);
    } catch (error) {
      this.log.error('execute()', error, this.constructor.name);
      throw error;
    }
  }
}
