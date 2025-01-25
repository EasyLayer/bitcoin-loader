import { EventsHandler, IEventHandler } from '@easylayer/components/cqrs';
import { AppLogger, RuntimeTracker } from '@easylayer/components/logger';
import { QueryFailedError } from '@easylayer/components/views-rdbms-db';
import { BitcoinNetworkReorganisationFinishedEvent } from '@easylayer/common/domain-cqrs-components/bitcoin';
import { ViewsWriteRepositoryService } from '../../infrastructure-layer/services';
import { ProtocolWorkerService } from '../../protocol';
import { SystemsRepository } from '../../infrastructure-layer/view-models';

@EventsHandler(BitcoinNetworkReorganisationFinishedEvent)
export class BitcoinNetworkReorganisationFinishedEventHandler
  implements IEventHandler<BitcoinNetworkReorganisationFinishedEvent>
{
  constructor(
    private readonly log: AppLogger,
    private readonly viewsWriteRepository: ViewsWriteRepositoryService,
    private readonly protocolWorkerService: ProtocolWorkerService
  ) {}

  @RuntimeTracker({ showMemory: false })
  async handle({ payload }: BitcoinNetworkReorganisationFinishedEvent) {
    try {
      const { blocks: lightBlocks } = payload;

      // Update System entity
      const lastBlockHeight: number = lightBlocks[lightBlocks.length - 1]?.height;
      const systemsRepo = new SystemsRepository();
      systemsRepo.update({ id: 1 }, { last_block_height: lastBlockHeight });

      if (Array.isArray(lightBlocks) && lightBlocks.length > 0) {
        const operations = await this.protocolWorkerService.calculateOnReorganisationOperations(lightBlocks);
        console.log('operations', operations);
        operations.forEach((item: any) => {
          const { entityName, method, params } = item;
          this.viewsWriteRepository.addOperation(entityName, method, params);
        });
      }

      this.viewsWriteRepository.process([systemsRepo]);

      await this.viewsWriteRepository.commit();

      this.log.info(
        `Blockchain successfull reorganised to height`,
        {
          height: lastBlockHeight,
        },
        this.constructor.name
      );
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
