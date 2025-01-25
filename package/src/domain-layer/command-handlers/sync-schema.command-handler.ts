import { CommandHandler, ICommandHandler } from '@easylayer/components/cqrs';
import { EventStoreRepository } from '@easylayer/components/eventstore';
import { SyncSchemaCommand } from '@easylayer/common/domain-cqrs-components/bitcoin';
import { AppLogger } from '@easylayer/components/logger';
import { InjectDataSource, DataSource, QueryRunner } from '@easylayer/components/views-rdbms-db';
import { Schema } from '@easylayer/components/bitcoin-network-state';
import { SchemaModelFactoryService } from '../services';
import { ReadDatabaseConfig } from '../../config';

@CommandHandler(SyncSchemaCommand)
export class SyncSchemaCommandHandler implements ICommandHandler<SyncSchemaCommand> {
  constructor(
    private readonly log: AppLogger,
    @InjectDataSource('loader-views')
    private readonly dataSource: DataSource,
    private readonly eventStore: EventStoreRepository,
    private readonly schemaModelFactory: SchemaModelFactoryService,
    private readonly readDatabaseConfig: ReadDatabaseConfig
  ) {}

  async execute({ payload }: SyncSchemaCommand) {
    const viewsQueryRunner: QueryRunner = this.dataSource.createQueryRunner();

    try {
      const { requestId } = payload;

      const schemaModel: Schema = await this.schemaModelFactory.initModel();

      await schemaModel.sync({
        requestId,
        dataSource: this.dataSource,
        queryRunner: viewsQueryRunner,
        logger: this.log,
        isUnlogged: this.readDatabaseConfig.isUnlogged(),
      });

      await this.eventStore.save(schemaModel);
    } catch (error) {
      this.log.error('execute()', error, this.constructor.name);
      await viewsQueryRunner.rollbackTransaction();
      throw error;
    } finally {
      await viewsQueryRunner.release();
    }
  }
}
