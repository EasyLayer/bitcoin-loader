import { Injectable } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsNumber, IsString } from 'class-validator';
import { JSONSchema } from 'class-validator-jsonschema';

@Injectable()
export class BusinessConfig {
  @Transform(({ value }) => (value !== undefined ? Number(value) : Number.MAX_SAFE_INTEGER))
  @IsNumber()
  @JSONSchema({
    description: 'Maximum block height to be processed. Defaults to infinity.',
    default: Number.MAX_SAFE_INTEGER,
  })
  BITCOIN_LOADER_MAX_BLOCK_HEIGHT: number = Number.MAX_SAFE_INTEGER;

  @Transform(({ value }) => (value !== undefined ? Number(value) : 0))
  @IsNumber()
  @JSONSchema({
    description: 'The block height from which processing begins.',
    default: 0,
  })
  BITCOIN_LOADER_START_BLOCK_HEIGHT: number = 0;

  @Transform(({ value }) => (value ? value : 'testnet'))
  @IsString()
  BITCOIN_LOADER_BLOCKCHAIN_NETWORK_NAME: string = 'testnet';

  @Transform(({ value }) => (value !== undefined ? Number(value) : 1048576))
  @IsNumber()
  @JSONSchema({
    description: 'The block size',
    default: 1048576,
  })
  BITCOIN_LOADER_ONE_BLOCK_SIZE: number = 1048576;

  @Transform(({ value }) => (value !== undefined ? parseInt(value, 10) : 4))
  @IsNumber()
  @JSONSchema({
    description: 'Number of threads for processing the protocol',
    default: 4,
  })
  BITCOIN_LOADER_PROTOCOL_PROCESSING_WORKERS_COUNT: number = 4;
}
