import { Module, DynamicModule } from '@nestjs/common';
import { transformAndValidate } from 'class-transformer-validator';
import { CqrsModule } from '@easylayer/components/cqrs';
import { CqrsTransportModule } from '@easylayer/components/cqrs-transport';
import { LoggerModule } from '@easylayer/components/logger';
import { ArithmeticService } from '@easylayer/common/arithmetic';
import { BlocksQueueModule } from '@easylayer/components/bitcoin-blocks-queue';
import { EventStoreModule } from '@easylayer/components/eventstore';
import { ReadDatabaseModule } from '@easylayer/components/views-rdbms-db';
import { NetworkProviderModule } from '@easylayer/components/bitcoin-network-provider';
import { LoaderController } from './loader.controller';
import { LoaderService } from './loader.service';
import { NetworkSaga, SchemaSaga } from './application-layer/sagas';
import {
  BlocksCommandFactoryService,
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
import { MapperType, EntitySchema } from './protocol';
import { SystemSchema } from './infrastructure-layer/view-models';

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
          maxRequestContentLength: providersConfig.BITCOIN_LOADER_NETWORK_PROVIDER_MAX_REQUEST_CONTENT_LENGTH,
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
          blocksCommandExecutor: BlocksCommandFactoryService,
          maxBlockHeight: businessConfig.BITCOIN_LOADER_MAX_BLOCK_HEIGHT,
          queueLoaderRequestBlocksBatchSize:
            blocksQueueConfig.BITCOIN_LOADER_BLOCKS_QUEUE_LOADER_REQUEST_BLOCKS_BATCH_SIZE,
          maxQueueSize: blocksQueueConfig.BITCOIN_LOADER_BLOCKS_QUEUE_MAX_SIZE,
          minTransferSize: blocksQueueConfig.BITCOIN_LOADER_BLOCKS_QUEUE_MIN_TRANSFER_SIZE,
          queueLoaderStrategyName: blocksQueueConfig.BITCOIN_LOADER_BLOCKS_QUEUE_LOADER_STRATEGY_NAME,
          queueIteratorBlocksBatchSize: blocksQueueConfig.BITCOIN_LOADER_BLOCKS_QUEUE_ITERATOR_BLOCKS_BATCH_SIZE,
          queueLoaderConcurrency: blocksQueueConfig.BITCOIN_LOADER_BLOCKS_QUEUE_LOADER_CONCURRENCY_COUNT,
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
          provide: 'LoaderMapper',
          useClass: mapper,
        },
        ViewsReadRepositoryService,
        ViewsWriteRepositoryService,
        ArithmeticService,
        LoaderService,
        NetworkSaga,
        SchemaSaga,
        BlocksCommandFactoryService,
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
