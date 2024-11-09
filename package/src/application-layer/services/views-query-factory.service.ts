// import { v4 as uuidv4 } from 'uuid';
import { Injectable } from '@nestjs/common';
import { QueryBus } from '@easylayer/components/cqrs';
import { GetManyQuery, GetOneQuery } from '@easylayer/common/domain-cqrs-components/bitcoin-loader';

@Injectable()
export class ViewsQueryFactoryService {
  constructor(private readonly queryBus: QueryBus) {}

  public async getOne(dto: any): Promise<void> {
    return this.queryBus.execute(new GetOneQuery({ ...dto }));
  }

  public async getMany(dto: any): Promise<void> {
    return this.queryBus.execute(new GetManyQuery({ ...dto }));
  }
}
