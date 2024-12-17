import { BitcoinNetworkBlocksAddedEventHandler } from './blocks-added.event-handler';
import { BitcoinNetworkReorganisationFinishedEventHandler } from './reorganisation-finished.event-handler';

export const EventsHandlers = [BitcoinNetworkBlocksAddedEventHandler, BitcoinNetworkReorganisationFinishedEventHandler];
