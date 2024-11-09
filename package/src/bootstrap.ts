import 'reflect-metadata';
import { resolve } from 'node:path';
import { config } from 'dotenv';
import { Observable } from 'rxjs';
import { NestFactory } from '@nestjs/core';
import { DynamicModule, INestApplication, INestApplicationContext } from '@nestjs/common';
import { NestLogger } from '@easylayer/components/logger';
import { CqrsModule, CustomEventBus, ofType } from '@easylayer/components/cqrs';
import { BitcoinLoaderModule } from './loader.module';
import { AppConfig } from './config';
import { MapperType, EntitySchema } from './protocol';
import { setupSwaggerServer } from './scripts/setup-swagger';

interface BootstrapOptions {
  appName?: string;
  schemas: EntitySchema[];
  mapper: MapperType;
  isServer?: boolean;
  testing?: TestingOptions; // Grouped testing options into one interface
}

interface TestingOptions {
  sagaEventsToWait?: EventWaiter[];
  handlerEventsToWait?: EventWaiter[];
}

interface EventWaiter<T = any> {
  eventType: new (...args: any[]) => T;
  count: number;
}

export const bootstrap = async ({
  appName = 'bitcoin-loader',
  schemas,
  mapper,
  isServer = false,
  testing = {},
}: BootstrapOptions) => {
  // IMPORTANT: we use dotenv here to load envs globally.
  // It has to be before importing all plugins.
  config({ path: resolve(process.cwd(), '.env') });

  const nestLogger = new NestLogger();

  try {
    const rootModule = await BitcoinLoaderModule.register({
      appName,
      schemas,
      mapper,
    });

    const app = isServer
      ? await startHttpServer(appName, rootModule, nestLogger)
      : await initializeApplicationContext(rootModule, nestLogger);

    const appConfig = app.get(AppConfig);

    // Handle event waiting logic in testing environments
    if (appConfig.isTEST() && (!!testing.sagaEventsToWait || !!testing.handlerEventsToWait)) {
      await handleTestEventProcessing(app, testing);
    }
  } catch (error) {
    nestLogger.error(`Bootstrap failed: ${error}`);
    process.exit(1);
  }
};

const startHttpServer = async (appName: string, rootModule: DynamicModule, nestLogger: NestLogger) => {
  const app = await NestFactory.create(rootModule, { logger: nestLogger });
  const appConfig = app.get(AppConfig);
  const port = appConfig.PORT;

  if (appConfig.isDEVELOPMENT()) {
    setupSwaggerServer(app, {
      title: appName,
      description: 'Description',
    });
  }

  await app.listen(port);
  nestLogger.log(`HTTP server is listening on port ${port}`, 'NestApplication');
  setupGracefulShutdownHandlers(app, nestLogger);

  // Return the app for further use
  return app;
};

const initializeApplicationContext = async (rootModule: DynamicModule, nestLogger: NestLogger) => {
  const appContext = await NestFactory.createApplicationContext(rootModule, { logger: nestLogger });
  await appContext.init();
  setupGracefulShutdownHandlers(appContext, nestLogger);

  // Return the app context for further use
  return appContext;
};

const setupGracefulShutdownHandlers = (app: INestApplicationContext | INestApplication, nestLogger: NestLogger) => {
  process.on('SIGINT', () => gracefulShutdown(app, nestLogger));
  process.on('SIGTERM', () => gracefulShutdown(app, nestLogger));
};

const gracefulShutdown = (app: INestApplication | INestApplicationContext, logger: NestLogger) => {
  logger.log('Graceful shutdown initiated...');

  // IMPORTANT: Let's set the timeout to 0 ms
  // so that the completion occurs after all asynchronous operations.
  setTimeout(async () => {
    try {
      logger.log('Closing application...');
      // TODO: add close databases separatly (in sqlite case clear wal journal)
      // const eventstore = app.get(EventStore);
      await app.close();
    } catch (error) {
      logger.error('Error during shutdown');
      process.exit(1);
    } finally {
      logger.log('Application closed successfully.');
      process.exit(0);
    }
  }, 0);
};

// Handle event waiting for tests (both saga and handler events)
const handleTestEventProcessing = async (app: INestApplicationContext, testing: TestingOptions) => {
  const cqrs: any = app.get<CqrsModule>(CqrsModule);
  const eventBus = cqrs.eventBus;

  const sagaPromises = createEventPromises(eventBus, testing.sagaEventsToWait, createSagaCompletionPromise);
  const handlerPromises = createEventPromises(
    eventBus,
    testing.handlerEventsToWait,
    createEventHandlerCompletionPromise
  );

  await Promise.all([...sagaPromises, ...handlerPromises]);

  // Forcefully close the application after events complete
  await app.close();
};

// Create promises for events (generic for saga and handler events)
const createEventPromises = (
  eventBus: CustomEventBus,
  eventWaiters: EventWaiter[] | undefined,
  promiseFactory: (eventBus: CustomEventBus, eventType: any, expectedCount: number) => Promise<void>
): Promise<void>[] => {
  return eventWaiters?.map(({ eventType, count }) => promiseFactory(eventBus, eventType, count)) || [];
};

// Promise factory for handling event handler completion
const createEventHandlerCompletionPromise = (
  eventBus: CustomEventBus,
  eventType: any,
  expectedCount: number
): Promise<void> => {
  return new Promise<void>((resolve, reject) => {
    if (!(eventBus.eventHandlerCompletionSubject$ instanceof Observable)) {
      return reject(new Error('eventBus.eventHandlerCompletionSubject$ is not Observable'));
    }

    let eventCount = 0;
    eventBus.eventHandlerCompletionSubject$.pipe(ofType(eventType)).subscribe({
      next: () => {
        eventCount++;
        if (eventCount >= expectedCount) {
          resolve();
        }
      },
      error: (err: any) => reject(err),
    });
  });
};

// Promise factory for handling saga completion
const createSagaCompletionPromise = (
  eventBus: CustomEventBus,
  eventType: any,
  expectedCount: number
): Promise<void> => {
  return new Promise<void>((resolve, reject) => {
    if (!(eventBus.sagaCompletionSubject$ instanceof Observable)) {
      return reject(new Error('eventBus.sagaCompletionSubject$ is not Observable'));
    }

    let eventCount = 0;
    eventBus.sagaCompletionSubject$.pipe(ofType(eventType)).subscribe({
      next: () => {
        eventCount++;
        if (eventCount >= expectedCount) {
          resolve();
        }
      },
      error: (err: any) => reject(err),
    });
  });
};
