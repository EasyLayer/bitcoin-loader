import { Injectable } from '@nestjs/common';
import { CommandBus } from '@easylayer/components/cqrs';
import { SyncSchemaCommand } from '@easylayer/common/domain-cqrs-components/bitcoin';

@Injectable()
export class SchemaCommandFactoryService {
  constructor(private readonly commandBus: CommandBus) {}

  public async sync(dto: any): Promise<void> {
    return await this.commandBus.execute(new SyncSchemaCommand(dto));
  }
}
