/* 
  documentation tags: 13d1e363-7d07-4aa0-9fcc-0b30b9fba98a
*/

import { resolve } from 'node:path';
import { writeFileSync, readFileSync, ensureDirSync } from 'fs-extra';
import { Command } from 'commander';
import { targetConstructorToSchema } from 'class-validator-jsonschema';
import * as currentConfigs from '../config';

type ConfigConstructor = new (...args: any[]) => any;

const packageJson = JSON.parse(readFileSync(resolve(__dirname, '../../package.json'), 'utf8'));

const generateSchemaForConfig = (ConfigClass: ConfigConstructor, outputPath: string, name: string) => {
  const schema = targetConstructorToSchema(ConfigClass);

  if (!schema) {
    console.log(`No schema found for ${ConfigClass.name}, skipping.`);
    return;
  }

  // Remove properties without description
  if (schema.properties) {
    Object.keys(schema.properties).forEach((key) => {
      const property = schema.properties?.[key];

      if (property && !('description' in property)) {
        // Remove empty descriptions
        delete schema.properties?.[key];
      }
    });
  }

  // Add title (anme of class)
  schema.title = ConfigClass.name;

  const schemaPath = resolve(outputPath, `config-docs/${name}`, `${ConfigClass.name.toLowerCase()}.json`);
  ensureDirSync(resolve(outputPath, `config-docs/${name}`));
  writeFileSync(schemaPath, JSON.stringify(schema, null, 2));
  console.log(`Documentation generated for ${name} at ${schemaPath}`);
};

const generateConfigDocs = async (outputPath: string) => {
  const name = 'el@bitcoin-loader';
  Object.values(currentConfigs)
    .filter((value) => value instanceof Function)
    .forEach((ConfigClass) => {
      generateSchemaForConfig(ConfigClass as ConfigConstructor, outputPath, name);
    });
};

const command = new Command(packageJson.name);

command
  .version(packageJson.version)
  .argument('[outputPath]', 'Output path for generated documentation', '.')
  .description('Generate JSON documentation files for all configs')
  .action((directory) => {
    generateConfigDocs(directory);
  })
  .parse(process.argv);
