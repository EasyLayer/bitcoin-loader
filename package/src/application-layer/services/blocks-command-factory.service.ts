// import { v4 as uuidv4 } from 'uuid';
import { Injectable } from '@nestjs/common';
import { CommandBus } from '@easylayer/components/cqrs';
import { AddBlocksBatchCommand } from '@easylayer/common/domain-cqrs-components/bitcoin';

@Injectable()
export class BlocksCommandFactoryService {
  constructor(private readonly commandBus: CommandBus) {}

  public async handleBatch(dto: any): Promise<void> {
    await this.commandBus.execute(new AddBlocksBatchCommand({ ...dto }));
  }
}
