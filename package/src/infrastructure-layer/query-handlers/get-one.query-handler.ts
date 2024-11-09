import { IQueryHandler, QueryHandler } from '@easylayer/components/cqrs';
import { GetOneQuery } from '@easylayer/common/domain-cqrs-components/bitcoin-loader';
import { ViewsReadRepositoryService } from '../services/views-read-repository.service';

@QueryHandler(GetOneQuery)
export class GetOneQueryHandler implements IQueryHandler<GetOneQuery> {
  constructor(private readonly viewsReadRepository: ViewsReadRepositoryService) {}

  async execute({ payload }: GetOneQuery): Promise<any> {
    const { entityName, filter, relations } = payload;

    const repository = this.viewsReadRepository.getRepository(entityName);

    let queryBuilder = repository.createQueryBuilder(entityName);

    if (filter) {
      Object.keys(filter).forEach((key) => {
        const value = filter[key];

        if (key.includes('.')) {
          const [relation, field] = key.split('.');
          queryBuilder = queryBuilder.andWhere(`${relation}.${field} = :${field}`, { [field]: value });
        } else {
          queryBuilder = queryBuilder.andWhere(`${entityName}.${key} = :${key}`, { [key]: value });
        }
      });
    }

    if (relations && relations.length > 0) {
      relations.forEach((relation) => {
        queryBuilder = queryBuilder.leftJoinAndSelect(`${entityName}.${relation}`, relation);
      });
    }

    return queryBuilder.getOne();
  }
}
