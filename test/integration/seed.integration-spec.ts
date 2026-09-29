import 'reflect-metadata';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import * as argon2 from 'argon2';
import { DataSource, type QueryRunner } from 'typeorm';
import {
  createDatabaseOptions,
  environmentSchema,
} from '../../src/database/database.config';
import { seedDatabase } from '../../src/database/development-seed';
import { CreateLists1790467200000 } from '../../src/database/migrations/1790467200000-create-lists';
import { CreateCards1790553600000 } from '../../src/database/migrations/1790553600000-create-cards';
import { User, UserRole } from '../../src/identity/user.entity';
import { List } from '../../src/kanban/list.entity';
import { Card } from '../../src/kanban/card.entity';

describe('Development seed (integration)', () => {
  let dataSource: DataSource;
  let runner: QueryRunner;
  const aliceId = '10000000-0000-4000-8000-000000000002';
  const aliceListId = '20000000-0000-4000-8000-000000000002';
  const emptyListId = '20000000-0000-4000-8000-000000000003';

  beforeAll(async () => {
    await ConfigModule.forRoot({ envFilePath: '.env' });
    dataSource = new DataSource(
      createDatabaseOptions(
        new ConfigService(environmentSchema.parse(process.env)),
      ),
    );
    await dataSource.initialize();
    runner = dataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    const schema = `seed_test_${randomUUID().replaceAll('-', '')}`;
    await runner.query(`CREATE SCHEMA "${schema}"`);
    await runner.query(`SET LOCAL search_path TO "${schema}", public`);
    await runner.query(
      'CREATE TABLE "users" (LIKE public.users INCLUDING ALL)',
    );
    await new CreateLists1790467200000().up(runner);
    await new CreateCards1790553600000().up(runner);
  }, 15000);

  beforeEach(async () => {
    await runner.startTransaction();
  });

  afterEach(async () => {
    await runner.rollbackTransaction();
  });

  afterAll(async () => {
    if (runner?.isTransactionActive) await runner.rollbackTransaction();
    await runner?.release();
    if (dataSource?.isInitialized) await dataSource.destroy();
  });

  it('creates both roles with usable passwords and separately owned Kanban data', async () => {
    await seedDatabase(runner.manager);

    const users = await runner.manager.getRepository(User).find({
      select: { id: true, email: true, password: true, role: true },
      order: { email: 'ASC' },
    });
    expect(users.map(({ email, role }) => ({ email, role }))).toEqual([
      { email: 'admin@seed.example.com', role: UserRole.ADMIN },
      { email: 'alice@seed.example.com', role: UserRole.USER },
      { email: 'bob@seed.example.com', role: UserRole.USER },
    ]);
    for (const user of users) {
      expect(user.password).toMatch(/^\$argon2id\$/);
      await expect(
        argon2.verify(user.password, 'SeedPassword123!'),
      ).resolves.toBe(true);
      expect(
        await runner.manager.countBy(List, { ownerId: user.id }),
      ).toBeGreaterThan(0);
    }
    expect(await runner.manager.countBy(List, { ownerId: aliceId })).toBe(2);
    expect(await runner.manager.countBy(Card, { listId: emptyListId })).toBe(0);
    const cards = await runner.manager.find(Card, {
      where: { listId: aliceListId },
      order: { position: 'ASC' },
    });
    expect(cards.map((card) => card.position)).toEqual([0, 1]);
    expect(cards.some((card) => card.description === '')).toBe(true);
    expect(cards.some((card) => card.description.length > 0)).toBe(true);
  });

  it('restores demo fixtures on rerun without duplicating or changing unrelated data', async () => {
    await seedDatabase(runner.manager);
    const extraUser = await runner.manager.save(User, {
      email: 'existing@example.com',
      name: 'Existing',
      password: 'untouched',
      role: UserRole.USER,
    });
    const extraList = await runner.manager.save(List, {
      title: 'Keep my list',
      ownerId: extraUser.id,
      position: 7,
    });
    const extraCard = await runner.manager.save(Card, {
      title: 'Keep my card',
      listId: extraList.id,
      position: 8,
    });
    await runner.manager.update(User, aliceId, {
      role: UserRole.ADMIN,
      email: 'changed@example.com',
    });
    await runner.manager.delete(List, aliceListId);

    await seedDatabase(runner.manager);

    expect(await runner.manager.count(User)).toBe(4);
    expect(await runner.manager.count(List)).toBe(5);
    expect(await runner.manager.count(Card)).toBe(5);
    expect(
      await runner.manager.findOneByOrFail(User, { id: aliceId }),
    ).toMatchObject({
      email: 'alice@seed.example.com',
      role: UserRole.USER,
    });
    expect(await runner.manager.countBy(Card, { listId: aliceListId })).toBe(2);
    expect(
      await runner.manager.findOne(User, {
        where: { id: extraUser.id },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          password: true,
          createdAt: true,
        },
      }),
    ).toEqual(extraUser);
    expect(await runner.manager.findOneBy(List, { id: extraList.id })).toEqual(
      extraList,
    );
    expect(await runner.manager.findOneBy(Card, { id: extraCard.id })).toEqual(
      extraCard,
    );
  });

  it('rolls back the whole seed if inserting a list fails', async () => {
    await runner.query(
      'ALTER TABLE "lists" ADD CONSTRAINT reject_seed CHECK (position < 0)',
    );

    await expect(seedDatabase(runner.manager)).rejects.toMatchObject({
      code: '23514',
    });

    expect(await runner.manager.count(User)).toBe(0);
    expect(await runner.manager.count(List)).toBe(0);
    expect(await runner.manager.count(Card)).toBe(0);
  });
});
