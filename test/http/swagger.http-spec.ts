import type { INestApplication } from '@nestjs/common';
import {
  Controller,
  Get,
  Post,
  StandardSchemaValidationPipe,
} from '@nestjs/common';
import type { OpenAPIObject } from '@nestjs/swagger';
import { ApiOperation } from '@nestjs/swagger';
import { Test } from '@nestjs/testing';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import request from 'supertest';
import type { App } from 'supertest/types';
import { parse } from 'yaml';
import { AuthController } from '../../src/identity/controllers/auth.controller';
import { AuthGuard } from '../../src/identity/auth.guard';
import { UsersController } from '../../src/identity/controllers/users.controller';
import { AuthService } from '../../src/identity/services/auth.service';
import { UsersService } from '../../src/identity/services/users.service';
import { setupSwagger } from '../../src/swagger';
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
  @ApiOperation({ summary: 'Récupérer une carte documentée par NestJS' })
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
      'Récupérer une carte documentée par NestJS',
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
      readFileSync(join(__dirname, '..', '..', 'docs', 'openapi.yaml'), 'utf8'),
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
  it('documente la connexion publique et ses réponses 200, 400 et 401', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: { register: jest.fn(), login: jest.fn() },
        },
      ],
    }).compile();
    const swaggerApp = moduleRef.createNestApplication<INestApplication<App>>();

    try {
      setupSwagger(swaggerApp);
      await swaggerApp.init();

      const response = await request(swaggerApp.getHttpServer())
        .get('/api-json')
        .expect(200);
      const document = response.body as OpenAPIObject;
      const operation = document.paths['/auth/login'].post;

      expect(operation).toMatchObject({
        summary: 'Connecter un utilisateur',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                additionalProperties: false,
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string', minLength: 1 },
                },
              },
            },
          },
        },
      });
      expect(Object.keys(operation!.responses).sort()).toEqual([
        '200',
        '400',
        '401',
      ]);
      for (const status of ['200', '400', '401']) {
        expect(operation?.responses[status]).toMatchObject({
          content: {
            'application/json': {
              schema: expect.any(Object),
              example: expect.any(Object),
            },
          },
        });
      }
      expect(operation?.responses['200']).toMatchObject({
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/AuthToken' },
            example: { accessToken: expect.any(String) },
          },
        },
      });
      expect(operation?.responses['401']).toMatchObject({
        content: {
          'application/json': {
            example: {
              statusCode: 401,
              message: 'Identifiants invalides.',
              error: 'Unauthorized',
            },
          },
        },
      });
    } finally {
      await swaggerApp.close();
    }
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

describe('Swagger de modification utilisateur', () => {
  let app: INestApplication<App>;
  let document: OpenAPIObject;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: { update: jest.fn() } }],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new StandardSchemaValidationPipe());
    setupSwagger(app);
    await app.init();
    const response = await request(app.getHttpServer()).get('/api-json').expect(200);
    document = response.body as OpenAPIObject;
  });

  afterAll(async () => {
    await app?.close();
  });

  it('expose la route protégée, le paramètre UUID et un body partiel strict', () => {
    const operation = document.paths['/users/{id}'].patch;

    expect(operation?.summary).not.toMatch(/^\[Non implémentée\]/);
    expect(document.security).toEqual([{ bearerAuth: [] }]);
    expect(operation).toMatchObject({
      tags: ['Users'],
      description: expect.stringContaining('Un non-admin'),
      parameters: expect.arrayContaining([
        expect.objectContaining({
          name: 'id',
          in: 'path',
          required: true,
          schema: expect.objectContaining({ type: 'string', format: 'uuid' }),
        }),
      ]),
      requestBody: {
        content: {
          'application/json': {
            schema: {
              additionalProperties: false,
              properties: {
                name: { type: 'string', minLength: 1 },
                email: { type: 'string', format: 'email' },
                role: { type: 'string', enum: ['user', 'admin'] },
              },
            },
            examples: {
              profil: { value: { name: 'Alice Dupont', email: 'alice.dupont@example.com' } },
              role: { value: { role: 'admin' } },
            },
          },
        },
      },
    });

    const body = operation?.requestBody;
    if (!body || '$ref' in body) throw new Error('Body Swagger manquant');
    const schema = body.content['application/json'].schema;
    if (!schema || '$ref' in schema) throw new Error('Schéma du body manquant');
    expect(schema.required ?? []).toEqual([]);
    expect(Object.keys(schema.properties ?? {}).sort()).toEqual(['email', 'name', 'role']);
  });

  it('documente les six réponses et une représentation publique sans mot de passe', () => {
    const responses = document.paths['/users/{id}'].patch!.responses;
    expect(Object.keys(responses).sort()).toEqual(['200', '400', '401', '403', '404', '409']);

    for (const response of Object.values(responses)) {
      if (!response || '$ref' in response) throw new Error('Réponse Swagger manquante');
      const media = response.content?.['application/json'];
      expect(media?.schema).toBeDefined();
      expect(media?.example ?? media?.examples).toBeDefined();
    }

    expect(responses['200']).toMatchObject({
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/User' },
          example: {
            id: expect.any(String),
            email: expect.any(String),
            name: expect.any(String),
            role: 'user',
            createdAt: expect.any(String),
          },
        },
      },
    });
    const success = responses['200'];
    if (!success || '$ref' in success) throw new Error('Réponse 200 manquante');
    expect(success.content?.['application/json'].example).not.toHaveProperty('password');
    const userSchema = document.components?.schemas?.User;
    if (!userSchema || '$ref' in userSchema) throw new Error('Schéma User manquant');
    expect(Object.keys(userSchema.properties ?? {}).sort()).toEqual([
      'createdAt', 'email', 'id', 'name', 'role',
    ]);
    expect(responses['401']).toMatchObject({
      content: {
        'application/json': {
          schema: { required: ['statusCode', 'message'] },
          example: { statusCode: 401, message: 'Unauthorized' },
        },
      },
    });
  });

  it.each([
    ['identifiant', 'invalide', { name: 'Alice' }],
    ['payload', '550e8400-e29b-41d4-a716-446655440000', { email: 'invalide' }],
  ])('l’exemple 400 %s correspond à la réponse HTTP réelle', async (example, id, body) => {
    const response = await request(app.getHttpServer())
      .patch(`/api/users/${id}`)
      .send(body)
      .expect(400);

    const documented = document.paths['/users/{id}'].patch!.responses['400'];
    if (!documented || '$ref' in documented) throw new Error('Réponse 400 manquante');
    expect(documented.content?.['application/json'].examples?.[example]).toEqual({
      summary: expect.any(String),
      value: response.body,
    });
  });
});
