import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { randomBytes, randomUUID } from 'node:crypto';
import { AuthGuard } from './auth.guard';
import { UserRole } from './user.entity';
import { UsersRepository } from './users.repository';

describe('AuthGuard', () => {
  let jwtService: JwtService;
  let secret: string;
  let usersRepository: jest.Mocked<Pick<UsersRepository, 'findIdentityById'>>;
  let guard: AuthGuard;
  let userId: string;

  function requestContext(authorization?: string) {
    const request = { headers: { authorization } };
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as ExecutionContext;
    return { context, request };
  }

  beforeEach(async () => {
    secret = randomBytes(32).toString('hex');
    jwtService = new JwtService({
      secret,
      signOptions: { algorithm: 'HS256', expiresIn: '1h' },
      verifyOptions: { algorithms: ['HS256'] },
    });
    usersRepository = { findIdentityById: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthGuard,
        { provide: JwtService, useValue: jwtService },
        { provide: UsersRepository, useValue: usersRepository },
      ],
    }).compile();
    guard = moduleRef.get(AuthGuard);
    userId = randomUUID();
  });

  it.each([undefined, '', 'Basic abc', 'Bearer', 'Bearer a b'])(
    'refuse un en-tête Authorization absent ou mal formé (%s)',
    async (authorization) => {
      const { context } = requestContext(authorization);

      await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(usersRepository.findIdentityById).not.toHaveBeenCalled();
    },
  );

  it.each([
    'Basic %s',
    'Bearer %s texte-en-trop',
    'Bearer texte-en-trop %s',
    'Bearer %s ',
    ' Bearer %s',
    'Bearer\t%s',
    'Bearer \t%s',
    'Bearer %s\t',
  ])(
    'refuse un en-tête mal formé même avec un JWT valide (%s)',
    async (header) => {
      usersRepository.findIdentityById.mockResolvedValue({
        id: userId,
        role: UserRole.USER,
      });
      const token = await jwtService.signAsync({ sub: userId });
      const { context } = requestContext(header.replace('%s', token));

      await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(usersRepository.findIdentityById).not.toHaveBeenCalled();
    },
  );

  it('refuse un jeton invalide', async () => {
    const { context } = requestContext('Bearer pas-un-jwt');

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(usersRepository.findIdentityById).not.toHaveBeenCalled();
  });

  it('refuse un jeton expiré', async () => {
    const token = await jwtService.signAsync(
      { sub: userId },
      { expiresIn: -1 },
    );
    const { context } = requestContext(`Bearer ${token}`);

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(usersRepository.findIdentityById).not.toHaveBeenCalled();
  });

  it('refuse un jeton signé avec une autre clé', async () => {
    const otherJwtService = new JwtService({
      secret: randomBytes(32).toString('hex'),
      signOptions: { algorithm: 'HS256', expiresIn: '1h' },
    });
    const token = await otherJwtService.signAsync({ sub: userId });
    const { context } = requestContext(`Bearer ${token}`);

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(usersRepository.findIdentityById).not.toHaveBeenCalled();
  });

  it('refuse un jeton signé avec un algorithme non autorisé', async () => {
    const otherJwtService = new JwtService({
      secret,
      signOptions: { algorithm: 'HS384', expiresIn: '1h' },
    });
    const token = await otherJwtService.signAsync({ sub: userId });
    const { context } = requestContext(`Bearer ${token}`);

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(usersRepository.findIdentityById).not.toHaveBeenCalled();
  });

  it.each([
    ['sub non UUID', { sub: 'invalide' }],
    ['sub absent', { role: 'admin' }],
  ])('refuse un jeton dont le %s', async (_description, payload) => {
    const token = await jwtService.signAsync(payload);
    const { context } = requestContext(`Bearer ${token}`);

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(usersRepository.findIdentityById).not.toHaveBeenCalled();
  });

  it('refuse un jeton sans claim exp', async () => {
    const token = await new JwtService({ secret }).signAsync({ sub: userId });
    const { context } = requestContext(`Bearer ${token}`);

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(usersRepository.findIdentityById).not.toHaveBeenCalled();
  });

  it('refuse le jeton d’un utilisateur supprimé', async () => {
    usersRepository.findIdentityById.mockResolvedValue(null);
    const token = await jwtService.signAsync({ sub: userId });
    const { context } = requestContext(`Bearer ${token}`);

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(usersRepository.findIdentityById).toHaveBeenCalledWith(userId);
  });

  it.each(['Bearer ', 'bearer ', 'BEARER ', 'Bearer   '])(
    'accepte le préfixe « %s » et utilise le rôle actuel de la base',
    async (prefix) => {
      usersRepository.findIdentityById.mockResolvedValue({
        id: userId,
        role: UserRole.USER,
      });
      const token = await jwtService.signAsync({
        sub: userId,
        role: UserRole.ADMIN,
      });
      const { context, request } = requestContext(`${prefix}${token}`);

      await expect(guard.canActivate(context)).resolves.toBe(true);
      expect(usersRepository.findIdentityById).toHaveBeenCalledWith(userId);
      expect(request).toHaveProperty('user', {
        id: userId,
        role: UserRole.USER,
      });
    },
  );

  it('relit le rôle à chaque requête', async () => {
    usersRepository.findIdentityById
      .mockResolvedValueOnce({ id: userId, role: UserRole.ADMIN })
      .mockResolvedValueOnce({ id: userId, role: UserRole.USER });
    const token = await jwtService.signAsync({ sub: userId });
    const first = requestContext(`Bearer ${token}`);
    const second = requestContext(`Bearer ${token}`);

    await expect(guard.canActivate(first.context)).resolves.toBe(true);
    await expect(guard.canActivate(second.context)).resolves.toBe(true);
    expect(first.request).toHaveProperty('user', {
      id: userId,
      role: UserRole.ADMIN,
    });
    expect(second.request).toHaveProperty('user', {
      id: userId,
      role: UserRole.USER,
    });
    expect(usersRepository.findIdentityById).toHaveBeenCalledTimes(2);
  });

  it('laisse remonter une erreur de base de données', async () => {
    const error = new Error('Base indisponible');
    usersRepository.findIdentityById.mockRejectedValue(error);
    const token = await jwtService.signAsync({ sub: userId });
    const { context } = requestContext(`Bearer ${token}`);

    await expect(guard.canActivate(context)).rejects.toBe(error);
  });
});
