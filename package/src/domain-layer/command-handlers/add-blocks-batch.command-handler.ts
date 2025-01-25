import { CommandHandler, ICommandHandler } from '@easylayer/components/cqrs';
import { EventStoreRepository } from '@easylayer/components/eventstore';
import { AddBlocksBatchCommand } from '@easylayer/common/domain-cqrs-components/bitcoin';
import { AppLogger, RuntimeTracker } from '@easylayer/components/logger';
import { NetworkProviderService } from '@easylayer/components/bitcoin-network-provider';
import { Network } from '@easylayer/components/bitcoin-network-state';
import { NetworkModelFactoryService } from '../services';

@CommandHandler(AddBlocksBatchCommand)
export class AddBlocksBatchCommandHandler implements ICommandHandler<AddBlocksBatchCommand> {
  constructor(
    private readonly log: AppLogger,
    private readonly networkModelFactory: NetworkModelFactoryService,
    private readonly networkProviderService: NetworkProviderService,
    private readonly eventStore: EventStoreRepository
  ) {}

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
    } catch (error) {
      this.log.error('execute()', error, this.constructor.name);
      throw error;
    }
  }
}
