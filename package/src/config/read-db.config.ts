import { resolve } from 'node:path';
import { Injectable } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsString, IsBoolean, IsNumber, IsOptional } from 'class-validator';
import { JSONSchema } from 'class-validator-jsonschema';

type DatabaseTypes = 'sqlite' | 'postgres';

@Injectable()
export class ReadDatabaseConfig {
  @Transform(({ value }) => (value ? value : 'sqlite'))
  @IsString()
  @JSONSchema({
    description: 'Type of database for the read model.',
    default: 'sqlite',
    enum: ['sqlite', 'postgres'],
  })
  BITCOIN_LOADER_READ_DB_TYPE: DatabaseTypes = 'sqlite';

  @IsBoolean()
  @JSONSchema({
    description: 'Automatic synchronization for the read model database. Use with caution.',
    default: true,
  })
  BITCOIN_LOADER_READ_DB_SYNCHRONIZE: boolean = true;

  @Transform(({ value }) => (value ? value : 'localhost'))
  @IsString()
  @IsOptional()
  @JSONSchema({
    description: 'Host for the read model database.',
  })
  BITCOIN_LOADER_READ_DB_HOST?: string;

  @Transform(({ value }) => (value ? parseInt(value, 10) : 5432))
  @IsNumber()
  @IsOptional()
  @JSONSchema({
    description: 'Port for the read model database.',
  })
  BITCOIN_LOADER_READ_DB_PORT?: number;

  @Transform(({ value }) => (value ? value : ''))
  @IsString()
  @IsOptional()
  @JSONSchema({
    description: 'Username for the read model database.',
  })
  BITCOIN_LOADER_READ_DB_USERNAME?: string;

  @Transform(({ value }) => (value ? value : ''))
  @IsString()
  @IsOptional()
  @JSONSchema({
    description: 'Password for the read model database.',
  })
  BITCOIN_LOADER_READ_DB_PASSWORD?: string;

  @Transform(({ value }) => (value ? Number(value) : 999))
  @IsNumber()
  @JSONSchema({
    description: 'Limit for data chunks when inserting into the database.',
    default: 999,
  })
  BITCOIN_LOADER_READ_DB_INSERT_CHANKS_LIMIT: number = 999;

  @Transform(({ value }) => (value ? value : resolve(process.cwd(), 'data/loader-views.db')))
  @IsString()
  @JSONSchema({
    description: 'The name of the read model database. In the case of SQLite, this is the path to the database file.',
    default: 'data/loader-views.db',
  })
  BITCOIN_LOADER_READ_DB_NAME: string = resolve(process.cwd(), 'data/loader-views.db');

  isLogging(): boolean {
    return process.env.DB_DEBUG === '1';
  }

  isUnlogged(): boolean {
    return process.env.BITCOIN_LOADER_READ_DB_UNLOGGED_TABLES_ENABLE === '1';
  }
}
