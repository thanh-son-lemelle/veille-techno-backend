import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { UpdateUserInputDto } from '../dtos/updateUserDto.schema';
import { User, UserRole } from '../user.entity';
import { UsersRepository } from '../users.repository';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;
  let repository: jest.Mocked<Pick<UsersRepository, 'findById' | 'save'>>;

  const createdAt = new Date('2026-09-01T12:00:00.000Z');
  const owner = { id: 'user-id', role: UserRole.USER };
  const admin = { id: 'admin-id', role: UserRole.ADMIN };

  const user = (overrides: Partial<User> = {}): User =>
    Object.assign(new User(), {
      id: 'user-id',
      email: 'before@example.com',
      name: 'Before',
      password: 'stored-password-hash',
      role: UserRole.USER,
      createdAt,
      ...overrides,
    });

  beforeEach(async () => {
    repository = {
      findById: jest.fn(),
      save: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: UsersRepository, useValue: repository },
      ],
    }).compile();

    service = moduleRef.get(UsersService);
    repository.save.mockImplementation(async (target) => target);
  });

  it.each([
    [{ name: 'After' }, { name: 'After', email: 'before@example.com' }],
    [
      { email: 'after@example.com' },
      { name: 'Before', email: 'after@example.com' },
    ],
  ] as const)(
    'permet au propriétaire de modifier %p et préserve les champs omis et le hash',
    async (input, expected) => {
      const target = user();
      repository.findById.mockResolvedValue(target);

      const result = await service.update(owner, target.id, input);

      expect(repository.findById).toHaveBeenCalledWith(target.id);
      expect(repository.save).toHaveBeenCalledTimes(1);
      expect(repository.save).toHaveBeenCalledWith(target);
      expect(target).toEqual(
        expect.objectContaining({
          ...expected,
          role: UserRole.USER,
          password: 'stored-password-hash',
        }),
      );
      expect(result).toEqual({
        id: target.id,
        ...expected,
        role: UserRole.USER,
        createdAt,
      });
    },
  );

  it.each([
    [UserRole.USER, UserRole.ADMIN],
    [UserRole.ADMIN, UserRole.USER],
  ])(
    'permet à un administrateur de changer le profil et le rôle de %s à %s',
    async (initialRole, nextRole) => {
      const target = user({ id: 'other-id', role: initialRole });
      repository.findById.mockResolvedValue(target);

      const result = await service.update(admin, target.id, {
        name: 'Updated by admin',
        email: 'updated@example.com',
        role: nextRole,
      });

      expect(repository.save).toHaveBeenCalledWith(target);
      expect(target).toEqual(
        expect.objectContaining({
          name: 'Updated by admin',
          email: 'updated@example.com',
          role: nextRole,
          password: 'stored-password-hash',
        }),
      );
      expect(result).toEqual({
        id: target.id,
        name: 'Updated by admin',
        email: 'updated@example.com',
        role: nextRole,
        createdAt,
      });
    },
  );

  it.each<UpdateUserInputDto>([
    { name: 'Unwanted' },
    { email: 'unwanted@example.com' },
    { role: UserRole.ADMIN },
  ])(
    'refuse à un non-administrateur toute modification du profil d’autrui : %p',
    async (input) => {
      const target = user({ id: 'other-id' });
      const original = Object.assign(new User(), target);
      repository.findById.mockResolvedValue(target);

      await expect(
        service.update(owner, target.id, input),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(target).toEqual(original);
      expect(repository.save).not.toHaveBeenCalled();
    },
  );

  it('refuse au propriétaire non-administrateur son propre rôle, même sans changement', async () => {
    const target = user();
    const original = Object.assign(new User(), target);
    repository.findById.mockResolvedValue(target);

    await expect(
      service.update(owner, target.id, {
        name: 'Unwanted',
        role: UserRole.USER,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(target).toEqual(original);
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('renvoie 404 sans sauvegarder si la cible est absente', async () => {
    repository.findById.mockResolvedValue(null);

    await expect(
      service.update(admin, 'missing-id', { role: UserRole.ADMIN }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(repository.findById).toHaveBeenCalledWith('missing-id');
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('ne renvoie que les champs publics même si la sauvegarde renvoie un hash', async () => {
    const target = user();
    const saved = user({ name: 'Saved name', password: 'saved-password-hash' });
    repository.findById.mockResolvedValue(target);
    repository.save.mockResolvedValue(saved);

    const result = await service.update(owner, target.id, {
      name: 'Submitted name',
    });

    expect(result).toEqual({
      id: saved.id,
      email: saved.email,
      name: saved.name,
      role: saved.role,
      createdAt: saved.createdAt,
    });
    expect(result).not.toHaveProperty('password');
  });

  it.each(['findById', 'save'] as const)(
    'laisse remonter une erreur de %s',
    async (method) => {
      const error = new Error('Repository unavailable');
      repository.findById.mockResolvedValue(user());
      repository[method].mockRejectedValue(error);

      await expect(
        service.update(owner, owner.id, { name: 'After' }),
      ).rejects.toBe(error);
      if (method === 'findById') {
        expect(repository.save).not.toHaveBeenCalled();
      }
    },
  );
});
