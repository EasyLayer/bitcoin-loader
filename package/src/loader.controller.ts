import { Controller, Get, HttpCode, Param, Query, ParseArrayPipe, Header } from '@nestjs/common';
import { Filter } from '@nestjs-query/core';
import {
  ApiOkResponse,
  ApiOperation,
  ApiNotFoundResponse,
  ApiResponse,
  ApiTags,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { ViewsQueryFactoryService } from './application-layer/services';
import { IsEnum, IsOptional, IsString, IsNumber } from 'class-validator';

enum SortingDirectionEnum {
  ASC = 'ASC',
  DESC = 'DESC',
}

export class SortingDto {
  @IsString()
  readonly field!: string;

  @IsOptional()
  @IsEnum(SortingDirectionEnum)
  readonly direction?: SortingDirectionEnum;
}

export class PaginationDto {
  @IsOptional()
  @IsNumber()
  readonly limit?: number;

  @IsOptional()
  @IsNumber()
  readonly offset?: number;
}

@Controller()
@ApiTags('Bitcoin Loader')
export class LoaderController {
  constructor(private readonly viewsQueryFactory: ViewsQueryFactoryService) {}

  @Get('/healthcheck')
  @HttpCode(200)
  @Header('Content-Type', 'text/plain')
  @ApiOperation({ operationId: 'Healthcheck', description: 'Checking the status of the Bitcoin Loader module' })
  @ApiOkResponse({ description: 'The service is working fine' })
  @ApiNotFoundResponse({ description: 'Service not found' })
  @ApiResponse({ status: 500, description: 'Internal Server Error' })
  public async healthCheck() {}

  @Get('/find-many/:entity')
  @ApiOperation({ operationId: 'Find Many', description: 'Fetch multiple records from the specified entity' })
  @ApiParam({ name: 'entity', description: 'Entity name to fetch data from', required: true })
  @ApiQuery({
    name: 'sorting',
    description: 'Sorting options as an array',
    required: false,
    type: SortingDto,
    isArray: true,
  })
  @ApiQuery({
    name: 'paging',
    description: 'Pagination options (limit and offset)',
    required: false,
    type: PaginationDto,
  })
  @ApiQuery({
    name: 'filter',
    description: 'Filter criteria for querying entities',
    required: false,
    type: 'object',
  })
  @ApiQuery({
    name: 'relations',
    description: 'Comma-separated list of relations to include in the result',
    required: false,
    type: String,
  })
  @ApiOkResponse({ description: 'List of matching entities', type: 'array' })
  async findMany(
    @Param('entity') entityName: string,
    @Query('sorting', new ParseArrayPipe({ items: SortingDto, optional: true })) sorting?: SortingDto[],
    @Query('paging') paging?: PaginationDto,
    @Query('filter') filter?: Filter<any>,
    @Query('relations') relations?: string
  ) {
    const relationsArray = relations ? relations.split(',') : undefined;
    return this.viewsQueryFactory.getMany({ entityName, filter, sorting, paging, relations: relationsArray });
  }

  @Get('/find-one/:entity')
  @ApiOperation({ operationId: 'Find One', description: 'Fetch a single record from the specified entity' })
  @ApiParam({ name: 'entity', description: 'Entity name to fetch data from', required: true })
  @ApiQuery({
    name: 'filter',
    description: 'Filter criteria for querying a single entity',
    required: true,
    type: 'object',
  })
  @ApiQuery({
    name: 'relations',
    description: 'Comma-separated list of relations to include in the result',
    required: false,
    type: String,
  })
  @ApiOkResponse({ description: 'Single matching entity', type: 'object' })
  async findOne(
    @Param('entity') entityName: string,
    @Query('filter') filter: Filter<any>,
    @Query('relations') relations?: string
  ) {
    const relationsArray = relations ? relations.split(',') : undefined;
    return this.viewsQueryFactory.getOne({ entityName, filter, relations: relationsArray });
  }
}
