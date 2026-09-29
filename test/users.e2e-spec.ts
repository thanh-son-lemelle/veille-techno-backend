import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import * as argon2 from 'argon2';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types';
import { DataSource, In, Repository } from 'typeorm';
import { AppModule } from '../src/app.module';
import { User, UserRole } from '../src/identity/user.entity';

describe('Modification des utilisateurs (e2e)', () => {
  let app: INestApplication<App>;
  let users: Repository<User>;
  let jwt: JwtService;
  let passwordHash: string;
  const createdIds = new Set<string>();
  const password = 'MotDePasse123!';

  async function createUser(role = UserRole.USER): Promise<User> {
    const id = randomUUID();
    createdIds.add(id);
    return users.save(
      users.create({
        id,
        email: `${randomUUID()}@example.com`,
        name: 'Nom initial',
        password: passwordHash,
        role,
      }),
    );
  }

  async function login(user: User): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: user.email, password })
      .expect(200);
    expect(response.body).toEqual({ accessToken: expect.any(String) });
    return response.body.accessToken as string;
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    const dataSource = app.get(DataSource);
    users = dataSource.getRepository(User);
    jwt = app.get(JwtService);
    passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    await app.init();
  }, 15000);

  afterEach(async () => {
    if (users && createdIds.size) {
      await users.delete({ id: In([...createdIds]) });
      createdIds.clear();
    }
  });

  afterAll(async () => {
    await app?.close();
  });

  it('200 : modifie partiellement son profil, nettoie le nom et garde le hash', async () => {
    const owner = await createUser();
    const token = await login(owner);
    const url = `/api/users/${owner.id}`;

    const renamed = await request(app.getHttpServer())
      .patch(url)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '  Nouveau nom  ' })
      .expect(200);

    expect(renamed.body).toEqual({
      id: owner.id,
      email: owner.email,
      name: 'Nouveau nom',
      role: UserRole.USER,
      createdAt: owner.createdAt.toISOString(),
    });

    const newEmail = `${randomUUID()}@example.com`;
    const changedEmail = await request(app.getHttpServer())
      .patch(url)
      .set('Authorization', `Bearer ${token}`)
      .send({ email: newEmail })
      .expect(200);

    expect(changedEmail.body).toEqual({
      id: owner.id,
      email: newEmail,
      name: 'Nouveau nom',
      role: UserRole.USER,
      createdAt: owner.createdAt.toISOString(),
    });

    const stored = await users.findOneOrFail({
      where: { id: owner.id },
      select: { id: true, email: true, name: true, role: true, password: true },
    });
    expect(stored.email).toBe(newEmail);
    expect(stored.name).toBe('Nouveau nom');
    expect(stored.password).toBe(passwordHash);
    await expect(argon2.verify(stored.password, password)).resolves.toBe(true);
  });

  it('200 : un administrateur modifie un profil et promeut puis rétrograde un utilisateur', async () => {
    const admin = await createUser(UserRole.ADMIN);
    const target = await createUser();
    const token = await login(admin);
    const url = `/api/users/${target.id}`;

    const promoted = await request(app.getHttpServer())
      .patch(url)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '  Promu  ', role: UserRole.ADMIN })
      .expect(200);
    expect(promoted.body).toEqual({
      id: target.id,
      email: target.email,
      name: 'Promu',
      role: UserRole.ADMIN,
      createdAt: target.createdAt.toISOString(),
    });

    const demoted = await request(app.getHttpServer())
      .patch(url)
      .set('Authorization', `Bearer ${token}`)
      .send({ role: UserRole.USER })
      .expect(200);
    expect(demoted.body.role).toBe(UserRole.USER);
    expect((await users.findOneByOrFail({ id: target.id })).role).toBe(
      UserRole.USER,
    );
  });

  it('403 : un utilisateur ne modifie ni un autre profil ni son propre rôle', async () => {
    const actor = await createUser();
    const target = await createUser();
    const token = await login(actor);

    const otherProfile = await request(app.getHttpServer())
      .patch(`/api/users/${target.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Interdit' })
      .expect(403);
    expect(otherProfile.body.message).toBe(
      'Vous ne pouvez pas modifier ce profil.',
    );

    const ownRole = await request(app.getHttpServer())
      .patch(`/api/users/${actor.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ role: UserRole.USER })
      .expect(403);
    expect(ownRole.body.message).toBe(
      'Seul un administrateur peut modifier un rôle.',
    );
    expect((await users.findOneByOrFail({ id: target.id })).name).toBe(
      target.name,
    );
    expect((await users.findOneByOrFail({ id: actor.id })).role).toBe(
      UserRole.USER,
    );
  });

  it('404 : refuse un UUID valide absent de la base', async () => {
    const admin = await createUser(UserRole.ADMIN);
    const token = await login(admin);
    const response = await request(app.getHttpServer())
      .patch(`/api/users/${randomUUID()}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Inconnu' })
      .expect(404);
    expect(response.body.message).toBe('Utilisateur introuvable.');
  });

  it.each([
    ['nom vide', { name: '   ' }, 'name'],
    ['email invalide', { email: 'invalide' }, 'email'],
    ['rôle inconnu', { role: 'superadmin' }, 'role'],
    ['champ interdit', { password: 'Nouveau123!' }, 'password'],
  ])('400 : refuse %s', async (_label, body, field) => {
    const actor = await createUser();
    const token = await login(actor);
    const response = await request(app.getHttpServer())
      .patch(`/api/users/${actor.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send(body)
      .expect(400);
    expect(response.body.message).toEqual(
      expect.arrayContaining([expect.stringContaining(field)]),
    );
    const stored = await users.findOneByOrFail({ id: actor.id });
    expect(stored.name).toBe(actor.name);
    expect(stored.email).toBe(actor.email);
    expect(stored.role).toBe(UserRole.USER);
  });

  it('400 : refuse un identifiant non UUID', async () => {
    const actor = await createUser();
    const token = await login(actor);
    const response = await request(app.getHttpServer())
      .patch('/api/users/not-a-uuid')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Valide' })
      .expect(400);
    expect(response.body.message).toBe('Validation failed (uuid is expected)');
  });

  it('401 : refuse un token absent, invalide ou expiré', async () => {
    const actor = await createUser();
    const url = `/api/users/${actor.id}`;
    const expiredToken = await jwt.signAsync(
      { sub: actor.id },
      { expiresIn: -1 },
    );

    for (const authorization of [
      undefined,
      'Bearer invalide',
      `Bearer ${expiredToken}`,
    ]) {
      const call = request(app.getHttpServer())
        .patch(url)
        .send({ name: 'Interdit' });
      if (authorization) call.set('Authorization', authorization);
      const response = await call.expect(401);
      expect(response.body.message).toBe('Unauthorized');
    }
    expect((await users.findOneByOrFail({ id: actor.id })).name).toBe(
      actor.name,
    );
  });

  it('409 : un email déjà utilisé ne modifie pas le profil', async () => {
    const actor = await createUser();
    const other = await createUser();
    const token = await login(actor);
    const response = await request(app.getHttpServer())
      .patch(`/api/users/${actor.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Ne doit pas persister', email: other.email })
      .expect(409);

    expect(response.body.message).toBe('Cet email est déjà utilisé.');
    const stored = await users.findOneByOrFail({ id: actor.id });
    expect(stored.name).toBe(actor.name);
    expect(stored.email).toBe(actor.email);
    expect(await users.countBy({ email: other.email })).toBe(1);
  });

  it('403 : une rétrogradation prend effet même avec un ancien token', async () => {
    const admin = await createUser(UserRole.ADMIN);
    const other = await createUser();
    const oldToken = await login(admin);

    await request(app.getHttpServer())
      .patch(`/api/users/${admin.id}`)
      .set('Authorization', `Bearer ${oldToken}`)
      .send({ role: UserRole.USER })
      .expect(200);

    const response = await request(app.getHttpServer())
      .patch(`/api/users/${other.id}`)
      .set('Authorization', `Bearer ${oldToken}`)
      .send({ name: 'Interdit' })
      .expect(403);
    expect(response.body.message).toBe(
      'Vous ne pouvez pas modifier ce profil.',
    );
    expect((await users.findOneByOrFail({ id: other.id })).name).toBe(
      other.name,
    );
  });

  it('401 : le token d’un utilisateur supprimé devient inutilisable', async () => {
    const actor = await createUser();
    const token = await login(actor);
    await users.delete({ id: actor.id });

    const response = await request(app.getHttpServer())
      .patch(`/api/users/${actor.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Interdit' })
      .expect(401);
    expect(response.body.message).toBe('Unauthorized');
  });
});
