import { CommandHandler, ICommandHandler } from '@easylayer/components/cqrs';
import { EventStoreRepository } from '@easylayer/components/eventstore';
import { ProcessReorganisationCommand } from '@easylayer/common/domain-cqrs-components/bitcoin';
import { AppLogger, RuntimeTracker } from '@easylayer/components/logger';
import { Network } from '@easylayer/components/bitcoin-network-state';
import { NetworkModelFactoryService } from '../services';

@CommandHandler(ProcessReorganisationCommand)
export class ProcessReorganisationCommandHandler implements ICommandHandler<ProcessReorganisationCommand> {
  constructor(
    private readonly log: AppLogger,
    private readonly networkModelFactory: NetworkModelFactoryService,
    private readonly eventStore: EventStoreRepository
  ) {}

  @RuntimeTracker({ showMemory: false })
  async execute({ payload }: ProcessReorganisationCommand) {
    try {
      // IMPORTANT: blocks - need to be reorganised (from NetworkModel),
      // height - is height of reorganisation(the last height where the blocks matched)
      const { blocks, height, requestId } = payload;

      const networkModel: Network = await this.networkModelFactory.initModel();

      // IMPORTANT: We could not store transactions in the aggregator, but get them here from the provider,
      // but this will increase the cost, so we store them for now

      await networkModel.finishReorganisation({
        blocks,
        height,
        requestId,
        logger: this.log,
      });

      await this.eventStore.save(networkModel);
    } catch (error) {
      this.log.error('execute()', error, this.constructor.name);
      throw error;
    }
  }
}
