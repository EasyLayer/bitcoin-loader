import { v4 as uuidv4 } from 'uuid';
import { Injectable } from '@nestjs/common';
import { Observable } from 'rxjs';
import { Saga, ICommand, executeWithRetry } from '@easylayer/components/cqrs';
import { BitcoinSchemaUpdatedEvent } from '@easylayer/common/domain-cqrs-components/bitcoin';
import { SchemaCommandFactoryService } from '../services';

@Injectable()
export class SchemaSaga {
  constructor(private readonly schemaCommandFactory: SchemaCommandFactoryService) {}

  @Saga()
  onBitcoinSchemaUpdatedEvent(events$: Observable<any>): Observable<ICommand> {
    return events$.pipe(
      executeWithRetry({
        event: BitcoinSchemaUpdatedEvent,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        command: ({ payload }: BitcoinSchemaUpdatedEvent) =>
          this.schemaCommandFactory.sync({
            requestId: uuidv4(),
          }),
      })
    );
  }
}
