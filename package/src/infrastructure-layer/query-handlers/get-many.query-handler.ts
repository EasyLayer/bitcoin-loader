import { IQueryHandler, QueryHandler } from '@easylayer/components/cqrs';
import { GetManyQuery } from '@easylayer/common/domain-cqrs-components/bitcoin-loader';
import { ViewsReadRepositoryService } from '../services/views-read-repository.service';

@QueryHandler(GetManyQuery)
export class GetManyQueryHandler implements IQueryHandler<GetManyQuery> {
  constructor(private readonly viewsReadRepository: ViewsReadRepositoryService) {}

  async execute({ payload }: GetManyQuery): Promise<any[]> {
    const { entityName, filter, sorting, paging, relations } = payload;

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

    if (sorting && sorting.length > 0) {
      sorting.forEach((sort: any) => {
        queryBuilder.addOrderBy(`${entityName}.${sort.field}`, sort.direction || 'ASC');
      });
    }

    if (paging) {
      if (paging.limit) {
        queryBuilder = queryBuilder.take(paging.limit);
      }
      if (paging.offset) {
        queryBuilder = queryBuilder.skip(paging.offset);
      }
    }

    if (relations && relations.length > 0) {
      relations.forEach((relation) => {
        queryBuilder = queryBuilder.leftJoinAndSelect(`${entityName}.${relation}`, relation);
      });
    }

    return queryBuilder.getMany();
  }
}
