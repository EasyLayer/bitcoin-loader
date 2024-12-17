import { CommandHandler, ICommandHandler } from '@easylayer/components/cqrs';
import { Transactional, EventStoreRepository } from '@easylayer/components/eventstore';
import { AddBlocksBatchCommand } from '@easylayer/common/domain-cqrs-components/bitcoin';
import { AppLogger, RuntimeTracker } from '@easylayer/components/logger';
import { NetworkProviderService } from '@easylayer/components/bitcoin-network-provider';
import { Network } from '../models/network.model';
import { NetworkModelFactoryService } from '../services';

@CommandHandler(AddBlocksBatchCommand)
export class AddBlocksBatchCommandHandler implements ICommandHandler<AddBlocksBatchCommand> {
  constructor(
    private readonly log: AppLogger,
    private readonly networkModelFactory: NetworkModelFactoryService,
    private readonly networkProviderService: NetworkProviderService,
    private readonly eventStore: EventStoreRepository
  ) {}

  @Transactional({ connectionName: 'loader-eventstore' })
  @RuntimeTracker({ showMemory: false, warningThresholdMs: 10, errorThresholdMs: 1000 })
  async execute({ payload }: AddBlocksBatchCommand) {
    try {
      const { batch, requestId } = payload;

      const networkModel: Network = await this.networkModelFactory.initModel();

      await networkModel.addBlocks({
        requestId,
        blocks: batch,
        service: this.networkProviderService,
        logger: this.log,
      });

      await this.eventStore.save(networkModel);

      this.networkModelFactory.updateCache(networkModel);

      await networkModel.commit();
      // console.time('CqrsTransportTime');
    } catch (error) {
      this.log.error('execute()', error, this.constructor.name);
      this.networkModelFactory.clearCache();
      throw error;
    }
  }
}
