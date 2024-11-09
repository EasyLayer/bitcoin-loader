import { resolve } from 'node:path';
import { Injectable } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsString, IsBoolean, IsOptional, IsNumber } from 'class-validator';
import { JSONSchema } from 'class-validator-jsonschema';

type DatabaseTypes = 'sqlite' | 'postgres';

@Injectable()
export class EventStoreConfig {
  @Transform(({ value }) => (value ? value : 'sqlite'))
  @IsString()
  @JSONSchema({
    description: 'Type of database for the eventstore.',
    default: 'sqlite',
    enum: ['sqlite', 'postgres'],
  })
  BITCOIN_LOADER_EVENTSTORE_DB_TYPE: DatabaseTypes = 'sqlite';

  @IsBoolean()
  @JSONSchema({
    description: 'Automatic synchronization that creates or updates tables and columns. Use with caution.',
    default: true,
  })
  BITCOIN_LOADER_EVENTSTORE_DB_SYNCHRONIZE: boolean = true;

  @Transform(({ value }) => (value ? value : 'localhost'))
  @IsString()
  @IsOptional()
  @JSONSchema({
    description: 'Host for the eventstore database connection.',
  })
  BITCOIN_LOADER_EVENTSTORE_DB_HOST?: string;

  @Transform(({ value }) => (value ? parseInt(value, 10) : 5432))
  @IsNumber()
  @IsOptional()
  @JSONSchema({
    description: 'Port for the eventstore database connection.',
  })
  BITCOIN_LOADER_EVENTSTORE_DB_PORT?: number;

  @Transform(({ value }) => (value ? value : ''))
  @IsString()
  @IsOptional()
  @JSONSchema({
    description: 'Username for the eventstore database connection.',
  })
  BITCOIN_LOADER_EVENTSTORE_DB_USERNAME?: string;

  @Transform(({ value }) => (value ? value : ''))
  @IsString()
  @IsOptional()
  @JSONSchema({
    description: 'Password for the eventstore database connection.',
  })
  BITCOIN_LOADER_EVENTSTORE_DB_PASSWORD?: string;

  @Transform(({ value }) => (value ? value : resolve(process.cwd(), `data/loader-eventstore.db`)))
  @IsString()
  @JSONSchema({
    description:
      'In the case of SQLite, this is the path to the database file. In the case of Postgres, it is the name of the database.',
    default: 'data/loader-eventstore.db',
  })
  BITCOIN_LOADER_EVENTSTORE_DB_NAME: string = resolve(process.cwd(), 'data/loader-eventstore.db');

  isLogging(): boolean {
    return process.env.DB_DEBUG === '1';
  }
}
