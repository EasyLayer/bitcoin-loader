import { v4 as uuidv4 } from 'uuid';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { AppLogger } from '@easylayer/components/logger';
import { SchemaCommandFactoryService } from './application-layer/services';

@Injectable()
export class LoaderService implements OnModuleInit {
  constructor(
    private readonly log: AppLogger,
    private readonly schemaCommandFactory: SchemaCommandFactoryService
  ) {}

  async onModuleInit() {
    await this.schemaSynchronisation();
  }

  private async schemaSynchronisation(): Promise<void> {
    // Sync Read Schema
    await this.schemaCommandFactory.sync({ requestId: uuidv4() });
  }
}
