import { Injectable } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsNumber, IsEnum } from 'class-validator';
import { JSONSchema } from 'class-validator-jsonschema';

enum BlocksQueueStrategy {
  WEBHOOK_STREAM = 'webhook-stream',
  PULL_NETWORK_TRANSPORT = 'pull-network-transport',
  PULL_NETWORK_PROVIDER = 'pull-network-provider',
}

@Injectable()
export class BlocksQueueConfig {
  @Transform(({ value }) => (value !== undefined ? value : BlocksQueueStrategy.PULL_NETWORK_PROVIDER))
  @IsEnum(BlocksQueueStrategy)
  @JSONSchema({
    description: 'Loader strategy name for the Bitcoin blocks queue.',
    default: BlocksQueueStrategy.PULL_NETWORK_PROVIDER,
    enum: Object.values(BlocksQueueStrategy),
  })
  BITCOIN_LOADER_BLOCKS_QUEUE_LOADER_STRATEGY_NAME: BlocksQueueStrategy = BlocksQueueStrategy.PULL_NETWORK_PROVIDER;

  @Transform(({ value }) => (value !== undefined ? parseInt(value, 10) : 4))
  @IsNumber()
  @JSONSchema({
    description: 'Сoncurrency сount of blocks download',
    default: 4,
  })
  BITCOIN_LOADER_BLOCKS_QUEUE_LOADER_CONCURRENCY_COUNT: number = 4;
}
