import { Injectable } from '@nestjs/common';
import { EventPublisher } from '@easylayer/components/cqrs';
import { EventStoreRepository } from '@easylayer/components/eventstore';
import { Schema } from '@easylayer/components/bitcoin-network-state';

@Injectable()
export class SchemaModelFactoryService {
  constructor(
    private readonly publisher: EventPublisher,
    private readonly schemaRepository: EventStoreRepository<Schema>
  ) {}

  public createNewModel(): Schema {
    return this.publisher.mergeObjectContext(new Schema());
  }

  public async initModel(): Promise<Schema> {
    const model = await this.schemaRepository.getOne(this.createNewModel());
    return model;
  }
}
