import 'reflect-metadata';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { DataSource, QueryRunner } from 'typeorm';
import {
  createDatabaseOptions,
  environmentSchema,
} from '../src/database/database.config';
import { CreateLists1790467200000 } from '../src/database/migrations/1790467200000-create-lists';
import { List } from '../src/kanban/list.entity';
import { ListsRepository } from '../src/kanban/lists.repository';

describe('ListsRepository (PostgreSQL)', () => {
  const firstOwnerId = '11111111-1111-4111-8111-111111111111';
  const secondOwnerId = '22222222-2222-4222-8222-222222222222';
  const missingId = '33333333-3333-4333-8333-333333333333';
  const migration = new CreateLists1790467200000();
  let dataSource: DataSource;
  let queryRunner: QueryRunner;
  let lists: ListsRepository;
  let testTransactionOpen = false;

  beforeAll(async () => {
    await ConfigModule.forRoot({ envFilePath: '.env' });
    const environment = environmentSchema.parse(process.env);
    dataSource = new DataSource(
      createDatabaseOptions(new ConfigService(environment)),
    );
    await dataSource.initialize();
    queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    const schema = `kanban_lists_test_${randomUUID().replaceAll('-', '')}`;
    await queryRunner.query(`CREATE SCHEMA "${schema}"`);
    await queryRunner.query(`SET LOCAL search_path TO "${schema}", public`);
    await queryRunner.query('CREATE TABLE "users" ("id" uuid PRIMARY KEY)');
    await queryRunner.query('INSERT INTO "users" ("id") VALUES ($1), ($2)', [
      firstOwnerId,
      secondOwnerId,
    ]);
    await migration.up(queryRunner);
    lists = new ListsRepository(queryRunner.manager.getRepository(List));
  }, 15000);

  beforeEach(async () => {
    await queryRunner.startTransaction();
    testTransactionOpen = true;
  });

  afterEach(async () => {
    if (testTransactionOpen) {
      await queryRunner.rollbackTransaction();
      testTransactionOpen = false;
    }
  });

  afterAll(async () => {
    if (queryRunner?.isTransactionActive) {
      await queryRunner.rollbackTransaction();
    }
    await queryRunner?.release();
    await dataSource?.destroy();
  });

  it('persists a list with generated id, creation time, and default position', async () => {
    const created = await lists.createList({
      title: 'Inbox',
      ownerId: firstOwnerId,
    });

    expect(created.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(created.position).toBe(0);
    expect(created.createdAt).toBeInstanceOf(Date);

    const rows: {
      title: string;
      owner_id: string;
      position: number;
      created_at: Date;
    }[] = await queryRunner.query(
      'SELECT "title", "owner_id", "position", "created_at" FROM "lists" WHERE "id" = $1',
      [created.id],
    );
    expect(rows).toEqual([
      {
        title: 'Inbox',
        owner_id: firstOwnerId,
        position: 0,
        created_at: created.createdAt,
      },
    ]);
  });

  it('returns only the owner’s lists ordered by position, creation time, then id', async () => {
    const older = await lists.createList({
      title: 'Older',
      ownerId: firstOwnerId,
      position: 0,
    });
    const tiedA = await lists.createList({
      title: 'Tied A',
      ownerId: firstOwnerId,
      position: 0,
    });
    const tiedB = await lists.createList({
      title: 'Tied B',
      ownerId: firstOwnerId,
      position: 0,
    });
    const laterPosition = await lists.createList({
      title: 'Later position',
      ownerId: firstOwnerId,
      position: 2,
    });
    const otherOwner = await lists.createList({
      title: 'Other owner',
      ownerId: secondOwnerId,
    });

    await queryRunner.query(
      'UPDATE "lists" SET "created_at" = $1 WHERE "id" = $2',
      ['2024-01-01T00:00:00.000Z', older.id],
    );
    await queryRunner.query(
      'UPDATE "lists" SET "created_at" = $1 WHERE "id" IN ($2, $3)',
      ['2024-01-02T00:00:00.000Z', tiedA.id, tiedB.id],
    );
    await queryRunner.query(
      'UPDATE "lists" SET "created_at" = $1 WHERE "id" = $2',
      ['2023-01-01T00:00:00.000Z', laterPosition.id],
    );

    expect(
      (await lists.findAllByOwnerId(firstOwnerId)).map((list) => list.id),
    ).toEqual([older.id, ...[tiedA.id, tiedB.id].sort(), laterPosition.id]);
    expect(
      (await lists.findAllByOwnerId(secondOwnerId)).map((list) => list.id),
    ).toEqual([otherOwner.id]);
    await expect(lists.findAllByOwnerId(missingId)).resolves.toEqual([]);
  });

  it('returns null when a list id does not exist', async () => {
    await expect(lists.findById(missingId)).resolves.toBeNull();
  });

  it('saves edits to the same list without changing its owner', async () => {
    const created = await lists.createList({
      title: 'Todo',
      ownerId: firstOwnerId,
    });
    created.title = 'Doing';
    created.position = 3;

    const saved = await lists.save(created);
    expect(saved.id).toBe(created.id);
    expect(saved.ownerId).toBe(firstOwnerId);
    expect(await lists.findById(created.id)).toMatchObject({
      id: created.id,
      title: 'Doing',
      position: 3,
      ownerId: firstOwnerId,
    });
    expect(
      (
        await queryRunner.query(
          'SELECT count(*)::integer AS count FROM "lists"',
        )
      )[0].count,
    ).toBe(1);
  });

  it('deletes one list and reports zero affected rows for an absent id', async () => {
    const deleted = await lists.createList({
      title: 'Delete',
      ownerId: firstOwnerId,
    });
    const retained = await lists.createList({
      title: 'Keep',
      ownerId: firstOwnerId,
    });

    expect((await lists.delete(deleted.id)).affected).toBe(1);
    await expect(lists.findById(deleted.id)).resolves.toBeNull();
    await expect(lists.findById(retained.id)).resolves.toMatchObject({
      id: retained.id,
    });
    expect((await lists.delete(missingId)).affected).toBe(0);
  });

  it('rejects a list whose owner does not exist', async () => {
    await expect(
      lists.createList({ title: 'Orphan', ownerId: missingId }),
    ).rejects.toMatchObject({
      code: '23503',
    });
  });

  it('can roll the lists migration down and back up', async () => {
    await migration.down(queryRunner);
    expect(
      (
        await queryRunner.query(
          "SELECT to_regclass(current_schema() || '.lists') AS table_name",
        )
      )[0].table_name,
    ).toBeNull();

    await migration.up(queryRunner);
    const created = await lists.createList({
      title: 'After migration',
      ownerId: firstOwnerId,
    });
    await expect(lists.findById(created.id)).resolves.toMatchObject({
      title: 'After migration',
    });
  });
});
