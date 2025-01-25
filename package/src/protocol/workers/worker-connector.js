const { existsSync } = require('fs');
const { extname } = require('path');
const { workerData } = require('worker_threads');

// IMPORTANT: This is necessary so that the mapper can be both js and ts
require('ts-node').register({ transpileOnly: true });

const { onLoad, onReorganisation } = require('./worker');

// Global variable for storing a single instance of the mapper
let mapperInstance = null;

function checkMapperFile(mapperPath) {
  if (!existsSync(mapperPath)) {
    throw new Error(`Mapper file does not exist: ${mapperPath}`);
  }

  const extension = extname(mapperPath).toLowerCase();
  if (extension !== '.js' && extension !== '.ts') {
    throw new Error(
      `Mapper file "${mapperPath}" has unsupported extension "${extension}". Use .js or .ts.`,
    );
  }
}
(async () => {
    if (mapperInstance) {
      return mapperInstance;
    }

    const { mapperPath } = workerData;
    checkMapperFile(mapperPath);

    // IMPORTANT: Since we are using Commonjs,
    // we need to synchronously connect the Mapper file via require
    const { default: MapperClass } = require(mapperPath);
    mapperInstance = new MapperClass();

})();

module.exports = async (task) => {
  if (task.fn === 'onLoad') {
    const result = await onLoad({
      blocks: task.blocks,
      mapper: mapperInstance,
    });
    return result;
  }

  if (task.fn === 'onReorganisation') {
    const result = await onReorganisation({
      lightBlocks: task.blocks,
      mapper: mapperInstance,
    });
    return result;
  }
};

process.on('SIGTERM', async () => {
  mapperInstance = null;
  process.exit(0);
});

process.on('SIGINT', async () => {
  mapperInstance = null;
  process.exit(0);
});
