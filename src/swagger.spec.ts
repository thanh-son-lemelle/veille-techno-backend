import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Controller, Get, Post } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { OpenAPIObject } from '@nestjs/swagger';
import request from 'supertest';
import type { App } from 'supertest/types';
import { parse } from 'yaml';
import { setupSwagger } from './swagger';
import { AuthController } from './identity/auth.controller';
import { AuthService } from './identity/auth.service';
// Test controller for Swagger route detection
@Controller()
class TestController {
  @Post('auth/register')
  register() {
    return {};
  }

  @Get('auth/login')
  login() {
    return {};
  }

  @Get('cards/:cardId')
  getCard() {
    return {};
  }
}
// Test suite for Swagger route detection
describe('Swagger route detection', () => {
  let app: INestApplication<App>;
  // Initialize the NestJS application before each test
  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [TestController],
    }).compile();
    app = module.createNestApplication();
  });
  // Close the NestJS application after each test
  afterEach(async () => {
    await app.close();
  });
  // Helper function to retrieve the OpenAPI document with a given API prefix
  async function getDocument(prefix: string): Promise<OpenAPIObject> {
    app.setGlobalPrefix(prefix);
    setupSwagger(app);
    await app.init();
    const response = await request(app.getHttpServer())
      .get('/api-json')
      .expect(200);
    return response.body as OpenAPIObject;
  }
  // Test cases for Swagger route detection
  it('detects a mounted operation with the API prefix', async () => {
    const document = await getDocument('api');

    expect(document.paths['/auth/register'].post?.summary).toBe(
      'Inscrire un nouvel utilisateur',
    );
  });
  // Test for absent methods on existing paths
  it('keeps an absent method marked even when the path exists', async () => {
    const document = await getDocument('api');

    expect(document.paths['/auth/login'].post?.summary).toMatch(
      /^\[Non implémentée\]/,
    );
    expect(document.paths['/lists'].get?.summary).toMatch(
      /^\[Non implémentée\]/,
    );
  });
  // Test for path parameters matching regardless of their names
  it('matches path parameters regardless of their names', async () => {
    const document = await getDocument('api');

    expect(document.paths['/cards/{id}'].get?.summary).toBe(
      'Récupérer une carte',
    );
    expect(document.paths['/cards/{id}'].delete?.summary).toMatch(
      /^\[Non implémentée\]/,
    );
  });

  // Test for routes exposed outside the contract API prefix
  it('does not match a route exposed outside the contract API prefix', async () => {
    const document = await getDocument('');

    expect(document.paths['/auth/register'].post?.summary).toMatch(
      /^\[Non implémentée\]/,
    );
  });
  // Test for serving the whole contract and Swagger UI
  it('serves the whole contract and Swagger UI', async () => {
    const document = await getDocument('api');
    const contract = parse(
      readFileSync(join(__dirname, '..', 'docs', 'openapi.yaml'), 'utf8'),
    ) as OpenAPIObject;

    expect(Object.keys(document.paths)).toEqual(Object.keys(contract.paths));
    for (const path of Object.keys(contract.paths)) {
      expect(Object.keys(document.paths[path])).toEqual(
        Object.keys(contract.paths[path]),
      );
    }
    // Preserve the contract's reusable components
    expect(document.components).toEqual(contract.components);
    // Preserve the contract's global security requirements
    expect(document.security).toEqual(contract.security);
    // Use the local API prefix as the Swagger server URL
    expect(document.servers).toEqual([{ url: '/api' }]);
    await request(app.getHttpServer())
      .get('/api')
      .expect(200)
      .expect(/Swagger UI/);
  });
  it('expose le schéma Zod et les exemples des réponses d’inscription', async () => {
  const moduleRef = await Test.createTestingModule({
    controllers: [AuthController],
    providers: [
      {
        provide: AuthService,
        useValue: { register: jest.fn() },
      },
    ],
  }).compile();

  const swaggerApp = moduleRef.createNestApplication<INestApplication<App>>();

  try {
    // Le vrai contrôleur contient déjà le préfixe api/auth.
    setupSwagger(swaggerApp);
    await swaggerApp.init();

    const response = await request(swaggerApp.getHttpServer())
      .get('/api-json')
      .expect(200);

    const document = response.body as OpenAPIObject;
    const operation = document.paths['/auth/register'].post;

    expect(operation).toMatchObject({
      security: [],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              additionalProperties: false,
              required: expect.arrayContaining(['email', 'password', 'name']),
              properties: {
                email: { format: 'email' },
                password: { minLength: 8, maxLength: 24 },
                name: { minLength: 1 },
              },
            },
          },
        },
      },
    });

    for (const status of ['201', '400', '409']) {
      expect(operation?.responses[status]).toMatchObject({
        content: {
          'application/json': {
            schema: expect.any(Object),
            example: expect.any(Object),
          },
        },
      });
    }

    expect(operation?.responses['400']).not.toHaveProperty('$ref');

    expect(operation?.responses['201']).toMatchObject({
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/User' },
        },
      },
    });
  } finally {
    await swaggerApp.close();
  }
  });
});
