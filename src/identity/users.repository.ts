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

  findIdentityById(id: string): Promise<Pick<User, 'id' | 'role'> | null> {
  return this.repository.findOne({
    where: { id },
    select: {
      id: true,
      role: true,
    },
  });
}

  findForLogin(email: string) {
    return this.repository.findOne({
      where: { email },
      select: { id: true, password: true },
    });
  }

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
