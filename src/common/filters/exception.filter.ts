import {
  type ArgumentsHost,
  Catch,
  ConflictException,
} from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { QueryFailedError } from 'typeorm';

@Catch(QueryFailedError)
export class TypeOrmExceptionFilter extends BaseExceptionFilter {
  catch(exception: QueryFailedError, host: ArgumentsHost): void {
    const error = exception.driverError;

    if (
      'code' in error &&
      error.code === '23505' &&
      'constraint' in error &&
      error.constraint === 'UQ_97672ac88f789774dd47f7c8be3'
    ) {
      super.catch(
        new ConflictException('Cet email est déjà utilisé.'),
        host,
      );
      return;
    }

    super.catch(exception, host);
  }
}