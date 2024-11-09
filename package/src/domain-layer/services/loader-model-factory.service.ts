import { Injectable } from '@nestjs/common';
import { EventPublisher } from '@easylayer/components/cqrs';
import { EventStoreRepository } from '@easylayer/components/eventstore';
import { Loader } from '../models/loader.model';
import { BusinessConfig } from '../../config';

@Injectable()
export class LoaderModelFactoryService {
  private cache = new MemoryCache<Loader>(60000); // TTL 60 seconds
  private readonly cacheKey = 'loaderModel';

  constructor(
    private readonly publisher: EventPublisher,
    private readonly loaderRepository: EventStoreRepository<Loader>,
    private readonly businessConfig: BusinessConfig
  ) {}

  public createNewModel(): Loader {
    return this.publisher.mergeObjectContext(
      new Loader({
        maxSize: this.businessConfig.BITCOIN_LOADER_MODEL_MAX_SIZE,
      })
    );
  }

  public async initModel(): Promise<Loader> {
    const cachedModel = this.cache.get(this.cacheKey);

    if (cachedModel) {
      return cachedModel;
    }

    const model = await this.loaderRepository.getOne(this.createNewModel());
    // IMPORTANT: If there is no such thing in the database, then we will return the base model.
    return model;
  }

  public async publishLastEvent(): Promise<void> {
    const model = await this.loaderRepository.getOne(this.createNewModel());
    const event = await this.loaderRepository.fetchLastEvent(model);
    if (event) {
      await model.republish(event);
    }
  }

  public updateCache(model: Loader): void {
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
