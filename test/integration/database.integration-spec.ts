import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';

describe('Database (integration)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  // test PostgreSQL connection through TypeORM
  it('queries PostgreSQL through the configured TypeORM data source', async () => {
    const dataSource = app.get(DataSource);

    expect(dataSource.isInitialized).toBe(true);
    await expect(dataSource.query('SELECT 1 AS connected')).resolves.toEqual([
      { connected: 1 },
    ]);
  });

  afterEach(async () => {
    await app.close();
  });
});
