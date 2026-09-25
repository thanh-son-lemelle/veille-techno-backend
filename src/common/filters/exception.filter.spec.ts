import type { INestApplication } from '@nestjs/common';
import { Controller, Get } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { QueryFailedError } from 'typeorm';
import { TypeOrmExceptionFilter } from './exception.filter';

@Controller('test')
class DatabaseErrorController {
  @Get('database-error')
  fail(): never {
    const databaseError = Object.assign(
      new Error('relation internal_table does not exist'),
      { code: '42P01' },
    );

    throw new QueryFailedError(
      'SELECT * FROM internal_table',
      [],
      databaseError,
    );
  }
}

describe('TypeOrmExceptionFilter', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [DatabaseErrorController],
      providers: [
        {
          provide: APP_FILTER,
          useClass: TypeOrmExceptionFilter,
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication<INestApplication<App>>({
      logger: false,
    });

    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('renvoie une 500 générique sans exposer les détails SQL', async () => {
    await request(app.getHttpServer())
      .get('/test/database-error')
      .expect(500)
      .expect({
        statusCode: 500,
        message: 'Internal server error',
      });
  });
});