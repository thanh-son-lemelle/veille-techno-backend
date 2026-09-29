import {
  StandardSchemaValidationPipe,
  type INestApplication,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  SwaggerModule,
  type OpenAPIObject,
  type ReferenceObject,
  type RequestBodyObject,
  type ResponseObject,
  type SchemaObject,
} from '@nestjs/swagger';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types';
import { setupSwagger } from '../../src/swagger';
import { KanbanModule } from '../../src/kanban/kanban.module';

type StoredRow = {
  id: string;
  title: string;
  position: number;
  createdAt: Date;
  updatedAt?: Date;
  ownerId?: string;
  listId?: string;
  description?: string;
};

// Replace database I/O only: real repositories still construct every query.
function memoryRepository(defaults: Partial<StoredRow>, timestamps = false) {
  const rows = new Map<string, StoredRow>();
  let clock = Date.parse('2026-09-27T10:00:00.000Z');
  return {
    rows,
    create: (input: Partial<StoredRow>) => ({ ...input }),
    save(input: Partial<StoredRow>) {
      const previous = input.id ? rows.get(input.id) : undefined;
      if (
        previous &&
        Object.entries(input).every(
          ([key, value]) =>
            value === undefined || previous[key as keyof StoredRow] === value,
        )
      ) {
        return { ...previous };
      }
      const now = new Date(clock++);
      const row = {
        ...defaults,
        ...Object.fromEntries(
          Object.entries(input).filter(([, value]) => value !== undefined),
        ),
        id: input.id ?? randomUUID(),
        createdAt: previous?.createdAt ?? now,
        ...(timestamps ? { updatedAt: now } : {}),
      } as StoredRow;
      rows.set(row.id, { ...row });
      return { ...row };
    },
    findOneBy({ id }: { id: string }) {
      const row = rows.get(id);
      return row ? { ...row } : null;
    },
    find({
      where,
      order,
    }: {
      where: Partial<StoredRow>;
      order: Record<string, 'ASC' | 'DESC'>;
    }) {
      return [...rows.values()]
        .filter((row) =>
          Object.entries(where).every(
            ([key, value]) => row[key as keyof StoredRow] === value,
          ),
        )
        .sort((left, right) => {
          for (const [key, direction] of Object.entries(order)) {
            const a = left[key as keyof StoredRow]!;
            const b = right[key as keyof StoredRow]!;
            const comparison = a < b ? -1 : a > b ? 1 : 0;
            if (comparison)
              return direction === 'ASC' ? comparison : -comparison;
          }
          return 0;
        })
        .map((row) => ({ ...row }));
    },
    delete(id: string) {
      return { affected: rows.delete(id) ? 1 : 0 };
    },
  };
}

describe('Kanban card routes', () => {
  let app: INestApplication<App>;
  const secret = 'kanban-tests-secret-at-least-32-characters';
  const jwt = new JwtService({ secret });
  const ownerId = randomUUID();
  const otherId = randomUUID();
  const adminId = randomUUID();
  const users = new Map<string, { id: string; role: string }>([
    [ownerId, { id: ownerId, role: 'user' }],
    [otherId, { id: otherId, role: 'user' }],
    [adminId, { id: adminId, role: 'admin' }],
  ]);
  const lists = memoryRepository({ position: 0 });
  const cards = memoryRepository({ position: 0, description: '' }, true);
  let listId: string;
  let targetListId: string;
  let otherListId: string;

  function token(userId = ownerId) {
    return jwt.sign({ sub: userId }, { expiresIn: '1h' });
  }
  function api(
    method: 'get' | 'post' | 'patch' | 'delete',
    path: string,
    userId = ownerId,
  ) {
    return request(app.getHttpServer())
      [method](path)
      .auth(token(userId), { type: 'bearer' });
  }
  async function createList(title: string, userId = ownerId): Promise<string> {
    const response = await api('post', '/api/lists', userId)
      .send({ title })
      .expect(201);
    return response.body.id as string;
  }
  async function createCard(
    input: Record<string, unknown> = { title: 'Carte' },
    parentId = listId,
    userId = ownerId,
  ) {
    const response = await api('post', `/api/lists/${parentId}/cards`, userId)
      .send(input)
      .expect(201);
    return response.body as Record<string, unknown> & { id: string };
  }

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          skipProcessEnv: true,
          load: [() => ({ JWT_SECRET: secret })],
        }),
        KanbanModule,
      ],
    })
      .overrideProvider('ListRepository')
      .useValue(lists)
      .overrideProvider('UserRepository')
      .useValue({
        findOne: ({ where }: { where: { id: string } }) =>
          users.get(where.id) ?? null,
      })
      .overrideProvider('CardRepository')
      .useValue(cards)
      .compile();
    app = module.createNestApplication();
    app.useGlobalPipes(new StandardSchemaValidationPipe());
    setupSwagger(app);
    await app.init();
  });

  beforeEach(async () => {
    lists.rows.clear();
    cards.rows.clear();
    listId = await createList('À faire');
    targetListId = await createList('Terminé');
    otherListId = await createList('Privé', otherId);
  });
  afterAll(async () => {
    await app?.close();
  });

  const routes = [
    ['get', '/api/lists/:listId/cards'],
    ['post', '/api/lists/:listId/cards'],
    ['get', '/api/cards/:id'],
    ['patch', '/api/cards/:id'],
    ['delete', '/api/cards/:id'],
  ] as const;

  it.each(routes)(
    '%s %s requires a valid JWT before accessing data',
    async (method, pattern) => {
      const path = pattern
        .replace(':listId', listId)
        .replace(':id', randomUUID());
      const invalidTokens = [
        undefined,
        'not-a-jwt',
        jwt.sign({ sub: ownerId }, { expiresIn: -1 }),
        new JwtService({ secret: 'wrong-secret' }).sign(
          { sub: ownerId },
          { expiresIn: '1h' },
        ),
        jwt.sign({ sub: randomUUID() }, { expiresIn: '1h' }),
      ];
      for (const invalidToken of invalidTokens) {
        const call = request(app.getHttpServer())[method](path);
        if (invalidToken) call.auth(invalidToken, { type: 'bearer' });
        if (method === 'post' || method === 'patch')
          call.send({ title: 'Test' });
        await call.expect(401);
      }
    },
  );

  it.each(routes)(
    '%s %s rejects invalid UUID parameters',
    async (method, pattern) => {
      const path = pattern
        .replace(':listId', 'invalid')
        .replace(':id', 'invalid');
      const call = api(method, path);
      if (method === 'post' || method === 'patch') call.send({ title: 'Test' });
      await call.expect(400);
    },
  );

  it('creates a trimmed card with defaults and exposes only public card fields', async () => {
    const card = await createCard({ title: '  Une carte  ' });
    expect(card).toEqual({
      id: expect.any(String),
      title: 'Une carte',
      description: '',
      position: 0,
      listId,
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });
    expect(Number.isNaN(Date.parse(card.createdAt as string))).toBe(false);
    expect(Number.isNaN(Date.parse(card.updatedAt as string))).toBe(false);
    await api('get', `/api/cards/${card.id}`).expect(200).expect(card);
  });

  it('returns an empty array for an owned list without cards', async () => {
    await api('get', `/api/lists/${listId}/cards`).expect(200).expect([]);
  });

  it('scopes the ordered card list to its parent list', async () => {
    const last = await createCard({ title: 'Dernière', position: 9 });
    const first = await createCard({ title: 'Première', position: -1 });
    const tied = await createCard({ title: 'Deuxième', position: -1 });
    await createCard({ title: 'Autre liste' }, targetListId);
    await createCard({ title: 'Autre propriétaire' }, otherListId, otherId);
    await api('get', `/api/lists/${listId}/cards`)
      .expect(200)
      .expect([first, tied, last]);
  });

  it('persists partial updates and leaves omitted fields intact', async () => {
    const original = await createCard({
      title: 'Initiale',
      description: 'Détail',
      position: 2,
    });
    const response = await api('patch', `/api/cards/${original.id}`)
      .send({ title: '  Modifiée  ', position: -2147483648 })
      .expect(200);
    expect(response.body).toEqual({
      ...original,
      title: 'Modifiée',
      position: -2147483648,
      updatedAt: expect.any(String),
    });
    expect(Date.parse(response.body.updatedAt)).toBeGreaterThan(
      Date.parse(original.updatedAt as string),
    );
    await api('get', `/api/cards/${original.id}`)
      .expect(200)
      .expect(response.body);
    const cleared = await api('patch', `/api/cards/${original.id}`)
      .send({ description: '', position: 2147483647 })
      .expect(200);
    expect(cleared.body).toMatchObject({
      description: '',
      position: 2147483647,
      title: 'Modifiée',
    });
  });

  it('accepts an empty PATCH without changing card fields', async () => {
    const original = await createCard({
      title: 'Initiale',
      description: 'Détail',
      position: 2,
    });
    await api('patch', `/api/cards/${original.id}`)
      .send({})
      .expect(200)
      .expect(original);
    await api('get', `/api/cards/${original.id}`).expect(200).expect(original);
  });

  it('moves a card between owned lists and persists its new membership', async () => {
    const card = await createCard({
      title: 'À déplacer',
      description: 'Conservé',
      position: 3,
    });
    const response = await api('patch', `/api/cards/${card.id}`)
      .send({ listId: targetListId })
      .expect(200);
    expect(response.body).toEqual({
      ...card,
      listId: targetListId,
      updatedAt: expect.any(String),
    });
    await api('get', `/api/cards/${card.id}`).expect(200).expect(response.body);
    await api('get', `/api/lists/${listId}/cards`).expect(200).expect([]);
    await api('get', `/api/lists/${targetListId}/cards`)
      .expect(200)
      .expect([response.body]);
  });

  it('deletes a card with 204 and removes it from subsequent reads', async () => {
    const card = await createCard();
    const response = await api('delete', `/api/cards/${card.id}`).expect(204);
    expect(response.text).toBe('');
    await api('get', `/api/cards/${card.id}`).expect(404);
    await api('get', `/api/lists/${listId}/cards`).expect(200).expect([]);
    await api('delete', `/api/cards/${card.id}`).expect(404);
  });

  it.each(routes)(
    '%s %s returns 404 for missing resources',
    async (method, pattern) => {
      const path = pattern
        .replace(':listId', randomUUID())
        .replace(':id', randomUUID());
      const call = api(method, path);
      if (method === 'post' || method === 'patch') call.send({ title: 'Test' });
      await call.expect(404);
    },
  );

  it.each([
    ['another user', otherId],
    ['an administrator', adminId],
  ])(
    'denies all card operations to %s without changing the card',
    async (_label, callerId) => {
      const card = await createCard();
      for (const [method, pattern] of routes) {
        const path = pattern.replace(':listId', listId).replace(':id', card.id);
        const call = api(method, path, callerId);
        if (method === 'post' || method === 'patch')
          call.send({ title: 'Intrusion' });
        await call.expect(403);
      }
      await api('get', `/api/cards/${card.id}`).expect(200).expect(card);
      await api('get', `/api/lists/${listId}/cards`).expect(200).expect([card]);
    },
  );

  it('checks source ownership before moving a foreign card into an owned list', async () => {
    const card = await createCard({ title: 'Privée' }, otherListId, otherId);
    await api('patch', `/api/cards/${card.id}`)
      .send({ title: 'Volée', listId, position: 20 })
      .expect(403);
    await api('get', `/api/cards/${card.id}`, otherId).expect(200).expect(card);
    await api('get', `/api/lists/${listId}/cards`).expect(200).expect([]);
  });

  it('rejects a foreign destination before persisting any partial update', async () => {
    const card = await createCard({
      title: 'Originale',
      description: 'Détail',
      position: 4,
    });
    await api('patch', `/api/cards/${card.id}`)
      .send({
        title: 'Interdit',
        description: 'Perdu',
        position: 7,
        listId: otherListId,
      })
      .expect(403);
    await api('get', `/api/cards/${card.id}`).expect(200).expect(card);
    await api('get', `/api/lists/${listId}/cards`).expect(200).expect([card]);
    await api('get', `/api/lists/${otherListId}/cards`, otherId)
      .expect(200)
      .expect([]);
  });

  it('rejects a missing destination without persisting other supplied fields', async () => {
    const card = await createCard();
    await api('patch', `/api/cards/${card.id}`)
      .send({ title: 'Perdue', listId: randomUUID() })
      .expect(404);
    await api('get', `/api/cards/${card.id}`).expect(200).expect(card);
  });

  const invalidFields = [
    { title: '' },
    { title: '   ' },
    { title: null },
    { title: 10 },
    { description: null },
    { description: 10 },
    { position: null },
    { position: '1' },
    { position: 1.5 },
    { position: -2147483649 },
    { position: 2147483648 },
    { unknown: true },
    { ownerId: otherId },
  ];
  it.each(invalidFields)(
    'rejects invalid creation fields %j without creating a card',
    async (input) => {
      await api('post', `/api/lists/${listId}/cards`)
        .send({ title: 'Valide', ...input })
        .expect(400);
      await api('get', `/api/lists/${listId}/cards`).expect(200).expect([]);
    },
  );
  it('requires a title on creation and disallows choosing listId in the body', async () => {
    await api('post', `/api/lists/${listId}/cards`).send({}).expect(400);
    await api('post', `/api/lists/${listId}/cards`)
      .send({ title: 'Carte', listId: targetListId })
      .expect(400);
  });
  it.each([
    ...invalidFields,
    { listId: null },
    { listId: 'invalid' },
    { listId: 1 },
  ])(
    'rejects invalid update fields %j without modifying the card',
    async (input) => {
      const card = await createCard();
      await api('patch', `/api/cards/${card.id}`).send(input).expect(400);
      await api('get', `/api/cards/${card.id}`).expect(200).expect(card);
    },
  );

  it('keeps list fixtures private and allows their owner to update and delete them', async () => {
    const ownLists = await api('get', '/api/lists').expect(200);
    expect(ownLists.body.map((list: { id: string }) => list.id)).toEqual([
      listId,
      targetListId,
    ]);
    await api('get', '/api/lists', adminId).expect(200).expect([]);
    const updated = await api('patch', `/api/lists/${listId}`)
      .send({ title: '  En cours  ', position: 2 })
      .expect(200);
    expect(updated.body).toMatchObject({
      id: listId,
      title: 'En cours',
      position: 2,
      ownerId,
    });
    await api('patch', `/api/lists/${listId}`)
      .send({})
      .expect(200)
      .expect(updated.body);
    await api('patch', `/api/lists/${otherListId}`)
      .send({ title: 'Refus' })
      .expect(403);
    await api('delete', `/api/lists/${otherListId}`).expect(403);
    await api('patch', `/api/lists/${randomUUID()}`)
      .send({ title: 'Absente' })
      .expect(404);
    await api('delete', `/api/lists/${randomUUID()}`).expect(404);
    await api('delete', `/api/lists/${targetListId}`).expect(204);
    await api('get', `/api/lists/${targetListId}/cards`).expect(404);
  });

  it.each(['controller decorators', 'served API document'] as const)(
    'documents all five card routes using %s',
    async (source) => {
      const generated = source === 'controller decorators';
      const document = generated
        ? SwaggerModule.createDocument(app, {
            openapi: '3.0.0',
            info: { title: 'Card documentation test', version: '1.0' },
          })
        : ((await request(app.getHttpServer()).get('/api-json').expect(200))
            .body as OpenAPIObject);
      const prefix = generated ? '/api' : '';
      const cardSchema = {
        type: 'object',
        required: expect.arrayContaining([
          'id',
          'title',
          'description',
          'position',
          'listId',
          'createdAt',
          'updatedAt',
        ]),
        properties: {
          id: { type: 'string', format: 'uuid' },
          title: { type: 'string' },
          description: { type: 'string' },
          position: { type: 'integer' },
          listId: { type: 'string', format: 'uuid' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      };
      const operations = [
        ['/lists/{listId}/cards', 'get', '200'],
        ['/lists/{listId}/cards', 'post', '201'],
        ['/cards/{id}', 'get', '200'],
        ['/cards/{id}', 'patch', '200'],
        ['/cards/{id}', 'delete', '204'],
      ] as const;
      function resolveResponse(
        value: ResponseObject | ReferenceObject,
      ): ResponseObject {
        return '$ref' in value
          ? (document.components!.responses![
              value.$ref.split('/').pop()!
            ] as ResponseObject)
          : value;
      }
      for (const [path, method, success] of operations) {
        const operation = document.paths[`${prefix}${path}`][method]!;
        expect(operation.summary).toBeTruthy();
        expect(operation.summary).not.toMatch(/^\[Non implémentée\]/);
        expect(operation.description).toBeTruthy();
        expect(operation.security ?? document.security).toContainEqual({
          bearerAuth: [],
        });
        expect(operation.parameters).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              name: path.includes('{listId}') ? 'listId' : 'id',
              in: 'path',
              required: true,
              description: expect.any(String),
              schema: expect.objectContaining({
                type: 'string',
                format: 'uuid',
                example: expect.stringMatching(
                  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
                ),
              }),
            }),
          ]),
        );
        for (const status of [success, '400', '401', '403', '404']) {
          expect(operation.responses[status]).toBeDefined();
          const result = resolveResponse(operation.responses[status]!);
          expect(result.description).toBeTruthy();
          if (status === '204') {
            expect(Object.keys(result.content ?? {})).toHaveLength(0);
          } else {
            const media = result.content?.['application/json'];
            expect(media?.schema).toBeDefined();
            expect(media?.example ?? media?.examples).toBeDefined();
            if (status === success) {
              expect(media?.schema).toMatchObject(
                method === 'get' && path.includes('{listId}')
                  ? { type: 'array', items: cardSchema }
                  : cardSchema,
              );
            }
          }
        }
      }
      for (const [path, method] of [
        ['/lists/{listId}/cards', 'post'],
        ['/cards/{id}', 'patch'],
      ] as const) {
        const body = document.paths[`${prefix}${path}`][method]
          ?.requestBody as RequestBodyObject;
        const media = body.content['application/json'];
        const schema = media.schema as SchemaObject;
        expect(media.example ?? media.examples).toBeDefined();
        expect(schema).toMatchObject({
          type: 'object',
          additionalProperties: false,
          properties: {
            title: { type: 'string', minLength: 1 },
            description: { type: 'string' },
            position: {
              type: 'integer',
              minimum: -2147483648,
              maximum: 2147483647,
            },
          },
        });
        expect(Object.keys(schema.properties!).sort()).toEqual(
          (method === 'post'
            ? ['title', 'description', 'position']
            : ['title', 'description', 'position', 'listId']
          ).sort(),
        );
        expect(schema.required ?? []).toEqual(
          method === 'post' ? ['title'] : [],
        );
        if (method === 'patch') {
          expect(schema.properties?.listId).toMatchObject({
            type: 'string',
            format: 'uuid',
          });
        }
      }
    },
  );
});
