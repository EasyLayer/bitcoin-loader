import { CommandHandler, ICommandHandler } from '@easylayer/components/cqrs';
import { Transactional, EventStoreRepository } from '@easylayer/components/eventstore';
import { ProcessReorganisationCommand } from '@easylayer/common/domain-cqrs-components/bitcoin';
import { AppLogger, RuntimeTracker } from '@easylayer/components/logger';
import { Network } from '../models/network.model';
import { NetworkModelFactoryService } from '../services';

@CommandHandler(ProcessReorganisationCommand)
export class ProcessReorganisationCommandHandler implements ICommandHandler<ProcessReorganisationCommand> {
  constructor(
    private readonly log: AppLogger,
    private readonly networkModelFactory: NetworkModelFactoryService,
    private readonly eventStore: EventStoreRepository
  ) {}

  @Transactional({ connectionName: 'loader-eventstore' })
  @RuntimeTracker({ showMemory: false })
  async execute({ payload }: ProcessReorganisationCommand) {
    try {
      // IMPORTANT: blocks - need to be reorganised (from NetworkModel),
      // height - is height of reorganisation(the last height where the blocks matched)
      const { blocks, height, requestId } = payload;

      const networkModel: Network = await this.networkModelFactory.initModel();

      // IMPORTANT: We could not store transactions in the aggregator, but get them here from the provider,
      // but this will increase the cost, so we store them for now

      await networkModel.processReorganisation({
        blocks,
        height,
        requestId,
        logger: this.log,
      });

      await this.eventStore.save(networkModel);

      this.networkModelFactory.updateCache(networkModel);

      await networkModel.commit();
    } catch (error) {
      this.log.error('execute()', error, this.constructor.name);
      this.networkModelFactory.clearCache();
      throw error;
    }
  }
}
