import { CommandHandler, ICommandHandler } from '@easylayer/components/cqrs';
import { Transactional, EventStoreRepository } from '@easylayer/components/eventstore';
import { InitNetworkCommand } from '@easylayer/common/domain-cqrs-components/bitcoin';
import { AppLogger } from '@easylayer/components/logger';
import { Network } from '@easylayer/components/bitcoin-network-state';
import { ViewsReadRepositoryService } from '../../infrastructure-layer/services';
import { NetworkModelFactoryService } from '../services';
import { BusinessConfig } from '../../config';

@CommandHandler(InitNetworkCommand)
export class InitNetworkCommandHandler implements ICommandHandler<InitNetworkCommand> {
  constructor(
    private readonly log: AppLogger,
    private readonly eventStore: EventStoreRepository,
    private readonly networkModelFactory: NetworkModelFactoryService,
    private readonly viewsReadRepository: ViewsReadRepositoryService,
    private readonly businessConfig: BusinessConfig
  ) {}

  @Transactional({ connectionName: 'loader-eventstore' })
  async execute({ payload }: InitNetworkCommand) {
    try {
      const { requestId } = payload;

      // Fetch last proccessed block hegith at read model
      const indexedHeight = await this.viewsReadRepository.getLastBlock();

      this.log.debug('Last block height value at read database', { height: indexedHeight }, this.constructor.name);

      const networkModel: Network = await this.networkModelFactory.initModel();

      // IMPORTANT: We add -1 because we must specify the already indexed height
      // (if this is the beginning of the chain then it is -1, 0 is the first block)
      await networkModel.init({
        requestId,
        indexedHeight:
          indexedHeight < this.businessConfig.BITCOIN_LOADER_START_BLOCK_HEIGHT - 1
            ? this.businessConfig.BITCOIN_LOADER_START_BLOCK_HEIGHT - 1
            : indexedHeight,
        logger: this.log,
      });

      await this.eventStore.save(networkModel);
      await networkModel.commit();

      this.log.info('Network Aggregate successfully initialized.', null, this.constructor.name);
    } catch (error) {
      this.log.error('execute()', error, this.constructor.name);
      throw error;
    }
  }
}
