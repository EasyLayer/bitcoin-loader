import { EntitySchema } from './schema';

export const generateRepositoryFromSchema = (entitySchema: EntitySchema) => {
  const schemaOptions = entitySchema.options;
  const columns = schemaOptions.columns;

  class DynamicRepository {
    constructor() {
      // A local variable that will be hidden in the closure
      let operationsHistory: Array<{ method: string; params: any }> = [];

      this.insert = (values: Partial<Record<string, any>>) => {
        const missing: any[] = [];
        Object.keys(columns).forEach((fieldName) => {
          const column = columns[fieldName];
          if (values[fieldName] === undefined) {
            if (column && column.default !== undefined) {
              values[fieldName] = typeof column.default === 'function' ? column.default() : column.default;
            } else if (column && !column.nullable) {
              missing.push(fieldName);
            }
          }
        });

        if (missing.length > 0) {
          throw new Error(`Missing required fields in insert: ${missing.join(', ')}`);
        }

        operationsHistory.push({ method: 'insert', params: values });
      };

      this.update = (conditions: Record<string, any>, values: Record<string, any>) => {
        const errors: string[] = [];
        Object.keys(values).forEach((fieldName) => {
          const column = columns[fieldName];

          // Checking if a field exists in a schema
          if (!column) {
            errors.push(`Field "${fieldName}" is not defined in the schema.`);
          }

          const value = values[fieldName];

          if (value === undefined) {
            if (column?.nullable === false) {
              errors.push(`Field "${fieldName}" cannot be undefined.`);
            }
          }
        });

        if (errors.length > 0) {
          throw new Error(`Error in update: ${errors.join('; ')}`);
        }

        operationsHistory.push({ method: 'update', params: { values, conditions } });
      };

      this.delete = (conditions: Record<string, any>) => {
        operationsHistory.push({ method: 'delete', params: conditions });
      };

      this.getOperationsHistory = () => {
        return operationsHistory.slice();
      };

      this.clearOperationsHistory = () => {
        operationsHistory = [];
      };
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    insert(values: Record<string, any>) {}
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    update(conditions: Record<string, any>, values: Record<string, any>) {}
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    delete(conditions: Record<string, any>) {}
    getOperationsHistory() {}
    clearOperationsHistory() {}
  }

  Object.defineProperty(DynamicRepository, 'name', { value: schemaOptions.name });

  return DynamicRepository;
};
