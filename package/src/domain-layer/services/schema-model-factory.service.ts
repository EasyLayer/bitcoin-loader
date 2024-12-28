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
    // IMPORTANT: If there is no such thing in the database, then we will return the base model.
    return model;
  }

  public async getLastEvent(): Promise<any> {
    const model = await this.schemaRepository.getOne(this.createNewModel());
    return await this.schemaRepository.fetchLastEvent(model);
  }

  public async publishLastEvent(): Promise<void> {
    const model = await this.schemaRepository.getOne(this.createNewModel());
    const event = await this.schemaRepository.fetchLastEvent(model);
    if (event) {
      await model.republish(event);
    }
  }
}
