import { Injectable } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsString, IsOptional, IsArray, IsNumber } from 'class-validator';
import { JSONSchema } from 'class-validator-jsonschema';

@Injectable()
export class ProvidersConfig {
  @Transform(({ value }) => (value ? value : ''))
  @IsString()
  @IsOptional()
  @JSONSchema({
    description: "URL of the user's own Bitcoin node. Format: http://username:password@host:port",
  })
  BITCOIN_LOADER_NETWORK_PROVIDER_SELF_NODE_URL?: string;

  @Transform(({ value }) => (value ? value.split('|') : []))
  @IsArray()
  @IsOptional()
  @JSONSchema({
    description: 'Multiple QuickNode node URLs can be entered, separated by commas.',
  })
  BITCOIN_LOADER_NETWORK_PROVIDER_QUICK_NODE_URLS?: string[];

  @Transform(({ value }) => (value !== undefined ? parseInt(value, 10) : Number.MAX_SAFE_INTEGER))
  @JSONSchema({
    description: 'Size in bytes of the max request content data length.',
    default: Number.MAX_SAFE_INTEGER,
  })
  @IsNumber()
  BITCOIN_LOADER_NETWORK_PROVIDER_MAX_REQUEST_CONTENT_LENGTH: number = Number.MAX_SAFE_INTEGER; //200 * 1024 * 1024;

  @Transform(({ value }) => (value !== undefined ? parseInt(value, 10) : 10000))
  @IsNumber()
  BITCOIN_LOADER_NETWORK_PROVIDER_REQUEST_TIMEOUT: number = 10000;
}
