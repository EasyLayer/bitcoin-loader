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
  @Transform(({ value }) => (value !== undefined ? parseInt(value, 10) : 5242880))
  @IsNumber()
  @JSONSchema({
    description: 'Maximum size in bytes of the rpc blocks batch request',
    default: 5242880,
  })
  BITCOIN_LOADER_BLOCKS_QUEUE_LOADER_REQUEST_BLOCKS_BATCH_SIZE: number = 2097151; // 2.01 MB;

  @Transform(({ value }) => (value !== undefined ? parseInt(value, 10) : 119430400))
  @IsNumber()
  @JSONSchema({
    description: 'Maximum size in bytes of the Bitcoin blocks queue.',
    default: 119430400,
  })
  BITCOIN_LOADER_BLOCKS_QUEUE_MAX_SIZE: number = 119430400; // 100 MB

  @Transform(({ value }) => (value !== undefined ? parseInt(value, 10) : 1048576))
  @IsNumber()
  @JSONSchema({
    description: 'Minimum size in bytes of the Bitcoin blocks queue transfer blocks to outStack',
    default: 1048576,
  })
  BITCOIN_LOADER_BLOCKS_QUEUE_MIN_TRANSFER_SIZE: number = 1 * 1024 * 1024; // 1 MB;

  @Transform(({ value }) => (value !== undefined ? value : BlocksQueueStrategy.PULL_NETWORK_PROVIDER))
  @IsEnum(BlocksQueueStrategy)
  @JSONSchema({
    description: 'Loader strategy name for the Bitcoin blocks queue.',
    default: BlocksQueueStrategy.PULL_NETWORK_PROVIDER,
    enum: Object.values(BlocksQueueStrategy),
  })
  BITCOIN_LOADER_BLOCKS_QUEUE_LOADER_STRATEGY_NAME: BlocksQueueStrategy = BlocksQueueStrategy.PULL_NETWORK_PROVIDER;

  @Transform(({ value }) => (value !== undefined ? parseInt(value, 10) : 15728640))
  @IsNumber()
  @JSONSchema({
    description:
      'Batch size in bytes of the batch blocks iterator at one time. Should not be less than the size of a single block.',
    default: 15728640,
  })
  BITCOIN_LOADER_BLOCKS_QUEUE_ITERATOR_BLOCKS_BATCH_SIZE: number = 15728640; // 15 MB

  @Transform(({ value }) => (value !== undefined ? parseInt(value, 10) : 4))
  @IsNumber()
  @JSONSchema({
    description: 'Сoncurrency сount of blocks download',
    default: 4,
  })
  BITCOIN_LOADER_BLOCKS_QUEUE_LOADER_CONCURRENCY_COUNT: number = 4;
}
