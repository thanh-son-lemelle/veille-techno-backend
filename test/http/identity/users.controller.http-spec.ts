import {
  StandardSchemaValidationPipe,
  type ExecutionContext,
  type INestApplication,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import {
  AuthGuard,
  type AuthenticatedRequest,
} from '../../../src/identity/auth.guard';
import { UsersService } from '../../../src/identity/services/users.service';
import { UserRole } from '../../../src/identity/user.entity';
import { UsersController } from '../../../src/identity/controllers/users.controller';

describe('UsersController (HTTP)', () => {
  let app: INestApplication<App>;
  const currentUser = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    role: UserRole.USER,
  };
  const targetId = '550e8400-e29b-41d4-a716-446655440001';
  const update = jest.fn<
    ReturnType<UsersService['update']>,
    Parameters<UsersService['update']>
  >();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: { update } }],
    })
      .overrideGuard(AuthGuard)
      .useValue({
        canActivate(context: ExecutionContext) {
          context.switchToHttp().getRequest<AuthenticatedRequest>().user =
            currentUser;
          return true;
        },
      })
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new StandardSchemaValidationPipe());
    await app.init();
  });

  beforeEach(() => {
    update.mockReset();
    update.mockResolvedValue({
      id: targetId,
      name: 'Alice Dupont',
      email: 'alice@example.com',
      role: UserRole.USER,
      createdAt: new Date('2026-09-25T10:00:00.000Z'),
    });
  });

  afterAll(async () => {
    await app?.close();
  });

  it('transmet au service l’identité du guard, la cible et uniquement les champs fournis', async () => {
    const response = await request(app.getHttpServer())
      .patch(`/api/users/${targetId}`)
      .send({ name: '  Alice Dupont  ' })
      .expect(200);

    expect(update).toHaveBeenCalledWith(currentUser, targetId, {
      name: 'Alice Dupont',
    });
    expect(response.body).toEqual({
      id: targetId,
      name: 'Alice Dupont',
      email: 'alice@example.com',
      role: 'user',
      createdAt: '2026-09-25T10:00:00.000Z',
    });
  });

  it.each([
    ['nom vide', { name: '   ' }, 'name'],
    ['email invalide', { email: 'invalide' }, 'email'],
    ['rôle inconnu', { role: 'superadmin' }, 'role'],
    ['mot de passe', { password: 'MotDePasse123!' }, 'password'],
    ['identifiant dans le body', { id: currentUser.id }, 'id'],
    ['identité forgée dans le body', { user: { role: 'admin' } }, 'user'],
    ['nom null', { name: null }, 'name'],
  ])(
    '400 : refuse %s avant d’appeler le service',
    async (_label, body, field) => {
      const response = await request(app.getHttpServer())
        .patch(`/api/users/${targetId}`)
        .send(body)
        .expect(400);

      expect(response.body.message).toEqual(
        expect.arrayContaining([expect.stringContaining(field)]),
      );
      expect(update).not.toHaveBeenCalled();
    },
  );

  it('400 : refuse un identifiant non UUID avant d’appeler le service', async () => {
    await request(app.getHttpServer())
      .patch('/api/users/invalide')
      .send({ name: 'Alice' })
      .expect(400);

    expect(update).not.toHaveBeenCalled();
  });

  it('accepte un objet vide sans inventer de champs à modifier', async () => {
    await request(app.getHttpServer())
      .patch(`/api/users/${targetId}`)
      .send({})
      .expect(200);

    expect(update).toHaveBeenCalledWith(currentUser, targetId, {});
  });
});
