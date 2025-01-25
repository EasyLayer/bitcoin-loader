import { join } from 'node:path';
import Piscina from 'piscina';
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { AppLogger } from '@easylayer/components/logger';
import { BusinessConfig } from '../../config';

@Injectable()
export class ProtocolWorkerService implements OnModuleDestroy {
  private _mapperPath: string;
  private _workerPool!: Piscina;

  constructor(
    private readonly log: AppLogger,
    private readonly businessConfig: BusinessConfig,
    mapperPath: string
  ) {
    this._mapperPath = mapperPath;
    this._workerPool = new Piscina({
      filename: join(__dirname, './worker-connector.js'),
      minThreads: this.businessConfig.BITCOIN_LOADER_PROTOCOL_PROCESSING_WORKERS_COUNT,
      maxThreads: this.businessConfig.BITCOIN_LOADER_PROTOCOL_PROCESSING_WORKERS_COUNT,
      workerData: {
        mapperPath: this._mapperPath,
      },
    });
  }

  public get mapperPath(): string {
    return this._mapperPath;
  }

  async onModuleDestroy() {
    if (this._workerPool) {
      await this._workerPool.destroy();
    }
  }

  async calculateOnLoadOperations(blocks: any[]) {
    const count = this._workerPool?.options?.maxThreads || 1;
    const chunks = this.splitBlocks(blocks, count);

    const promises = chunks.map((chunk) => {
      return this._workerPool.run({
        fn: 'onLoad',
        blocks: chunk,
        mapperPath: this.mapperPath,
      });
    });

    const results = await Promise.all(promises);
    const operations = results.flat();
    return operations;
  }

  async calculateOnReorganisationOperations(blocks: any[]) {
    return await this._workerPool.run({
      fn: 'onReorganisation',
      blocks,
      mapperPath: this.mapperPath,
    });
  }

  private splitBlocks<T>(blocks: T[], count: number): T[][] {
    const totalBlocks = blocks.length;

    // Prevent parts from exceeding the number of blocks
    const actualParts = Math.min(count, totalBlocks);
    const result: T[][] = [];

    if (actualParts === 0) {
      // Return empty array if there are no blocks
      return result;
    }

    const blocksPerPart = Math.floor(totalBlocks / actualParts);
    const remainder = totalBlocks % actualParts;

    let startIndex = 0;

    for (let i = 0; i < actualParts; i++) {
      // Distribute the remainder among the first 'remainder' parts
      const currentPartSize = blocksPerPart + (i < remainder ? 1 : 0);
      const endIndex = startIndex + currentPartSize;
      const chunk = blocks.slice(startIndex, endIndex);

      if (chunk.length > 0) {
        result.push(chunk);
      }

      startIndex = endIndex;
    }

    return result;
  }

  private splitBlocksBySize<T extends { size: number }>(
    blocks: T[],
    maxChunkSize: number // iteratorBatch / workers count
  ): T[][] {
    const result: T[][] = [];
    let currentChunk: T[] = [];
    let currentSize = 0;

    for (const block of blocks) {
      // If the current block exceeds the maximum chunk size, add it as a separate chunk
      if (block.size > maxChunkSize) {
        if (currentChunk.length > 0) {
          result.push(currentChunk);
          currentChunk = [];
          currentSize = 0;
        }
        result.push([block]);
        continue;
      }

      // If adding the current block exceeds the limit, push the current chunk and start a new one
      if (currentSize + block.size > maxChunkSize) {
        if (currentChunk.length > 0) {
          result.push(currentChunk);
        }
        currentChunk = [block];
        currentSize = block.size;
      } else {
        // Add the block to the current chunk
        currentChunk.push(block);
        currentSize += block.size;
      }
    }

    // Add the last chunk if it's not empty
    if (currentChunk.length > 0) {
      result.push(currentChunk);
    }

    return result;
  }
}
