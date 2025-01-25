import { Injectable } from '@nestjs/common';
import { EventPublisher } from '@easylayer/components/cqrs';
import { EventStoreRepository } from '@easylayer/components/eventstore';
import { Network } from '@easylayer/components/bitcoin-network-state';
import { EventStoreConfig } from '../../config';

@Injectable()
export class NetworkModelFactoryService {
  constructor(
    private readonly publisher: EventPublisher,
    private readonly networkRepository: EventStoreRepository<Network>,
    private readonly eventStoreConfig: EventStoreConfig
  ) {}

  public createNewModel(): Network {
    return this.publisher.mergeObjectContext(
      new Network({
        maxSize: this.eventStoreConfig.BITCOIN_LOADER_EVENTSTORE_MODEL_MAX_SIZE,
      })
    );
  }

  public async initModel(): Promise<Network> {
    const model = await this.networkRepository.getOne(this.createNewModel());
    return model;
  }
}
