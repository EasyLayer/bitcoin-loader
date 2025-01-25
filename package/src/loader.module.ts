import { Module, DynamicModule } from '@nestjs/common';
import { transformAndValidate } from 'class-transformer-validator';
import { CqrsModule } from '@easylayer/components/cqrs';
import { CqrsTransportModule } from '@easylayer/components/cqrs-transport';
import { AppLogger, LoggerModule } from '@easylayer/components/logger';
import { ArithmeticService } from '@easylayer/common/arithmetic';
import { BlocksQueueModule } from '@easylayer/components/bitcoin-blocks-queue';
import { EventStoreModule } from '@easylayer/components/eventstore';
import { ReadDatabaseModule } from '@easylayer/components/views-rdbms-db';
import { NetworkProviderModule } from '@easylayer/components/bitcoin-network-provider';
import { LoaderController } from './loader.controller';
import { LoaderService } from './loader.service';
import { NetworkSaga, SchemaSaga } from './application-layer/sagas';
import {
  NetworkCommandFactoryService,
  SchemaCommandFactoryService,
  ReadStateExceptionHandlerService,
  ViewsQueryFactoryService,
} from './application-layer/services';
import { NetworkModelFactoryService, SchemaModelFactoryService } from './domain-layer/services';
import { ViewsReadRepositoryService, ViewsWriteRepositoryService } from './infrastructure-layer/services';
import { CommandHandlers } from './domain-layer/command-handlers';
import { EventsHandlers } from './domain-layer/events-handlers';
import { QueryHandlers } from './infrastructure-layer/query-handlers';
import {
  AppConfig,
  BusinessConfig,
  EventStoreConfig,
  ReadDatabaseConfig,
  BlocksQueueConfig,
  ProvidersConfig,
} from './config';
import { MapperType, EntitySchema, ProtocolWorkerService } from './protocol';
import { SystemSchema } from './infrastructure-layer/view-models';
import { MetricsService } from './metrics.service';

interface LoaderModuleOptions {
  appName: string;
  schemas: EntitySchema[];
  mapper: MapperType;
  //...
}

@Module({})
export class BitcoinLoaderModule {
  static async register({ schemas, mapper }: LoaderModuleOptions): Promise<DynamicModule> {
    const eventstoreConfig = await transformAndValidate(EventStoreConfig, process.env, {
      validator: { whitelist: true },
    });
    const readdatabaseConfig = await transformAndValidate(ReadDatabaseConfig, process.env, {
      validator: { whitelist: true },
    });
    const appConfig = await transformAndValidate(AppConfig, process.env, {
      validator: { whitelist: true },
    });
    const businessConfig = await transformAndValidate(BusinessConfig, process.env, {
      validator: { whitelist: true },
    });
    const blocksQueueConfig = await transformAndValidate(BlocksQueueConfig, process.env, {
      validator: { whitelist: true },
    });
    const providersConfig = await transformAndValidate(ProvidersConfig, process.env, {
      validator: { whitelist: true },
    });

    const queueIteratorBlocksBatchSize =
      businessConfig.BITCOIN_LOADER_ONE_BLOCK_SIZE * businessConfig.BITCOIN_LOADER_PROTOCOL_PROCESSING_WORKERS_COUNT;
    const queueLoaderRequestBlocksBatchSize = businessConfig.BITCOIN_LOADER_ONE_BLOCK_SIZE * 2;
    const maxQueueSize = queueIteratorBlocksBatchSize * 3;
    const minTransferSize = businessConfig.BITCOIN_LOADER_ONE_BLOCK_SIZE - 1;

    return {
      module: BitcoinLoaderModule,
      controllers: [LoaderController],
      imports: [
        LoggerModule.forRoot({ componentName: 'BitcoinLoaderModule' }),
        CqrsTransportModule.forRoot({ isGlobal: true }),
        CqrsModule.forRoot({ isGlobal: true }),
        // IMPORTANT: NetworkProviderModule must be global inside one plugin
        NetworkProviderModule.forRootAsync({
          isGlobal: true,
          quickNodesUrls: providersConfig.BITCOIN_LOADER_NETWORK_PROVIDER_QUICK_NODE_URLS,
          selfNodesUrl: providersConfig.BITCOIN_LOADER_NETWORK_PROVIDER_SELF_NODE_URL,
          responseTimeout: providersConfig.BITCOIN_LOADER_NETWORK_PROVIDER_REQUEST_TIMEOUT,
        }),
        EventStoreModule.forRootAsync({
          name: 'loader-eventstore',
          logging: eventstoreConfig.isLogging(),
          type: eventstoreConfig.BITCOIN_LOADER_EVENTSTORE_DB_TYPE,
          database: eventstoreConfig.BITCOIN_LOADER_EVENTSTORE_DB_NAME,
          ...(eventstoreConfig.BITCOIN_LOADER_EVENTSTORE_DB_HOST && {
            host: eventstoreConfig.BITCOIN_LOADER_EVENTSTORE_DB_HOST,
          }),
          ...(eventstoreConfig.BITCOIN_LOADER_EVENTSTORE_DB_PORT && {
            port: eventstoreConfig.BITCOIN_LOADER_EVENTSTORE_DB_PORT,
          }),
          ...(eventstoreConfig.BITCOIN_LOADER_EVENTSTORE_DB_USERNAME && {
            username: eventstoreConfig.BITCOIN_LOADER_EVENTSTORE_DB_USERNAME,
          }),
          ...(eventstoreConfig.BITCOIN_LOADER_EVENTSTORE_DB_PASSWORD && {
            password: eventstoreConfig.BITCOIN_LOADER_EVENTSTORE_DB_PASSWORD,
          }),
        }),
        ReadDatabaseModule.forRootAsync({
          name: 'loader-views',
          logging: readdatabaseConfig.isLogging(),
          type: readdatabaseConfig.BITCOIN_LOADER_READ_DB_TYPE,
          entities: [SystemSchema, ...schemas],
          database: readdatabaseConfig.BITCOIN_LOADER_READ_DB_NAME,
          ...(readdatabaseConfig.BITCOIN_LOADER_READ_DB_HOST && {
            host: readdatabaseConfig.BITCOIN_LOADER_READ_DB_HOST,
          }),
          ...(readdatabaseConfig.BITCOIN_LOADER_READ_DB_PORT && {
            port: readdatabaseConfig.BITCOIN_LOADER_READ_DB_PORT,
          }),
          ...(readdatabaseConfig.BITCOIN_LOADER_READ_DB_USERNAME && {
            username: readdatabaseConfig.BITCOIN_LOADER_READ_DB_USERNAME,
          }),
          ...(readdatabaseConfig.BITCOIN_LOADER_READ_DB_PASSWORD && {
            password: readdatabaseConfig.BITCOIN_LOADER_READ_DB_PASSWORD,
          }),
        }),
        BlocksQueueModule.forRootAsync({
          isTransportMode: false,
          blocksCommandExecutor: NetworkCommandFactoryService,
          maxBlockHeight: businessConfig.BITCOIN_LOADER_MAX_BLOCK_HEIGHT,
          queueLoaderStrategyName: blocksQueueConfig.BITCOIN_LOADER_BLOCKS_QUEUE_LOADER_STRATEGY_NAME,
          queueLoaderConcurrency: blocksQueueConfig.BITCOIN_LOADER_BLOCKS_QUEUE_LOADER_CONCURRENCY_COUNT,
          queueLoaderRequestBlocksBatchSize,
          queueIteratorBlocksBatchSize,
          maxQueueSize,
          minTransferSize,
          isTest: appConfig.isTEST(),
        }),
      ],
      providers: [
        {
          provide: AppConfig,
          useValue: appConfig,
        },
        {
          provide: BusinessConfig,
          useValue: businessConfig,
        },
        {
          provide: BlocksQueueConfig,
          useValue: blocksQueueConfig,
        },
        {
          provide: EventStoreConfig,
          useValue: eventstoreConfig,
        },
        {
          provide: ReadDatabaseConfig,
          useValue: readdatabaseConfig,
        },
        {
          provide: ProtocolWorkerService,
          useFactory: async (logger, businessConfig) => {
            const mapperInstance = new mapper();
            return new ProtocolWorkerService(logger, businessConfig, mapperInstance.filepath);
          },
          inject: [AppLogger, BusinessConfig],
        },
        MetricsService,
        ViewsReadRepositoryService,
        ViewsWriteRepositoryService,
        ArithmeticService,
        LoaderService,
        NetworkSaga,
        SchemaSaga,
        NetworkCommandFactoryService,
        SchemaCommandFactoryService,
        NetworkModelFactoryService,
        SchemaModelFactoryService,
        ReadStateExceptionHandlerService,
        ViewsQueryFactoryService,
        ...CommandHandlers,
        ...EventsHandlers,
        ...QueryHandlers,
      ],
      exports: [],
    };
  }
}
