import { Test } from '@nestjs/testing';
import * as argon2 from 'argon2';
import { AuthService } from './auth.service';
import { UserRole } from './user.entity';
import { UsersRepository } from './users.repository';

describe('AuthService', () => {
  let service: AuthService;
  let repository: jest.Mocked<Pick<UsersRepository, 'createUser'>>;

  const input = {
    email: 'test@example.com',
    password: 'MotDePasse123!',
    name: 'Utilisateur test',
  };

  beforeEach(async () => {
    repository = {
      createUser: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersRepository,
          useValue: repository,
        },
      ],
    }).compile();

    service = moduleRef.get(AuthService);
  });

  it('hache le mot de passe et crée un utilisateur standard', async () => {
    const savedUser = {
      id: 'user-id',
      email: input.email,
      name: input.name,
      role: UserRole.USER,
      createdAt: new Date(),
    };

    repository.createUser.mockResolvedValue(savedUser);

    const result = await service.register(input);

    expect(repository.createUser).toHaveBeenCalledTimes(1);

    const [payload] = repository.createUser.mock.calls[0];

    expect(payload).toEqual({
      email: input.email,
      name: input.name,
      passwordHash: expect.any(String),
      role: UserRole.USER,
    });

    await expect(
      argon2.verify(payload.passwordHash, input.password),
    ).resolves.toBe(true);

    expect(result).toEqual(savedUser);
  });

  it('laisse remonter une erreur du repository', async () => {
    const error = new Error('Échec de sauvegarde');
    repository.createUser.mockRejectedValue(error);

    await expect(service.register(input)).rejects.toBe(error);
  });
});