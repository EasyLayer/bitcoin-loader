import { CommandHandler, ICommandHandler } from '@easylayer/components/cqrs';
import { Transactional, EventStoreRepository } from '@easylayer/components/eventstore';
import { InitLoaderCommand } from '@easylayer/common/domain-cqrs-components/bitcoin-loader';
import { AppLogger, RuntimeTracker } from '@easylayer/components/logger';
import { Loader } from '../models/loader.model';
import { LoaderModelFactoryService } from '../services';
import { BusinessConfig } from '../../config';

@CommandHandler(InitLoaderCommand)
export class InitLoaderCommandHandler implements ICommandHandler<InitLoaderCommand> {
  constructor(
    private readonly log: AppLogger,
    private readonly eventStore: EventStoreRepository,
    private readonly loaderModelFactory: LoaderModelFactoryService,
    private readonly businessConfig: BusinessConfig
  ) {}

  @Transactional({ connectionName: 'loader-eventstore' })
  @RuntimeTracker({ showMemory: false })
  async execute({ payload }: InitLoaderCommand) {
    try {
      const { requestId, indexedHeight } = payload;

      const loaderModel: Loader = await this.loaderModelFactory.initModel();

      // if (loaderModel.status === 'reorganisation') {
      //   // IMPORTANT: In this case we have to republish events
      //   this.log.info('Reorganisation of blocks is starting...', null, this.constructor.name);
      //   // Publish last Loader event to process reorganisation
      //   await this.loaderModelFactory.publishLastEvent();
      // }

      // IMPORTANT: We add -1 because we must specify the already indexed height
      // (if this is the beginning of the chain then it is -1, 0 is the first block)
      await loaderModel.init({
        requestId,
        indexedHeight:
          indexedHeight < this.businessConfig.BITCOIN_LOADER_START_BLOCK_HEIGHT - 1
            ? this.businessConfig.BITCOIN_LOADER_START_BLOCK_HEIGHT - 1
            : indexedHeight,
        logger: this.log,
      });

      await this.eventStore.save(loaderModel);
      await loaderModel.commit();

      this.log.info('Loader Aggregate successfully initialized.', null, this.constructor.name);
    } catch (error) {
      this.log.error('execute()', error, this.constructor.name);
      throw error;
    }
  }
}
