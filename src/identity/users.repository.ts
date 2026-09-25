import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from './user.entity';

@Injectable()
export class UsersRepository {
  constructor(
    @InjectRepository(User)
    private readonly repository: Repository<User>,
  ) {}

  async createUser(input: {
    email: string;
    name: string;
    passwordHash: string;
    role: UserRole;})
  {
    const user = this.repository.create({
      email: input.email,
      name: input.name,
      password: input.passwordHash,
      role: input.role,
    });

    const savedUser = await this.repository.save(user);

    return {
    id: savedUser.id,
    email: savedUser.email,
    name: savedUser.name,
    role: savedUser.role,
    createdAt: savedUser.createdAt,
    };
  }
}