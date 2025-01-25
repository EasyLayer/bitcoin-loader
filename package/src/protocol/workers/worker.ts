import { BaseMapper } from '../base-mapper';

export const onLoad = async ({
  blocks,
  mapper,
}: {
  blocks: any;
  mapper: BaseMapper;
}): Promise<Array<{ entityName: string; method: string; params: any }>> => {
  try {
    if (!mapper) {
      throw new Error('onLoad() error: mapper is undefined');
    }

    const operations: Array<{ entityName: string; method: string; params: any }> = [];
    const models = [];

    for (const block of blocks) {
      const results = await mapper.onLoad(block);
      Array.isArray(results) ? models.push(...results) : models.push(results);
    }

    models.forEach((model) => {
      const entityName = model.constructor.name;
      const operationsHistory = model.getOperationsHistory();
      for (const operation of operationsHistory) {
        const { method, params } = operation;
        operations.push({ entityName, method, params });
      }

      // IMPORTANT: We clear the operations variable inside the model, manually for now
      model.clearOperationsHistory();
    });

    return operations;
  } catch (error) {
    throw error;
  }
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const onReorganisation = async ({ lightBlocks, mapper }: { lightBlocks: any; mapper: BaseMapper }) => {
  try {
    if (!mapper) {
      throw new Error('onReorganisation() error: mapper is undefined');
    }

    const operations: Array<{ entityName: string; method: string; params: any }> = [];
    const models = [];

    const results = await mapper.onReorganisation(lightBlocks);
    Array.isArray(results) ? models.push(...results) : models.push(results);

    models.forEach((model) => {
      const entityName = model.constructor.name;
      const operationsHistory = model.getOperationsHistory();
      for (const operation of operationsHistory) {
        const { method, params } = operation;
        operations.push({ entityName, method, params });
      }

      // IMPORTANT: We clear the operations variable inside the model, manually for now
      model.clearOperationsHistory();
    });

    return operations;
  } catch (error) {
    throw error;
  }
};
