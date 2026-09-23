import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { INestApplication } from '@nestjs/common';
import { SwaggerModule } from '@nestjs/swagger';
import type { OpenAPIObject } from '@nestjs/swagger';
import { parse } from 'yaml';

function operationKey(method: string, path: string): string {
  return `${method.toUpperCase()} ${path.replace(/\{[^}]+\}/g, '{}')}`;
}

export function setupSwagger(app: INestApplication): void {
  // Load the OpenAPI contract
  const contractPath = join(__dirname, '..', 'docs', 'openapi.yaml');
  const document = parse(readFileSync(contractPath, 'utf8')) as OpenAPIObject;

  const apiPrefix = '/api';
  document.servers = [{ url: apiPrefix }];
  // Create a document for the implemented endpoints
  const methods = ['get', 'post', 'patch', 'delete'] as const;
  const implementedDocument = SwaggerModule.createDocument(app, {
    openapi: document.openapi,
    info: document.info,
  });
  const implementedOperations = new Set<string>();

  // Collect all implemented operations
  for (const [path, pathItem] of Object.entries(implementedDocument.paths)) {
    for (const method of methods) {
      if (pathItem[method]) {
        implementedOperations.add(operationKey(method, path));
      }
    }
  }
  // Mark non-implemented operations in the OpenAPI document
  for (const [path, pathItem] of Object.entries(document.paths)) {
    for (const method of methods) {
      const operation = pathItem[method];
      const key = operationKey(method, `${apiPrefix}${path}`);

      if (!operation || implementedOperations.has(key)) {
        continue;
      }

      operation.summary = `[Non implémentée] ${operation.summary ?? `${method.toUpperCase()} ${path}`}`;
    }
  }

  SwaggerModule.setup('api', app, document);
}
