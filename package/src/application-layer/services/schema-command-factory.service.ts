import { Injectable } from '@nestjs/common';
import { CommandBus } from '@easylayer/components/cqrs';
import { SyncSchemaCommand, SchemaMigrationUpCommand } from '@easylayer/common/domain-cqrs-components/bitcoin';

@Injectable()
export class SchemaCommandFactoryService {
  constructor(private readonly commandBus: CommandBus) {}

  public async sync(dto: any): Promise<void> {
    return await this.commandBus.execute(new SyncSchemaCommand(dto));
  }

  public async up(dto: any): Promise<void> {
    return await this.commandBus.execute(new SchemaMigrationUpCommand(dto));
  }

  public async down(dto: any): Promise<void> {
    throw new Error('method down is not implemented yes', dto);
  }
}
