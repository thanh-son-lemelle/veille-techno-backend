import {
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { z } from 'zod';
import type { User } from './user.entity';
import { UsersRepository } from './users.repository';

const accessTokenSchema = z.object({
  sub: z.uuid(),
  exp: z.number().int().positive(),
});

export type AuthenticatedRequest = Request & {
  user: Pick<User, 'id' | 'role'>;
};

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly usersRepository: UsersRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<AuthenticatedRequest>();

    const token = request.headers.authorization
      ?.match(/^Bearer +(\S+)$/i)?.[1];

    if (!token) {
      throw new UnauthorizedException();
    }

    let payload: unknown;

    try {
      payload = await this.jwtService.verifyAsync(token);
    } catch {
      throw new UnauthorizedException();
    }

    const parsed = accessTokenSchema.safeParse(payload);

    if (!parsed.success) {
      throw new UnauthorizedException();
    }

    const user = await this.usersRepository.findIdentityById(
      parsed.data.sub,
    );

    if (!user) {
      throw new UnauthorizedException();
    }

    request.user = user;
    return true;
  }
}