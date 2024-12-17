import { Injectable } from '@nestjs/common';
import { EventPublisher } from '@easylayer/components/cqrs';
import { EventStoreRepository } from '@easylayer/components/eventstore';
import { Network } from '../models/network.model';
import { BusinessConfig } from '../../config';

@Injectable()
export class NetworkModelFactoryService {
  private cache = new MemoryCache<Network>(60000); // TTL 60 seconds
  private readonly cacheKey = 'networkModel';

  constructor(
    private readonly publisher: EventPublisher,
    private readonly networkRepository: EventStoreRepository<Network>,
    private readonly businessConfig: BusinessConfig
  ) {}

  public createNewModel(): Network {
    return this.publisher.mergeObjectContext(
      new Network({
        maxSize: this.businessConfig.BITCOIN_LOADER_MODEL_MAX_SIZE,
      })
    );
  }

  public async initModel(): Promise<Network> {
    const cachedModel = this.cache.get(this.cacheKey);

    if (cachedModel) {
      return cachedModel;
    }

    const model = await this.networkRepository.getOne(this.createNewModel());
    // IMPORTANT: If there is no such thing in the database, then we will return the base model.
    return model;
  }

  public async publishLastEvent(): Promise<void> {
    const model = await this.networkRepository.getOne(this.createNewModel());
    const event = await this.networkRepository.fetchLastEvent(model);
    if (event) {
      await model.republish(event);
    }
  }

  public updateCache(model: Network): void {
    this.cache.set(this.cacheKey, model);
  }

  public clearCache(): void {
    this.cache.clear(this.cacheKey);
  }
}

class MemoryCache<T> {
  private cache = new Map<string, { value: T; expiresAt: number }>();
  private defaultTTL: number;

  constructor(defaultTTL: number) {
    this.defaultTTL = defaultTTL;
  }

  get(key: string): T | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    if (Date.now() > cached.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return cached.value;
  }

  set(key: string, value: T, ttl?: number): void {
    const expiresAt = Date.now() + (ttl || this.defaultTTL);
    this.cache.set(key, { value, expiresAt });
  }

  clear(key: string): void {
    this.cache.delete(key);
  }
}
