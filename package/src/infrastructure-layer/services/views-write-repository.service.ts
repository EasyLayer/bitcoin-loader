import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { from as copyFrom } from 'pg-copy-streams';
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import {
  InjectDataSource,
  DataSource,
  Repository,
  PostgresQueryRunner,
  QueryRunner,
} from '@easylayer/components/views-rdbms-db';
import { AppLogger } from '@easylayer/components/logger';
import { ReadDatabaseConfig } from '../../config';

@Injectable()
export class ViewsWriteRepositoryService implements OnModuleDestroy {
  private isParallelSupport: boolean;

  // Queue of operations: stores entityName, method, and operation data
  private operations: Array<{ entityName: string; method: string; data: any[] }> = [];

  constructor(
    @InjectDataSource('loader-views')
    private readonly datasource: DataSource,
    private readonly config: ReadDatabaseConfig,
    private readonly log: AppLogger
  ) {
    this.isParallelSupport = this.datasource.manager.connection?.options?.type === 'postgres';
  }

  async onModuleDestroy() {
    if (this.operations.length > 0) {
      try {
        await this.commit();
      } catch (error) {}
    }

    this.clearOperations();
  }

  /**
   * Retrieves the repository for a specific entity from the datasource
   */
  private getRepository<T extends object>(entityName: string): Repository<T> {
    const entityMetadata = this.datasource.entityMetadatas.find(
      (metadata) =>
        metadata.tableName === entityName || metadata.targetName === entityName || metadata.target === entityName
    );

    if (!entityMetadata) {
      throw new Error(`Entity with name "${entityName}" not found.`);
    }

    return this.datasource.getRepository<T>(entityMetadata.target);
  }

  /**
   * Processes the models by extracting their operations history and adding those operations
   * to the internal queue (this.operations).
   */
  public process(
    models: Array<{
      getOperationsHistory: () => Array<{ method: string; params: any }>;
      clearOperationsHistory: () => void;
    }> = []
  ): void {
    models.forEach((model) => {
      const entityName = model.constructor.name;
      const operationsHistory = model.getOperationsHistory();
      for (const operation of operationsHistory) {
        const { method, params } = operation;
        this.addOperation(entityName, method, params);
      }

      // IMPORTANT: We clear the operations variable inside the model, manually for now
      model.clearOperationsHistory();
    });
  }

  /**
   * Adds an operation (insert, update, delete) to the operations queue.
   * For `delete`, it accumulates different conditions into a single operation.
   * For `update`, it groups operations by values and accumulates conditions.
   */
  private addOperation(entityName: string, method: string, params: any): void {
    let existingOperation = this.operations.find((op) => op.entityName === entityName && op.method === method);

    if (!existingOperation) {
      existingOperation = { entityName, method, data: [] };
      if (method === 'delete' || method === 'update') {
        this.operations.unshift(existingOperation); // Prioritize delete and update operations
      } else {
        this.operations.push(existingOperation); // Add other operations to the end
      }
    }

    if (method === 'delete') {
      // Accumulate different conditions for batch deletion
      existingOperation.data.push(params);
    } else if (method === 'update') {
      // For updates, group by the same values and accumulate conditions
      const existingUpdate = existingOperation.data.find(
        (op) => JSON.stringify(op.values) === JSON.stringify(params.values)
      );

      if (existingUpdate) {
        // If values match, merge conditions
        existingUpdate.conditions.push(params.conditions);
      } else {
        // Otherwise, add new update entry with values and conditions
        existingOperation.data.push({ values: params.values, conditions: [params.conditions] });
      }
    } else {
      // For other operations (e.g., insert), just add the params
      existingOperation.data.push(params);
    }
  }

  /**
   * Commits all queued operations to the database.
   * Supports stream and batch inserts and handles each operation sequentially.
   */
  public async commit(): Promise<void> {
    if (this.operations.length === 0) {
      throw new Error('No operations to commit');
    }

    const queryRunner = this.datasource.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      for (const operation of this.operations) {
        const { entityName, method, data } = operation;

        switch (method) {
          case 'insert':
            await this.handleInsert(queryRunner, entityName, data);
            break;

          case 'update':
            await this.handleUpdate(queryRunner, entityName, data);
            break;

          case 'delete':
            await this.handleDelete(queryRunner, entityName, data);
            break;

          default:
            throw new Error(`Unsupported method: ${method}`);
        }
      }

      await queryRunner.commitTransaction();
      this.clearOperations();
    } catch (error) {
      this.log.error('Error during commit, rolling back transaction:', error, this.constructor.name);
      try {
        await queryRunner.rollbackTransaction();
        this.clearOperations();
      } catch (rollbackError) {
        this.log.error('Error during rollback:', rollbackError, this.constructor.name);
      }
      throw error;
    } finally {
      try {
        await queryRunner.release();
      } catch (releaseError) {
        this.log.error('Error releasing query runner:', releaseError);
      }

      // IMPORTANT: Errors during query runner release are logged but not thrown.
      // Since the transaction has already been committed or rolled back,
      // it is safe to avoid throwing errors from the release process.
    }
  }

  private async handleInsert(queryRunner: QueryRunner, entityName: string, data: any[]): Promise<void> {
    const batchSize = this.config.BITCOIN_LOADER_READ_DB_INSERT_CHANKS_LIMIT;

    if (this.isParallelSupport) {
      await this.insertWithCopy(queryRunner, entityName, data);
    } else {
      if (data.length > batchSize) {
        const chunkedBatches = this.chunkArray(data, batchSize);
        for (const chunk of chunkedBatches) {
          await this.insert(queryRunner, entityName, chunk);
        }
      } else {
        await this.insert(queryRunner, entityName, data);
      }
    }
  }

  private async handleUpdate(queryRunner: QueryRunner, entityName: string, updates: any[]): Promise<void> {
    for (const update of updates) {
      await this.update(queryRunner, entityName, update);
    }
  }

  private async handleDelete(queryRunner: QueryRunner, entityName: string, data: any): Promise<void> {
    await this.delete(queryRunner, entityName, data);
  }

  /**
   * Inserts data into the repository in bulk.
   * Uses 'orIgnore' to avoid conflicts and prevent duplicate records.
   */
  private async insert(queryRunner: QueryRunner, entityName: string, values: any[]): Promise<void> {
    const repo = queryRunner.manager.getRepository(entityName);
    await repo.createQueryBuilder().insert().values(values).orIgnore().updateEntity(false).execute();
  }

  private async insertWithCopy(queryRunner: QueryRunner, entityName: string, values: any[]): Promise<void> {
    const repo = this.getRepository(entityName);
    const entityMetadata = repo.metadata;
    const tableName = `"${entityMetadata.tableName}"`;
    const columns = entityMetadata.columns.map((col) => `"${col.databaseName}"`).join(', ');

    // Convert the values ​​to a format suitable for COPY (tab-delimited table)
    const readableStream = new Readable({
      read() {
        values.forEach((row) => {
          const formattedRow = entityMetadata.columns
            .map((col) => {
              const value = row[col.propertyName];
              if (value === null || value === undefined) {
                return '\\N';
              }
              if (typeof value === 'string') {
                return value.replace(/\\/g, '\\\\').replace(/\t/g, '\\t').replace(/\n/g, '\\n');
              }
              if (typeof value === 'number') {
                return value.toString();
              }
              if (typeof value === 'boolean') {
                return value ? '1' : '0';
              }
              if (Array.isArray(value) || (typeof value === 'object' && value !== null)) {
                return JSON.stringify(value).replace(/\\/g, '\\\\').replace(/\t/g, '\\t').replace(/\n/g, '\\n');
              }

              return value.toString().replace(/\\/g, '\\\\').replace(/\t/g, '\\t').replace(/\n/g, '\\n');
            })
            .join('\t');

          this.push(formattedRow + '\n');
        });
        this.push(null);
      },
    });

    const query = `COPY ${tableName} (${columns}) FROM STDIN WITH (FORMAT text)`;

    try {
      // https://github.com/typeorm/typeorm/issues/4839
      // Getting a low-level PostgreSQL client
      const rawClient = await (<PostgresQueryRunner>queryRunner).connect();
      if (!rawClient) {
        throw new Error('Failed to get PostgreSQL low-level client from TypeORM.');
      }

      const copyStream = rawClient.query(copyFrom(query));

      // IMPORTANT: Using pipeline to handle async streams correctly
      await pipeline(readableStream, copyStream);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Updates records in the repository based on conditions.
   * Groups conditions for the same values and applies them in a single query.
   */
  private async update(
    queryRunner: QueryRunner,
    entityName: string,
    params: { values: Record<string, any>; conditions?: Record<string, any>[] }
  ): Promise<any> {
    // const repo = this.getRepository(entityName);
    const repo = queryRunner.manager.getRepository(entityName);
    const queryBuilder = repo.createQueryBuilder().update().set(params.values);

    if (params.conditions) {
      // Combine multiple conditions using OR
      params.conditions.forEach((condition, index) => {
        const conditionStrings = Object.keys(condition).map((key) => `${key} = :${key}${index}`);
        const conditionClause = conditionStrings.join(' AND ');
        queryBuilder.orWhere(conditionClause, this.prefixConditionParams(condition, index));
      });
    }

    return await queryBuilder.execute();
  }

  /**
   * Deletes records from the repository based on conditions.
   * Supports multiple conditions and combines them into a single query.
   */
  private async delete(
    queryRunner: QueryRunner,
    entityName: string,
    conditionsArray: Record<string, any>[]
  ): Promise<void> {
    // const repo = this.getRepository(entityName);
    const repo = queryRunner.manager.getRepository(entityName);
    const queryBuilder = repo.createQueryBuilder().delete();

    // Combine multiple conditions for batch deletion using OR
    conditionsArray.forEach((conditions, index) => {
      const conditionStrings = Object.keys(conditions).map((key) => `${key} = :${key}${index}`);
      const conditionClause = conditionStrings.join(' AND ');
      queryBuilder.orWhere(conditionClause, this.prefixConditionParams(conditions, index));
    });

    await queryBuilder.execute();
  }

  /**
   * Clear the queue of operations after they are successfully committed.
   */
  public clearOperations(): void {
    this.operations = [];
  }

  /**
   * Helper function to add a unique prefix to condition parameters to avoid conflicts.
   */
  private prefixConditionParams(conditions: Record<string, any>, index: number): Record<string, any> {
    const prefixedParams: Record<string, any> = {};
    Object.entries(conditions).forEach(([key, value]) => {
      prefixedParams[`${key}${index}`] = value;
    });
    return prefixedParams;
  }

  /**
   * Helper function to chunk large arrays into smaller batches.
   * Used primarily for batch inserts.
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const results: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      results.push(array.slice(i, i + chunkSize));
    }
    return results;
  }
}
