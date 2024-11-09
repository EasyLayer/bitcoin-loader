import { CommandHandler, ICommandHandler } from '@easylayer/components/cqrs';
import { Transactional, EventStoreRepository } from '@easylayer/components/eventstore';
import { LoadBatchCommand } from '@easylayer/common/domain-cqrs-components/bitcoin-loader';
import { AppLogger, RuntimeTracker } from '@easylayer/components/logger';
import { NetworkProviderService } from '@easylayer/components/bitcoin-network-provider';
import { Loader } from '../models/loader.model';
import { LoaderModelFactoryService } from '../services';

@CommandHandler(LoadBatchCommand)
export class LoadBatchCommandHandler implements ICommandHandler<LoadBatchCommand> {
  constructor(
    private readonly log: AppLogger,
    private readonly loaderModelFactory: LoaderModelFactoryService,
    private readonly networkProviderService: NetworkProviderService,
    private readonly eventStore: EventStoreRepository
  ) {}

  @Transactional({ connectionName: 'loader-eventstore' })
  @RuntimeTracker({ showMemory: false, warningThresholdMs: 10, errorThresholdMs: 1000 })
  async execute({ payload }: LoadBatchCommand) {
    try {
      const { batch, requestId } = payload;

      const loaderModel: Loader = await this.loaderModelFactory.initModel();

      await loaderModel.addBlocks({
        requestId,
        blocks: batch,
        service: this.networkProviderService,
      });

      await this.eventStore.save(loaderModel);

      this.loaderModelFactory.updateCache(loaderModel);

      await loaderModel.commit();
      // console.time('CqrsTransportTime');
    } catch (error) {
      this.log.error('execute()', error, this.constructor.name);
      this.loaderModelFactory.clearCache();
      throw error;
    }
  }
}
