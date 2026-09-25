import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as argon2 from 'argon2';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types';
import { DataSource, Repository } from 'typeorm';
import { AppModule } from '../src/app.module';
import { User } from '../src/identity/user.entity';

describe('Inscription (e2e)', () => {
  let app: INestApplication<App>;
  let users: Repository<User>;
  let email: string;

  const url = '/api/auth/register';
  const password = 'MotDePasse123!';
  const name = 'Utilisateur test';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    const dataSource = app.get(DataSource);

    // if (dataSource.options.database !== 'veille_techno_test') {
    //   throw new Error('Ces tests exigent la base veille_techno_test.');
    // }

    users = dataSource.getRepository(User);
    await app.init();
  }, 15000);

  beforeEach(() => {
    email = `${randomUUID()}@example.com`;
  });

  afterEach(async () => {
    if (users && email) {
      await users.delete({ email });
    }
  });

  afterAll(async () => {
    await app?.close();
  });

  it('201 : crée un utilisateur et conserve uniquement le hash en base', async () => {
    const response = await request(app.getHttpServer())
      .post(url)
      .send({ email, password, name })
      .expect(201);

    // Égalité exacte : un champ password ou passwordHash ferait échouer le test.
    expect(response.body).toEqual({
      id: expect.any(String),
      email,
      name,
      role: 'user',
      createdAt: expect.any(String),
    });

    const savedUser = await users.findOneOrFail({
      where: { email },
      select: { password: true },
    });

    await expect(
      argon2.verify(savedUser.password, password),
    ).resolves.toBe(true);
  });

  it('409 : refuse un email déjà utilisé', async () => {
    await request(app.getHttpServer())
      .post(url)
      .send({ email, password, name })
      .expect(201);

    const response = await request(app.getHttpServer())
      .post(url)
      .send({ email, password, name })
      .expect(409);

    expect(response.body.message).toBe('Cet email est déjà utilisé.');
    expect(await users.countBy({ email })).toBe(1);
  });

  it.each([
    ['email invalide', 'email', randomUUID()],
    ['mot de passe trop court', 'password', 'a'.repeat(7)],
    ['mot de passe trop long', 'password', 'a'.repeat(25)],
    ['nom vide', 'name', '   '],
    ['rôle fourni par le client', 'role', 'admin'],
  ])('400 : %s', async (_label, field, value) => {
    const body = { email, password, name, [field]: value };

    // Suivre l’email effectivement envoyé pour le nettoyage.
    email = body.email;

    const response = await request(app.getHttpServer())
      .post(url)
      .send(body)
      .expect(400);

    expect(response.body.message).toEqual(
      expect.arrayContaining([expect.stringContaining(field)]),
    );

    expect(await users.countBy({ email })).toBe(0);
  });

  it.each([8, 24])('201 : accepte un mot de passe de %i caractères', async (length) => {
    await request(app.getHttpServer())
      .post(url)
      .send({ email, password: 'a'.repeat(length), name })
      .expect(201);
  });
});