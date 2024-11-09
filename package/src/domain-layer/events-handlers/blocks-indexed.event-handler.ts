import { Inject } from '@nestjs/common';
import { EventsHandler, IEventHandler } from '@easylayer/components/cqrs';
import { AppLogger, RuntimeTracker } from '@easylayer/components/logger';
import { BlocksQueueService } from '@easylayer/components/bitcoin-blocks-queue';
import { QueryFailedError } from '@easylayer/components/views-rdbms-db';
import { BitcoinLoaderBlocksIndexedEvent } from '@easylayer/common/domain-cqrs-components/bitcoin-loader';
import { ViewsWriteRepositoryService } from '../../infrastructure-layer/services';
import { ILoaderMapper } from '../../protocol';
import { SystemsRepository } from '../../infrastructure-layer/view-models';

@EventsHandler(BitcoinLoaderBlocksIndexedEvent)
export class BitcoinLoaderBlocksIndexedEventHandler implements IEventHandler<BitcoinLoaderBlocksIndexedEvent> {
  constructor(
    private readonly log: AppLogger,
    private readonly viewsWriteRepository: ViewsWriteRepositoryService,
    @Inject('BlocksQueueService')
    private readonly blocksQueueService: BlocksQueueService,
    @Inject('LoaderMapper')
    private readonly loaderMapper: ILoaderMapper
  ) {}

  @RuntimeTracker({ showMemory: false, warningThresholdMs: 10, errorThresholdMs: 1000 })
  async handle({ payload }: BitcoinLoaderBlocksIndexedEvent) {
    try {
      // console.timeEnd('CqrsTransportTime');
      const { blocks } = payload;

      const confirmedBlocks = await this.blocksQueueService.confirmProcessedBatch(
        blocks.map((block: any) => block.hash)
      );

      const stats = {
        blocksHeight: confirmedBlocks[confirmedBlocks.length - 1].height,
        blocksLength: confirmedBlocks.length,
        blocksSize: confirmedBlocks.reduce((result: number, item: any) => (result += item.size), 0) / 1048576,
        txLength: confirmedBlocks.reduce((result: number, item: any) => (result += item.tx.length), 0),
        vinLength: confirmedBlocks.reduce(
          (result: number, block: any) =>
            (result += block.tx.reduce((result: number, tx: any) => (result += tx.vin.length), 0)),
          0
        ),
        voutLength: confirmedBlocks.reduce(
          (result: number, block: any) =>
            (result += block.tx.reduce((result: number, tx: any) => (result += tx.vout.length), 0)),
          0
        ),
      };

      const repositories = [];

      console.time('protocol');
      for (const block of confirmedBlocks) {
        const results = await this.loaderMapper.onLoad(block);
        repositories.push(...(Array.isArray(results) ? results : [results]));
      }
      console.timeEnd('protocol');

      // Update System entity
      const lastBlockHeight: number = confirmedBlocks[confirmedBlocks.length - 1].height;

      const systemsRepo = new SystemsRepository();
      systemsRepo.update({ id: 1 }, { last_block_height: lastBlockHeight });

      repositories.push(systemsRepo);

      this.viewsWriteRepository.process(repositories);

      console.time('commit');
      await this.viewsWriteRepository.commit();
      console.timeEnd('commit');

      this.log.info('Blocks successfull loaded', { ...stats }, this.constructor.name);
    } catch (error) {
      this.viewsWriteRepository.clearOperations();

      if (error instanceof QueryFailedError) {
        const driverError = error.driverError;
        if (driverError.code === 'SQLITE_CONSTRAINT') {
          throw new Error(driverError.message);
        }
        if (driverError.code === '23505') {
          throw new Error(driverError.detail);
        }
      }

      throw error;
    }
  }
}
