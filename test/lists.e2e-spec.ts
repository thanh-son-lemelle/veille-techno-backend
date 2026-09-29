import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  SwaggerModule,
  type OpenAPIObject,
  type OperationObject,
  type SchemaObject,
} from '@nestjs/swagger';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types';
import { DataSource, In, QueryRunner, Repository } from 'typeorm';
import { AppModule } from '../src/app.module';
import {
  createDatabaseOptions,
  environmentSchema,
} from '../src/database/database.config';
import { User, UserRole } from '../src/identity/user.entity';
import { List } from '../src/kanban/list.entity';
import { setupSwagger } from '../src/swagger';

function inlineResponseSchema(
  operation: OperationObject | undefined,
  status: string,
) {
  const response = operation?.responses[status];
  expect(response).toBeDefined();
  expect(response).not.toHaveProperty('$ref');
  return response && 'content' in response
    ? response.content?.['application/json']?.schema
    : undefined;
}

function expectListsSwaggerDocument(document: OpenAPIObject, prefix: string) {
  const collection = document.paths[`${prefix}/lists`];
  const item = document.paths[`${prefix}/lists/{id}`];
  const operations = [
    { operation: collection?.get, statuses: ['200', '401'] },
    { operation: collection?.post, statuses: ['201', '400', '401'] },
    { operation: item?.patch, statuses: ['200', '400', '401', '403', '404'] },
    { operation: item?.delete, statuses: ['204', '400', '401', '403', '404'] },
  ];

  for (const { operation, statuses } of operations) {
    expect(operation?.summary).toBeTruthy();
    expect(operation?.summary).not.toMatch(/^\[Non implémentée\]/);
    expect(operation?.security ?? document.security).toContainEqual({
      bearerAuth: [],
    });
    for (const status of statuses) {
      const documented = operation?.responses[status];
      expect(documented).toBeDefined();
      expect(documented).not.toHaveProperty('$ref');
      const content =
        documented && 'content' in documented ? documented.content : undefined;
      if (status === '204') {
        expect(Object.keys(content ?? {})).toEqual([]);
        continue;
      }
      const media = content?.['application/json'];
      expect(media?.schema).toBeDefined();
      expect(media?.example ?? media?.examples).toBeDefined();
    }
  }

  for (const operation of [item?.patch, item?.delete]) {
    expect(operation?.parameters).toContainEqual(
      expect.objectContaining({
        name: 'id',
        in: 'path',
        schema: expect.objectContaining({ type: 'string', format: 'uuid' }),
      }),
    );
  }

  const listSchema = {
    type: 'object',
    required: ['id', 'title', 'position', 'ownerId', 'createdAt'],
    additionalProperties: false,
    properties: {
      id: { type: 'string', format: 'uuid' },
      title: { type: 'string' },
      position: { type: 'integer', format: 'int32' },
      ownerId: { type: 'string', format: 'uuid' },
      createdAt: { type: 'string', format: 'date-time' },
    },
  };
  expect(inlineResponseSchema(collection?.get, '200')).toMatchObject({
    type: 'array',
    items: listSchema,
  });
  for (const operation of [collection?.post, item?.patch]) {
    const status = operation === collection?.post ? '201' : '200';
    expect(inlineResponseSchema(operation, status)).toMatchObject(listSchema);
  }

  for (const [operation, required] of [
    [collection?.post, ['title']],
    [item?.patch, []],
  ] as const) {
    const body = operation?.requestBody;
    expect(body).not.toHaveProperty('$ref');
    const media =
      body && 'content' in body ? body.content['application/json'] : undefined;
    const schema = media?.schema;
    expect(body && 'required' in body ? body.required : undefined).toBe(true);
    expect(media?.examples).toBeDefined();
    expect(schema).not.toHaveProperty('$ref');
    expect(schema).toMatchObject({
      type: 'object',
      additionalProperties: false,
      properties: {
        title: { type: 'string', minLength: 1 },
        position: {
          type: 'integer',
          minimum: -2147483648,
          maximum: 2147483647,
        },
      },
    });
    const inlineSchema: SchemaObject | undefined =
      schema && !('$ref' in schema) ? schema : undefined;
    expect(inlineSchema?.required ?? []).toEqual(required);
    expect(Object.keys(inlineSchema?.properties ?? {}).sort()).toEqual([
      'position',
      'title',
    ]);
  }
}

describe('Lists HTTP (PostgreSQL)', () => {
  let dataSource: DataSource;
  let queryRunner: QueryRunner;
  let app: INestApplication<App>;
  let users: Repository<User>;
  let jwt: JwtService;
  let owner: User;
  let ownerToken: string;
  let testUserIds: string[];
  let testTransactionOpen = false;
  const missingId = randomUUID();

  async function createUser(role: UserRole = UserRole.USER): Promise<User> {
    const user = await users.save(
      users.create({
        email: `${randomUUID()}@example.com`,
        password: 'unused-test-hash',
        name: 'List user',
        role,
      }),
    );
    testUserIds.push(user.id);
    return user;
  }

  async function seedList(user: User, title = 'Todo', position = 1) {
    return queryRunner.manager.getRepository(List).save(
      queryRunner.manager.getRepository(List).create({
        ownerId: user.id,
        title,
        position,
      }),
    );
  }

  async function storedLists() {
    return queryRunner.manager.getRepository(List).find({
      where: { ownerId: In(testUserIds) },
      order: { title: 'ASC' },
    });
  }

  function expectPublicList(body: Record<string, unknown>, list: List) {
    expect(body).toMatchObject({
      id: list.id,
      title: list.title,
      position: list.position,
      ownerId: list.ownerId,
      createdAt: list.createdAt.toISOString(),
    });
    expect(body).not.toHaveProperty('owner');
    expect(body).not.toHaveProperty('password');
    expect(body).not.toHaveProperty('passwordHash');
    expect(body).not.toHaveProperty('email');
  }

  beforeAll(async () => {
    await ConfigModule.forRoot({ envFilePath: '.env' });
    dataSource = new DataSource(
      createDatabaseOptions(
        new ConfigService(environmentSchema.parse(process.env)),
      ),
    );
    await dataSource.initialize();
    queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    users = queryRunner.manager.getRepository(User);

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(getRepositoryToken(User))
      .useValue(users)
      .overrideProvider(getRepositoryToken(List))
      .useValue(queryRunner.manager.getRepository(List))
      .compile();
    app = moduleRef.createNestApplication();
    setupSwagger(app);
    await app.init();
    jwt = app.get(JwtService);
  }, 20000);

  beforeEach(async () => {
    await queryRunner.startTransaction();
    testTransactionOpen = true;
    testUserIds = [];
    owner = await createUser();
    ownerToken = jwt.sign({ sub: owner.id });
  });

  afterEach(async () => {
    if (testTransactionOpen) {
      await queryRunner.rollbackTransaction();
      testTransactionOpen = false;
    }
  });

  afterAll(async () => {
    await app?.close();
    if (queryRunner?.isTransactionActive) {
      await queryRunner.rollbackTransaction();
    }
    await queryRunner?.release();
    await dataSource?.destroy();
  });

  it('uses the user role constraint installed by the real migration', async () => {
    await expect(
      queryRunner.query('UPDATE "users" SET "role" = $1 WHERE "id" = $2', [
        'invalid-role',
        owner.id,
      ]),
    ).rejects.toMatchObject({ code: '22P02' });
  });

  it('GET /api/lists returns an empty array for an owner without lists', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/lists')
      .auth(ownerToken, { type: 'bearer' })
      .expect(200);

    expect(response.body).toEqual([]);
  });

  it('GET /api/lists returns only the caller’s lists in position order', async () => {
    const later = await seedList(owner, 'Later', 2);
    const earlier = await seedList(owner, 'Earlier', 0);
    const other = await createUser();
    await seedList(other, 'Private', -1);

    const response = await request(app.getHttpServer())
      .get('/api/lists')
      .auth(ownerToken, { type: 'bearer' })
      .expect(200);

    expect(response.body).toHaveLength(2);
    expect(response.body.map((list: List) => list.id)).toEqual([
      earlier.id,
      later.id,
    ]);
    expectPublicList(response.body[0], earlier);
    expectPublicList(response.body[1], later);
  });

  it('POST /api/lists trims a title, defaults position to zero, and persists caller ownership', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/lists')
      .auth(ownerToken, { type: 'bearer' })
      .send({ title: '  Inbox  ' })
      .expect(201);

    const [saved] = await storedLists();
    expect(saved).toMatchObject({
      title: 'Inbox',
      position: 0,
      ownerId: owner.id,
    });
    expectPublicList(response.body, saved);
  });

  it.each([-2147483648, 2147483647])(
    'POST /api/lists accepts signed int32 position %i',
    async (position) => {
      const response = await request(app.getHttpServer())
        .post('/api/lists')
        .auth(ownerToken, { type: 'bearer' })
        .send({ title: 'Boundary', position })
        .expect(201);

      expect(response.body.position).toBe(position);
      expect((await storedLists())[0].position).toBe(position);
    },
  );

  it('PATCH /api/lists/:id updates only a supplied title and trims it', async () => {
    const original = await seedList(owner, 'Todo', 7);
    const response = await request(app.getHttpServer())
      .patch(`/api/lists/${original.id}`)
      .auth(ownerToken, { type: 'bearer' })
      .send({ title: '  Doing  ' })
      .expect(200);

    const [saved] = await storedLists();
    expect(saved).toMatchObject({
      id: original.id,
      title: 'Doing',
      position: 7,
      ownerId: owner.id,
      createdAt: original.createdAt,
    });
    expectPublicList(response.body, saved);
  });

  it('PATCH /api/lists/:id preserves title when position is set to zero', async () => {
    const original = await seedList(owner, 'Todo', 5);
    const response = await request(app.getHttpServer())
      .patch(`/api/lists/${original.id}`)
      .auth(ownerToken, { type: 'bearer' })
      .send({ position: 0 })
      .expect(200);

    expect(response.body).toMatchObject({ title: 'Todo', position: 0 });
    expect((await storedLists())[0]).toMatchObject({
      title: 'Todo',
      position: 0,
      ownerId: owner.id,
    });
  });

  it('PATCH /api/lists/:id accepts an empty object as a no-op', async () => {
    const original = await seedList(owner, 'Todo', 5);
    const response = await request(app.getHttpServer())
      .patch(`/api/lists/${original.id}`)
      .auth(ownerToken, { type: 'bearer' })
      .send({})
      .expect(200);

    expectPublicList(response.body, original);
    expect((await storedLists())[0]).toMatchObject({
      id: original.id,
      title: 'Todo',
      position: 5,
      ownerId: owner.id,
      createdAt: original.createdAt,
    });
  });

  it('DELETE /api/lists/:id returns 204 without a body and removes only that list', async () => {
    const removed = await seedList(owner, 'Remove');
    const retained = await seedList(owner, 'Keep');
    const response = await request(app.getHttpServer())
      .delete(`/api/lists/${removed.id}`)
      .auth(ownerToken, { type: 'bearer' })
      .expect(204);

    expect(response.text).toBe('');
    expect((await storedLists()).map((list) => list.id)).toEqual([retained.id]);
  });

  it.each(['get', 'post', 'patch', 'delete'] as const)(
    '%s /api/lists requires a valid current user token',
    async (method) => {
      const list = await seedList(owner);
      const path =
        method === 'get' || method === 'post'
          ? '/api/lists'
          : `/api/lists/${list.id}`;
      const expired = jwt.sign({ sub: owner.id }, { expiresIn: -1 });
      const removedUser = await createUser();
      const removedToken = jwt.sign({ sub: removedUser.id });
      await users.delete(removedUser.id);

      for (const token of [undefined, 'bad-token', expired, removedToken]) {
        const operation = request(app.getHttpServer())[method](path);
        if (token) operation.auth(token, { type: 'bearer' });
        if (method === 'post' || method === 'patch') {
          operation.send({ title: 'No access' });
        }
        await operation.expect(401);
      }

      expect((await storedLists()).map((saved) => saved.id)).toEqual([list.id]);
      expect((await storedLists())[0].title).toBe('Todo');
    },
  );

  it.each(['patch', 'delete'] as const)(
    '%s forbids another owner, including an admin, without changing the list',
    async (method) => {
      const target = await seedList(owner, 'Private', 4);
      const other = await createUser();
      const admin = await createUser(UserRole.ADMIN);

      for (const user of [other, admin]) {
        const operation = request(app.getHttpServer())
          [method](`/api/lists/${target.id}`)
          .auth(jwt.sign({ sub: user.id }), { type: 'bearer' });
        if (method === 'patch') operation.send({ title: 'Stolen' });
        await operation.expect(403);
      }

      expect((await storedLists())[0]).toMatchObject({
        id: target.id,
        title: 'Private',
        position: 4,
        ownerId: owner.id,
      });
    },
  );

  it.each(['patch', 'delete'] as const)(
    '%s returns 404 for an absent UUID and 400 for a malformed UUID',
    async (method) => {
      const absent = request(app.getHttpServer())
        [method](`/api/lists/${missingId}`)
        .auth(ownerToken, { type: 'bearer' });
      if (method === 'patch') {
        absent.send({ title: 'Missing' });
      }
      await absent.expect(404);

      const malformed = request(app.getHttpServer())
        [method]('/api/lists/not-a-uuid')
        .auth(ownerToken, { type: 'bearer' });
      if (method === 'patch') {
        malformed.send({ title: 'Missing' });
      }
      await malformed.expect(400);
      expect(await storedLists()).toEqual([]);
    },
  );

  it.each([
    ['missing title', {}, 'title'],
    ['empty title', { title: '' }, 'title'],
    ['whitespace title', { title: '   ' }, 'title'],
    ['null title', { title: null }, 'title'],
    ['unknown field', { title: 'Todo', extra: true }, 'extra'],
    ['client owner', { title: 'Todo', ownerId: missingId }, 'ownerId'],
    ['client id', { title: 'Todo', id: missingId }, 'id'],
    ['null position', { title: 'Todo', position: null }, 'position'],
    ['fractional position', { title: 'Todo', position: 1.5 }, 'position'],
    [
      'out-of-range position',
      { title: 'Todo', position: 2147483648 },
      'position',
    ],
  ])('POST rejects %s without inserting a row', async (_label, body, field) => {
    const response = await request(app.getHttpServer())
      .post('/api/lists')
      .auth(ownerToken, { type: 'bearer' })
      .send(body)
      .expect(400);

    expect(JSON.stringify(response.body)).toContain(field);
    expect(await storedLists()).toEqual([]);
  });

  it.each([
    ['empty title', { title: '' }, 'title'],
    ['whitespace title', { title: '   ' }, 'title'],
    ['null title', { title: null }, 'title'],
    ['unknown field', { extra: true }, 'extra'],
    ['client owner', { ownerId: missingId }, 'ownerId'],
    ['client id', { id: missingId }, 'id'],
    ['null position', { position: null }, 'position'],
    ['fractional position', { position: 1.5 }, 'position'],
    ['out-of-range position', { position: -2147483649 }, 'position'],
  ])('PATCH rejects %s without changing a row', async (_label, body, field) => {
    const original = await seedList(owner, 'Todo', 3);
    const response = await request(app.getHttpServer())
      .patch(`/api/lists/${original.id}`)
      .auth(ownerToken, { type: 'bearer' })
      .send(body)
      .expect(400);

    expect(JSON.stringify(response.body)).toContain(field);
    expect((await storedLists())[0]).toMatchObject({
      id: original.id,
      title: 'Todo',
      position: 3,
      ownerId: owner.id,
    });
  });

  it('publishes complete List Swagger schemas and examples in Swagger JSON', async () => {
    const response = await request(app.getHttpServer())
      .get('/api-json')
      .expect(200);
    expectListsSwaggerDocument(response.body as OpenAPIObject, '');
  });

  it('generates complete List Swagger documentation from decorators alone', () => {
    const document = SwaggerModule.createDocument(app, {
      openapi: '3.0.0',
      info: { title: 'Lists', version: '1.0.0' },
    });

    expectListsSwaggerDocument(document, '/api');
  });
});
