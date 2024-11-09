import { Injectable } from '@nestjs/common';
import { InjectDataSource, DataSource, Repository } from '@easylayer/components/views-rdbms-db';
import { AppLogger } from '@easylayer/components/logger';
import { ReadDatabaseConfig } from '../../config';
import { ISystem } from '../view-models';

@Injectable()
export class ViewsReadRepositoryService {
  constructor(
    @InjectDataSource('loader-views') private readonly datasource: DataSource,
    private readonly config: ReadDatabaseConfig,
    private readonly log: AppLogger
  ) {}

  public getRepository<T extends object>(entityName: string): Repository<T> {
    const entityMetadata = this.datasource.entityMetadatas.find(
      (metadata) =>
        metadata.tableName === entityName || metadata.targetName === entityName || metadata.target === entityName
    );

    if (!entityMetadata) {
      throw new Error(`Entity with name "${entityName}" not found.`);
    }

    return this.datasource.getRepository<T>(entityMetadata.target);
  }

  public async getLastBlock(): Promise<number> {
    const repo = this.getRepository<ISystem>('system');

    let model = await repo.findOneBy({ id: 1 });

    if (!model) {
      model = { id: 1, last_block_height: -1 };
      await repo.save(model);
    }

    return model.last_block_height;
  }
}
