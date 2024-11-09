/* 
  documentation tags: 9e6d397d-1a38-42fe-869b-447e1e0276b3
*/
import { resolve } from 'node:path';
import { writeFileSync, readFileSync, ensureDirSync } from 'fs-extra';
import { Command } from 'commander';
import { NestFactory } from '@nestjs/core';
import { DynamicModule } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { BitcoinLoaderModule } from '../loader.module';
import { ILoaderMapper, BaseViewModel } from '../protocol';

interface GenerateDocOptions {
  title: string;
  name: string;
  version: string;
  outputPath: string;
  module: DynamicModule;
}

class Mapper implements ILoaderMapper {
  onLoad(data: any): Promise<BaseViewModel | BaseViewModel[]> {
    return { data } as any;
  }

  onReorganisation(data: any): Promise<BaseViewModel | BaseViewModel[]> {
    return { data } as any;
  }
}

const packageJson = JSON.parse(readFileSync(resolve(__dirname, '../../package.json'), 'utf8'));

const generateDoc = async ({ title, name, version, outputPath, module }: GenerateDocOptions) => {
  const app = await NestFactory.create(module, { logger: false });

  const config = new DocumentBuilder()
    .setTitle(title)
    .setDescription('')
    .setVersion(version)
    // .addTag(name)
    .build();

  const document = SwaggerModule.createDocument(app, config);

  // Using the updated name for the file path
  const docsPath = resolve(outputPath, `api-docs`, `${name}_${version}.json`);

  ensureDirSync(resolve(outputPath, `api-docs`));
  writeFileSync(docsPath, JSON.stringify(document, null, 2));
  console.log(`Documentation for ${name} generated at ${docsPath}!`);
};

const generateAPIDocs = async (outputPath: string) => {
  try {
    const rootModule = await BitcoinLoaderModule.register({
      appName: 'api-docs', // IMPORTANT: 'api-docs' its  key for gitignore app folder
      mapper: Mapper,
      schemas: [],
    });

    await generateDoc({
      title: 'Bitcoin Loader',
      name: 'el@bitcoin-loader',
      version: packageJson.version,
      outputPath,
      module: rootModule,
    });
  } catch (error) {
    console.error(error);
    process.exit(1);
  }

  process.exit(0);
};

const command = new Command(packageJson.name);

command
  .version(packageJson.version)
  .argument('[outputPath]', 'Output path for generated documentation', '.')
  .description('generate swagger docs files for all apis')
  .action((directory) => {
    console.log('directory', directory);
    generateAPIDocs(directory);
  })
  .parse(process.argv);
