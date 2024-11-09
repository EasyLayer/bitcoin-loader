import { BitcoinLoaderBlocksIndexedEventHandler } from './blocks-indexed.event-handler';
import { BitcoinLoaderReorganisationFinishedEventHandler } from './reorganisation-finished.event-handler';

export const EventsHandlers = [BitcoinLoaderBlocksIndexedEventHandler, BitcoinLoaderReorganisationFinishedEventHandler];
