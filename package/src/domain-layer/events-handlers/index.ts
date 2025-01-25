import { BitcoinNetworkBlocksAddedEventHandler } from './blocks-added.event-handler';
import { BitcoinNetworkReorganisationFinishedEventHandler } from './reorganisation-finished.event-handler';
import { BitcoinNetworkInitializedEventHandler } from './network-initialized.event-handler';

export const EventsHandlers = [
  BitcoinNetworkBlocksAddedEventHandler,
  BitcoinNetworkReorganisationFinishedEventHandler,
  BitcoinNetworkInitializedEventHandler,
];
