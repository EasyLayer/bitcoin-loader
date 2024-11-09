import { AggregateRoot } from '@easylayer/components/cqrs';
import { AppLogger } from '@easylayer/components/logger';
import {
  NetworkProviderService,
  LightBlock,
  Blockchain,
  restoreChainLinks,
} from '@easylayer/components/bitcoin-network-provider';
import {
  BitcoinLoaderInitializedEvent,
  BitcoinLoaderBlocksIndexedEvent,
  BitcoinLoaderReorganisationStartedEvent,
  BitcoinLoaderReorganisationFinishedEvent,
  BitcoinLoaderReorganisationProcessedEvent,
} from '@easylayer/common/domain-cqrs-components/bitcoin-loader';

enum LoaderStatuses {
  AWAITING = 'awaiting',
  REORGANISATION = 'reorganisation',
}

export class Loader extends AggregateRoot {
  private __maxSize!: number;
  // IMPORTANT: There must be only one Loader Aggregate in the module,
  // so we immediately give it aggregateId by which we can find it.
  public aggregateId: string = 'loader';
  public status: LoaderStatuses = LoaderStatuses.AWAITING;
  public chain: Blockchain;

  constructor({ maxSize }: { maxSize: number }) {
    super();

    this.__maxSize = maxSize;
    // IMPORTANT: 'maxSize' must be NOT LESS than the number of blocks in a single batch when iterating over BlocksQueue.
    // The number of blocks in a batch depends on the block size,
    // so we must take the smallest blocks in the network,
    // and make sure that they fit into a single batch less than the value of 'maxSize' .
    this.chain = new Blockchain({ maxSize });
  }

  protected toJsonPayload(): any {
    return {
      status: this.status,
      // Convert Blockchain to an array of blocks
      chain: this.chain.toArray(),
    };
  }

  protected fromSnapshot(state: any): void {
    this.status = state.status;
    if (state.chain && Array.isArray(state.chain)) {
      this.chain = new Blockchain({ maxSize: this.__maxSize });
      this.chain.fromArray(state.chain);
      // Recovering links in Blockchain
      restoreChainLinks(this.chain.head);
    }

    Object.setPrototypeOf(this, Loader.prototype);
  }

  // IMPORTANT: this method doing two things:
  // 1 - create Loader if it's first creation
  // 2 - truncate chain if chain last height bigger then startHeight
  public async init({
    requestId,
    indexedHeight,
    logger,
  }: {
    requestId: string;
    indexedHeight: number;
    logger: AppLogger;
  }) {
    // IMPORTANT: We always initialize the Loader with the awaiting status,
    // if there was a reorganization status, then it will be processed at the next iteration.
    const status = LoaderStatuses.AWAITING;

    const height =
      this.chain.lastBlockHeight !== undefined
        ? indexedHeight < this.chain.lastBlockHeight
          ? indexedHeight
          : this.chain.lastBlockHeight
        : indexedHeight;

    logger.info(
      'Init Loader Aggregate',
      { writeStateLastHeight: height, readStateLastHeight: indexedHeight },
      this.constructor.name
    );

    await this.apply(
      new BitcoinLoaderInitializedEvent({
        aggregateId: this.aggregateId,
        requestId,
        status,
        indexedHeight: height.toString(),
      })
    );
  }

  public async addBlocks({ blocks, requestId, service }: { blocks: any; requestId: string; service: any }) {
    if (this.status !== LoaderStatuses.AWAITING) {
      throw new Error("addBlocks() Reorganisation hasn't finished yet");
    }

    const isValid = this.chain.validateNextBlocks(blocks);

    if (!isValid) {
      return await this.startReorganisation({
        height: this.chain.lastBlockHeight!,
        requestId,
        service,
        blocks: [],
      });
    }

    return await this.apply(
      new BitcoinLoaderBlocksIndexedEvent({
        aggregateId: this.aggregateId,
        requestId,
        status: LoaderStatuses.AWAITING,
        blocks: blocks.map((block: any) => ({
          ...block,
          tx: block.tx.map((t: any) => t.txid),
        })),
      })
    );
  }

  public async processReorganisation({
    blocks,
    height,
    requestId,
    logger,
  }: {
    blocks: LightBlock[];
    height: string | number;
    requestId: string;
    logger: AppLogger;
  }): Promise<void> {
    if (this.status !== LoaderStatuses.REORGANISATION) {
      throw new Error("processReorganisation() Reorganisation hasn't started yet");
    }

    if (Number(height) > this.chain.lastBlockHeight!) {
      // IMPORTANT: In this case we just skip + we can log this error
      logger.warn(
        "Reorganization height is higher than Loader's blockchain height",
        { reorganisationHeight: height, lastBlockchainHeight: this.chain.lastBlockHeight },
        this.constructor.name
      );
      return;
    }

    // TODO: Task SH-15
    // if (blocks.length > 100) {
    //   const blocksToProcessed = blocks;

    //   return await this.apply(
    //     new BitcoinLoaderReorganisationProcessedEvent({
    //       aggregateId: this.aggregateId,
    //       requestId,
    //       // IMPORTANT: height - height of reorganization (last correct block)
    //       height: height.toString(),
    //       blocks: blocksToProcessed,
    //     })
    //   );
    // }

    return await this.apply(
      new BitcoinLoaderReorganisationFinishedEvent({
        aggregateId: this.aggregateId,
        requestId,
        status: LoaderStatuses.AWAITING,
        // IMPORTANT: height - height of reorganization (last correct block)
        height: height.toString(),
        blocks,
      })
    );
  }

  public async startReorganisation({
    height,
    requestId,
    service,
    blocks,
  }: {
    height: number;
    requestId: string;
    service: NetworkProviderService;
    blocks: any[];
  }): Promise<void> {
    if (this.status !== LoaderStatuses.AWAITING) {
      throw new Error("reorganisation() Previous reorganisation hasn't finished yet");
    }

    const localBlock = this.chain.findBlockByHeight(height)!;
    const oldBlock = await service.getOneBlockByHeight(height);

    if (oldBlock.hash === localBlock.hash && oldBlock.previousblockhash === localBlock.previousblockhash) {
      // Match found

      return await this.apply(
        new BitcoinLoaderReorganisationStartedEvent({
          aggregateId: this.aggregateId,
          requestId,
          status: LoaderStatuses.REORGANISATION,
          // IMPORTANT: height - is height of reorganisation(the last height where the blocks matched)
          height: height.toString(),
          // IMPORTANT: blocks that need to be reorganized
          blocks,
        })
      );
    }

    // Saving blocks for publication in an event
    const newBlocks = [...blocks, localBlock];
    const prevHeight = height - 1;

    // Recursive check the previous block
    return this.startReorganisation({ height: prevHeight, requestId, service, blocks: newBlocks });
  }

  private onBitcoinLoaderInitializedEvent({ payload }: BitcoinLoaderInitializedEvent) {
    const { aggregateId, status, indexedHeight } = payload;
    this.aggregateId = aggregateId;
    this.status = status as LoaderStatuses;

    // IMPORTANT: In cases of blockchain synchronization with the read state,
    // we truncate the model to the precisely processed height.
    this.chain.truncateToBlock(Number(indexedHeight));
  }

  private onBitcoinLoaderBlocksIndexedEvent({ payload }: BitcoinLoaderBlocksIndexedEvent) {
    const { blocks, status } = payload;

    this.status = status as LoaderStatuses;
    this.chain.addBlocks(
      blocks.map((block: any) => ({
        height: Number(block.height),
        hash: block.hash,
        previousblockhash: block?.previousblockhash || '',
        tx: block.tx.map((txid: any) => txid),
      }))
    );
  }

  private onBitcoinLoaderReorganisationStartedEvent({ payload }: BitcoinLoaderReorganisationStartedEvent) {
    const { status } = payload;
    this.status = status as LoaderStatuses;
  }

  // Here we cut full at once in height
  // This method is idempotent
  private onBitcoinLoaderReorganisationFinishedEvent({ payload }: BitcoinLoaderReorganisationFinishedEvent) {
    const { height, status } = payload;
    this.status = status as LoaderStatuses;
    this.chain.truncateToBlock(Number(height));
  }

  // Here we will only cut a few blocks
  // This method is idempotent
  private onBitcoinLoaderReorganisationProcessedEvent({ payload }: BitcoinLoaderReorganisationProcessedEvent) {
    const { blocks } = payload;
    this.chain.truncateToBlock(Number(blocks[0].height));
  }
}
