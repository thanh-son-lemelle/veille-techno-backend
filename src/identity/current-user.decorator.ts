import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { AuthenticatedRequest } from './auth.guard';

export type AuthenticatedUser = AuthenticatedRequest['user'];

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser => {
    return context.switchToHttp().getRequest<AuthenticatedRequest>().user;
  },
);
