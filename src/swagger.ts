import type { INestApplication } from '@nestjs/common';
import type { OpenAPIObject, OperationObject } from '@nestjs/swagger';
import { SwaggerModule } from '@nestjs/swagger';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
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
  const implementedOperations = new Map<string, OperationObject>();

  // Collect all implemented operations
  for (const [path, pathItem] of Object.entries(implementedDocument.paths)) {
      for (const method of methods) {
        const operation = pathItem[method];

        if (operation) {
          implementedOperations.set(operationKey(method, path), operation);
        }
      }
    }
  // Mark non-implemented operations in the OpenAPI document
  for (const [path, pathItem] of Object.entries(document.paths)) {
    for (const method of methods) {
      const operation = pathItem[method];

      if (!operation) {
        continue;
      }

      const generated = implementedOperations.get(
        operationKey(method, `${apiPrefix}${path}`),
      );
      // If the operation is not implemented, mark it as non-implemented
      if (!generated) {
        operation.summary =
          `[Non implémentée] ${operation.summary ?? `${method.toUpperCase()} ${path}`}`;
        continue;
      }

      if (generated.requestBody) {
        operation.requestBody = generated.requestBody;
      }
      // Merge responses from the implemented operation
      for (const [status, response] of Object.entries(generated.responses)) {
        if (!response) {
          continue;
        }

        const existing = operation.responses[status];
        // If there is no existing response or if either the existing or new response is a $ref, replace it entirely
        if (!existing || '$ref' in existing || '$ref' in response) {
          operation.responses[status] = response;
          continue;
        }
        // Otherwise, merge the existing and new response objects
        operation.responses[status] = {
          ...existing,
          ...response,
          description: response.description || existing.description,
          content: {
            ...existing.content,
            ...response.content,
          },
        };
      }
    }
  }
  document.components = {
    ...document.components,
    schemas: {
      ...document.components?.schemas,
      ...implementedDocument.components?.schemas,
    },
  };
  SwaggerModule.setup('api', app, document);
}