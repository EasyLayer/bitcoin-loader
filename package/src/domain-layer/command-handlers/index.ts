import { AddBlocksBatchCommandHandler } from './add-blocks-batch.command-handler';
import { InitNetworkCommandHandler } from './init-network.command-handler';
import { ProcessReorganisationCommandHandler } from './process-reorganisation.command-handler';
import { SyncSchemaCommandHandler } from './sync-schema.command-handler';
import { SchemaMigrationUpCommandHandler } from './schema-migration-up.command-handler';

export const CommandHandlers = [
  AddBlocksBatchCommandHandler,
  InitNetworkCommandHandler,
  ProcessReorganisationCommandHandler,
  SyncSchemaCommandHandler,
  SchemaMigrationUpCommandHandler,
];
