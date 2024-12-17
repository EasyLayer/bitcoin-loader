import { Inject } from '@nestjs/common';
import { EventsHandler, IEventHandler } from '@easylayer/components/cqrs';
import { AppLogger, RuntimeTracker } from '@easylayer/components/logger';
import { QueryFailedError } from '@easylayer/components/views-rdbms-db';
import { BitcoinNetworkReorganisationFinishedEvent } from '@easylayer/common/domain-cqrs-components/bitcoin';
import { ViewsWriteRepositoryService } from '../../infrastructure-layer/services';
import { ILoaderMapper } from '../../protocol';
import { SystemsRepository } from '../../infrastructure-layer/view-models';

@EventsHandler(BitcoinNetworkReorganisationFinishedEvent)
export class BitcoinNetworkReorganisationFinishedEventHandler
  implements IEventHandler<BitcoinNetworkReorganisationFinishedEvent>
{
  constructor(
    private readonly log: AppLogger,
    private readonly viewsWriteRepository: ViewsWriteRepositoryService,
    @Inject('LoaderMapper')
    private readonly loaderMapper: ILoaderMapper
  ) {}

  @RuntimeTracker({ showMemory: false })
  async handle({ payload }: BitcoinNetworkReorganisationFinishedEvent) {
    try {
      const { blocks: lightBlocks } = payload;

      const repositories = [];

      // Update System entity
      const lastBlockHeight: number = lightBlocks[lightBlocks.length - 1]?.height;
      const systemModel = new SystemsRepository();
      systemModel.update({ id: 1 }, { last_block_height: lastBlockHeight });

      repositories.push(systemModel);

      if (Array.isArray(lightBlocks) && lightBlocks.length > 0) {
        for (const block of lightBlocks) {
          const results = await this.loaderMapper.onReorganisation(block);
          repositories.push(...(Array.isArray(results) ? results : [results]));
        }
      }

      this.viewsWriteRepository.process(repositories);

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
