import { Inject } from '@nestjs/common';
import { EventsHandler, IEventHandler } from '@easylayer/components/cqrs';
import { AppLogger, RuntimeTracker } from '@easylayer/components/logger';
import { BlocksQueueService } from '@easylayer/components/bitcoin-blocks-queue';
import { QueryFailedError } from '@easylayer/components/views-rdbms-db';
import { BitcoinNetworkBlocksAddedEvent } from '@easylayer/common/domain-cqrs-components/bitcoin';
import { ViewsWriteRepositoryService } from '../../infrastructure-layer/services';
import { ProtocolWorkerService } from '../../protocol';
import { SystemsRepository } from '../../infrastructure-layer/view-models';
import { MetricsService } from '../../metrics.service';

@EventsHandler(BitcoinNetworkBlocksAddedEvent)
export class BitcoinNetworkBlocksAddedEventHandler implements IEventHandler<BitcoinNetworkBlocksAddedEvent> {
  constructor(
    private readonly log: AppLogger,
    private readonly viewsWriteRepository: ViewsWriteRepositoryService,
    @Inject('BlocksQueueService')
    private readonly blocksQueueService: BlocksQueueService,
    private readonly protocolWorkerService: ProtocolWorkerService,
    private readonly metricsService: MetricsService
  ) {}

  @RuntimeTracker({ showMemory: false })
  async handle({ payload }: BitcoinNetworkBlocksAddedEvent) {
    try {
      const { blocks } = payload;

      this.metricsService.startMetric('confirmblock_time');
      const confirmedBlocks = await this.blocksQueueService.confirmProcessedBatch(
        blocks.map((block: any) => block.hash)
      );
      this.metricsService.sumMetric('confirmblock_time');

      this.metricsService.startMetric('protocol_time');
      const operations = await this.protocolWorkerService.calculateOnLoadOperations(confirmedBlocks);
      this.metricsService.sumMetric('protocol_time');
      operations.forEach((item: any) => {
        const { entityName, method, params } = item;
        this.viewsWriteRepository.addOperation(entityName, method, params);
      });

      // Update System entity
      const lastBlockHeight: number = confirmedBlocks[confirmedBlocks.length - 1].height;

      const systemsRepo = new SystemsRepository();
      systemsRepo.update({ id: 1 }, { last_block_height: lastBlockHeight });

      this.viewsWriteRepository.process([systemsRepo]);

      this.metricsService.startMetric('commit_time');
      await this.viewsWriteRepository.commit();
      this.metricsService.sumMetric('commit_time');

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
        // confirmblock_time: this.metricsService.getMetric('confirmblock_time'),
        // protocol_time: this.metricsService.getMetric('protocol_time'),
        // commit_time: this.metricsService.getMetric('commit_time'),
        confirmblock_total_time: this.metricsService.getMetric('confirmblock_time'),
        protocol_total_time: this.metricsService.getMetric('protocol_time'),
        commit_total_time: this.metricsService.getMetric('commit_time'),
      };

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
