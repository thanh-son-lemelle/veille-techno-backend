import {
  StandardSchemaValidationPipe,
  type INestApplication,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as argon2 from 'argon2';
import request from 'supertest';
import type { App } from 'supertest/types';
import { environmentSchema } from '../../../src/database/database.config';
import { IdentityModule } from '../../../src/identity/identity.module';
import { User, UserRole } from '../../../src/identity/user.entity';

describe('Connexion HTTP', () => {
  let app: INestApplication<App>;
  let user: User;
  const findOne = jest.fn();
  const secret = 'secret-de-test-uniquement-32-caracteres';
  const credentials = {
    email: 'alice@example.com',
    password: 'MotDePasse123!',
  };

  function createModule(jwtSecret: string | undefined) {
    return Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          ignoreEnvVars: true,
          skipProcessEnv: true,
          load: [
            () =>
              environmentSchema
                .pick({ JWT_SECRET: true })
                .parse({ JWT_SECRET: jwtSecret }),
          ],
        }),
        IdentityModule,
      ],
    })
      .overrideProvider(getRepositoryToken(User))
      .useValue({ findOne })
      .compile();
  }

  beforeAll(async () => {
    user = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      ...credentials,
      password: await argon2.hash(credentials.password),
      name: 'Alice',
      role: UserRole.USER,
      createdAt: new Date(),
    };
    const moduleRef = await createModule(secret);
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new StandardSchemaValidationPipe());
    await app.init();
  });

  beforeEach(() => {
    findOne.mockReset().mockResolvedValue(user);
  });

  afterAll(async () => {
    await app?.close();
  });

  it('200 : émet un JWT signé limité à sub, iat et exp, valable une heure', async () => {
    const before = Math.floor(Date.now() / 1000);
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send(credentials)
      .expect(200);

    expect(response.body).toEqual({ accessToken: expect.any(String) });
    const jwt = new JwtService({ secret });
    const payload = jwt.verify<{ sub: string; iat: number; exp: number }>(
      response.body.accessToken as string,
      { algorithms: ['HS256'] },
    );
    expect(payload).toEqual({
      sub: user.id,
      iat: expect.any(Number),
      exp: expect.any(Number),
    });
    expect(payload.iat).toBeGreaterThanOrEqual(before);
    expect(payload.iat).toBeLessThanOrEqual(Math.floor(Date.now() / 1000));
    expect(payload.exp - payload.iat).toBe(3600);
    expect(findOne).toHaveBeenCalledWith({
      where: { email: credentials.email },
      select: { id: true, password: true },
    });
  });

  it('401 : donne la même réponse pour un email inconnu et un mauvais mot de passe', async () => {
    findOne.mockResolvedValueOnce(null);
    const unknown = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ ...credentials, email: 'unknown@example.com' })
      .expect(401);
    const incorrect = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ ...credentials, password: 'incorrect' })
      .expect(401);

    expect(unknown.body).toEqual({
      statusCode: 401,
      message: expect.any(String),
      error: 'Unauthorized',
    });
    expect(incorrect.body).toEqual(unknown.body);
    expect(unknown.body.message).not.toMatch(/email|password|mot de passe/i);
  });

  it.each(['x', 'a'.repeat(25)])(
    '401 : vérifie aussi un mot de passe incorrect hors des limites d’inscription (%s)',
    async (password) => {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ ...credentials, password })
        .expect(401);
    },
  );

  it.each([
    ['email absent', { password: credentials.password }, 'email'],
    ['email invalide', { ...credentials, email: 'invalid' }, 'email'],
    ['mot de passe absent', { email: credentials.email }, 'password'],
    ['mot de passe vide', { ...credentials, password: '' }, 'password'],
    ['mot de passe non textuel', { ...credentials, password: 123 }, 'password'],
    ['champ inattendu', { ...credentials, role: 'admin' }, 'role'],
  ])('400 : %s', async (_label, body, field) => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send(body)
      .expect(400);

    expect(response.body).toMatchObject({
      statusCode: 400,
      message: expect.arrayContaining([expect.stringContaining(field)]),
      error: 'Bad Request',
    });
    expect(findOne).not.toHaveBeenCalled();
  });

  it.each([undefined, '', 'trop-court'])(
    'refuse de démarrer avec un secret JWT absent ou invalide (%s)',
    async (value) => {
      await expect(createModule(value)).rejects.toThrow(/JWT_SECRET/);
    },
  );
});
