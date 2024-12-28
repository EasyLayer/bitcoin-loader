import { v4 as uuidv4 } from 'uuid';
import { Injectable, Inject } from '@nestjs/common';
import { Observable } from 'rxjs';
import { Saga, ICommand, executeWithRetry } from '@easylayer/components/cqrs';
import { BlocksQueueService } from '@easylayer/components/bitcoin-blocks-queue';
import {
  BitcoinNetworkInitializedEvent,
  BitcoinNetworkReorganisationStartedEvent,
  BitcoinNetworkReorganisationFinishedEvent,
  BitcoinSchemaSynchronisedEvent,
} from '@easylayer/common/domain-cqrs-components/bitcoin';
import { NetworkCommandFactoryService } from '../services';

@Injectable()
export class NetworkSaga {
  constructor(
    private readonly networkCommandFactory: NetworkCommandFactoryService,
    @Inject('BlocksQueueService') private readonly blocksQueueService: BlocksQueueService
  ) {}

  @Saga()
  onBitcoinSchemaSynchronisedEvent(events$: Observable<any>): Observable<ICommand> {
    return events$.pipe(
      executeWithRetry({
        event: BitcoinSchemaSynchronisedEvent,
        command: ({ payload }: BitcoinSchemaSynchronisedEvent) =>
          this.networkCommandFactory.init({
            // IMPORTANT: In this case we can use the same requestId
            // since it came from another aggregate (in case of same aggregate we would have to create a new one)
            requestId: payload.requestId,
          }),
      })
    );
  }

  @Saga()
  onBitcoinNetworkInitializedEvent(events$: Observable<any>): Observable<ICommand> {
    return events$.pipe(
      executeWithRetry({
        event: BitcoinNetworkInitializedEvent,
        command: ({ payload }: BitcoinNetworkInitializedEvent) => this.blocksQueueService.start(payload.indexedHeight),
      })
    );
  }

  @Saga()
  onBitcoinNetworkReorganisationStartedEvent(events$: Observable<any>): Observable<ICommand> {
    return events$.pipe(
      executeWithRetry({
        event: BitcoinNetworkReorganisationStartedEvent,
        command: ({ payload }: BitcoinNetworkReorganisationStartedEvent) =>
          this.networkCommandFactory.processReorganisation({
            blocks: payload.blocks,
            height: payload.height,
            // IMPORTANT: Generate a new requestId here
            // since the reorganisation event is triggered automatically recursively.
            requestId: uuidv4(),
          }),
      })
    );
  }

  @Saga()
  onBitcoinNetworkReorganisationFinishedEvent(events$: Observable<any>): Observable<ICommand> {
    return events$.pipe(
      executeWithRetry({
        event: BitcoinNetworkReorganisationFinishedEvent,
        command: ({ payload }: BitcoinNetworkReorganisationFinishedEvent) =>
          this.blocksQueueService.reorganizeBlocks(payload.height),
      })
    );
  }
}
