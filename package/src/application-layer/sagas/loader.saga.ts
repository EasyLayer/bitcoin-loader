import { v4 as uuidv4 } from 'uuid';
import { Injectable, Inject } from '@nestjs/common';
import { Observable } from 'rxjs';
import { Saga, ICommand, executeWithRetry } from '@easylayer/components/cqrs';
import { BlocksQueueService } from '@easylayer/components/bitcoin-blocks-queue';
import {
  BitcoinNetworkInitializedEvent,
  BitcoinNetworkReorganisationStartedEvent,
  BitcoinNetworkReorganisationFinishedEvent,
} from '@easylayer/common/domain-cqrs-components/bitcoin';
import { LoaderCommandFactoryService } from '../services';

@Injectable()
export class LoaderSaga {
  constructor(
    private readonly loaderCommandFactory: LoaderCommandFactoryService,
    @Inject('BlocksQueueService') private readonly blocksQueueService: BlocksQueueService
  ) {}

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
          this.loaderCommandFactory.processReorganisation({
            blocks: payload.blocks,
            height: payload.height,
            // IMPORTANT: Generate a new requestId here
            // since the reorganisation event is triggered automatically recursively.
            requestId: uuidv4(),
          }),
      })
    );
  }

  // @Saga()
  // onBitcoinBalancesIndexerReorganisationProcessedEvent(events$: Observable<any>): Observable<ICommand> {
  //   return events$.pipe(
  //     executeWithRetry({
  //       event: BitcoinBalancesIndexerReorganisationProcessedEvent,
  //       command: ({ payload }: BitcoinBalancesIndexerReorganisationProcessedEvent) =>
  //         this.loaderCommandFactory.processReorganisation({
  //           blocks: payload.blocks,
  //           height: payload.height,
  //           // IMPORTANT: Generate a new requestId here
  //           // since the reorganisation event is triggered automatically recursively.
  //           requestId: uuidv4(),
  //         }),
  //     })
  //   );
  // }

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
