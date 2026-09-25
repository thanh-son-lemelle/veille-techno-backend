import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import type { LoginInputDto } from './loginDto.schema';
import type { RegisterInputDto } from './registerDto.schema';
import { UserRole } from './user.entity';
import { UsersRepository } from './users.repository';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly jwtService: JwtService,
  ) {}

  async login(input: LoginInputDto) {
    const user = await this.usersRepository.findForLogin(input.email);

    if (!user || !(await argon2.verify(user.password, input.password))) {
      throw new UnauthorizedException('Identifiants invalides.');
    }

    return { accessToken: await this.jwtService.signAsync({ sub: user.id }) };
  }

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