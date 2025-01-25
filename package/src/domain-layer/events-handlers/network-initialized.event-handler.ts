import { EventsHandler, IEventHandler } from '@easylayer/components/cqrs';
import { AppLogger, RuntimeTracker } from '@easylayer/components/logger';
import { BitcoinNetworkInitializedEvent } from '@easylayer/common/domain-cqrs-components/bitcoin';

@EventsHandler(BitcoinNetworkInitializedEvent)
export class BitcoinNetworkInitializedEventHandler implements IEventHandler<BitcoinNetworkInitializedEvent> {
  constructor(private readonly log: AppLogger) {}

  @RuntimeTracker({ showMemory: false })
  async handle() {
    this.log.debug('Network initialized', null, this.constructor.name);
  }
}
