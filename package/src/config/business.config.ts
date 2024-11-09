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

  @Transform(({ value }) => (value ? parseInt(value, 10) : 1000))
  @IsNumber()
  BITCOIN_LOADER_MODEL_MAX_SIZE: number = 1000;

  @Transform(({ value }) => (value ? value : 'testnet'))
  @IsString()
  BITCOIN_LOADER_BLOCKCHAIN_NETWORK_NAME: string = 'testnet';
}
