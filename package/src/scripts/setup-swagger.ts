/* 
  documentation tags: 0a870b70-4c9a-4e64-a9b1-d5eb61a025ab
*/

import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { INestApplication } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

export interface DocumentOptions {
  title: string;
  description: string;
  port?: number;
  defaultModelsExpandDepth?: number;
}

const packageJson = JSON.parse(readFileSync(resolve(__dirname, '../../package.json'), 'utf8'));

export const setupSwaggerServer = (app: INestApplication, documentOptions: DocumentOptions): void => {
  const { title, description, port, defaultModelsExpandDepth } = documentOptions;

  const options = new DocumentBuilder()
    .setTitle(title)
    .setDescription(description)
    .setVersion(packageJson?.version)
    .addServer('http://localhost:{port}', 'Local Development Server', {
      port: {
        default: port || 3000,
        description: 'Local Server Port',
      },
    })
    .build();

  const document = SwaggerModule.createDocument(app, options);
  SwaggerModule.setup('api-docs', app, document, {
    swaggerOptions: { defaultModelsExpandDepth: defaultModelsExpandDepth || 3 },
    explorer: true,
  });
};
