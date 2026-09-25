import {
    ForbiddenException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import type { UpdateUserInputDto } from '../dtos/updateUserDto.schema';
import { UserRole, type User } from '../user.entity';
import { UsersRepository } from '../users.repository';

@Injectable()
export class UsersService {
  constructor(
    private readonly usersRepository: UsersRepository,
  ) {}

  async update(
    currentUser: Pick<User, 'id' | 'role'>,
    id: string,
    input: UpdateUserInputDto,
  ) {
    const targetUser = await this.usersRepository.findById(id);

    if (!targetUser) {
      throw new NotFoundException('Utilisateur introuvable.');
    }

    const isAdmin = currentUser.role === UserRole.ADMIN;
    const isOwner = currentUser.id === targetUser.id;

    if (!isAdmin && !isOwner) {
      throw new ForbiddenException(
        'Vous ne pouvez pas modifier ce profil.',
      );
    }

    if (!isAdmin && input.role !== undefined) {
      throw new ForbiddenException(
        'Seul un administrateur peut modifier un rôle.',
      );
    }

    if (input.name !== undefined) {
      targetUser.name = input.name;
    }

    if (input.email !== undefined) {
      targetUser.email = input.email;
    }

    if (input.role !== undefined) {
      targetUser.role = input.role;
    }

    const savedUser = await this.usersRepository.save(targetUser);

    return {
      id: savedUser.id,
      email: savedUser.email,
      name: savedUser.name,
      role: savedUser.role,
      createdAt: savedUser.createdAt,
    };
  }
}