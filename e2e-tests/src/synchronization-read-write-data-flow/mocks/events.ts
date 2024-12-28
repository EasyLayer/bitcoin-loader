import { mockBlocks } from './blocks';

export const mockLoaderEvent = [
  {
    aggregateId: 'loader',
    extra: null,
    version: 1,
    requestId: '6ce40d38-1c93-4dbb-bf63-27f584665682',
    type: 'BitcoinLoaderInitializedEvent',
    payload: '{"status":"awaiting","indexedHeight":"-1"}',
  },
  {
    aggregateId: 'loader',
    extra: null,
    version: 2,
    requestId: 'd9c860a3-1dfe-47a4-84a3-fbd686d11bad',
    type: 'BitcoinLoaderBlocksIndexedEvent',
    payload: JSON.stringify({
      status: 'awaiting',
      blocks: [mockBlocks[0], mockBlocks[1]],
      indexedHeight: '1',
    }),
  },
  {
    aggregateId: 'loader',
    extra: null,
    version: 3,
    requestId: 'b0214dca-e944-4009-a3b9-4c8f14df620f',
    type: 'BitcoinLoaderBlocksIndexedEvent',
    payload: JSON.stringify({
      status: 'awaiting',
      blocks: [mockBlocks[2]],
      indexedHeight: '2',
    }),
  },
];
