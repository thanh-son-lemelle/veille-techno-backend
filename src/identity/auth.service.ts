import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import type { RegisterInputDto } from './registerDto.schema';
import { UserRole } from './user.entity';
import { UsersRepository } from './users.repository';

@Injectable()
export class AuthService {
  constructor(private readonly usersRepository: UsersRepository) {}

  async register(input: RegisterInputDto) {
    const passwordHash = await argon2.hash(input.password, {
      type: argon2.argon2id,
    });

    return this.usersRepository.createUser({
      email: input.email,
      name: input.name,
      passwordHash,
      role: UserRole.USER,
    });
  }
}