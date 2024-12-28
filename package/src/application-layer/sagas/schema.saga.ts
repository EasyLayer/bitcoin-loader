import { v4 as uuidv4 } from 'uuid';
import { Injectable } from '@nestjs/common';
import { Observable } from 'rxjs';
import { Saga, ICommand, executeWithRetry } from '@easylayer/components/cqrs';
import {
  BitcoinSchemaUpMigrationStartedEvent,
  BitcoinSchemaUpMigrationFinishedEvent,
} from '@easylayer/common/domain-cqrs-components/bitcoin';
import { SchemaCommandFactoryService } from '../services';

@Injectable()
export class SchemaSaga {
  constructor(private readonly schemaCommandFactory: SchemaCommandFactoryService) {}

  @Saga()
  onBitcoinSchemaUpMigrationStartedEvent(events$: Observable<any>): Observable<ICommand> {
    return events$.pipe(
      executeWithRetry({
        event: BitcoinSchemaUpMigrationStartedEvent,
        command: ({ payload }: BitcoinSchemaUpMigrationStartedEvent) =>
          this.schemaCommandFactory.up({
            upQueries: payload.upQueries,
            // IMPORTANT: Generate a new requestId here
            // since the reorganisation event is triggered automatically recursively.
            requestId: uuidv4(),
          }),
      })
    );
  }

  // IMPORTANT: After migration we try to synchronize the model again,
  // and so on until it is completely synchronized
  @Saga()
  onBitcoinSchemaUpMigrationFinishedEvent(events$: Observable<any>): Observable<ICommand> {
    return events$.pipe(
      executeWithRetry({
        event: BitcoinSchemaUpMigrationFinishedEvent,
        command: ({}: BitcoinSchemaUpMigrationFinishedEvent) =>
          this.schemaCommandFactory.sync({
            // IMPORTANT: Generate a new requestId here
            // since the reorganisation event is triggered automatically recursively.
            requestId: uuidv4(),
          }),
      })
    );
  }
}
