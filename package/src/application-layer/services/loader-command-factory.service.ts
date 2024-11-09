// import { v4 as uuidv4 } from 'uuid';
import { Injectable } from '@nestjs/common';
import { CommandBus } from '@easylayer/components/cqrs';
import {
  InitLoaderCommand,
  ProcessReorganisationCommand,
} from '@easylayer/common/domain-cqrs-components/bitcoin-loader';

@Injectable()
export class LoaderCommandFactoryService {
  constructor(private readonly commandBus: CommandBus) {}

  public async init(dto: any): Promise<void> {
    return await this.commandBus.execute(new InitLoaderCommand(dto));
  }

  public async processReorganisation(dto: any): Promise<void> {
    return await this.commandBus.execute(new ProcessReorganisationCommand(dto));
  }
}
