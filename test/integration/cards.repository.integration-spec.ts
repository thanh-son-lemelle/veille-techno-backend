import 'reflect-metadata';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { DataSource, QueryRunner } from 'typeorm';
import {
  createDatabaseOptions,
  environmentSchema,
} from '../../src/database/database.config';
import { CreateLists1790467200000 } from '../../src/database/migrations/1790467200000-create-lists';
import { CreateCards1790553600000 } from '../../src/database/migrations/1790553600000-create-cards';
import { Card } from '../../src/kanban/card.entity';
import { CardsRepository } from '../../src/kanban/cards.repository';

describe('CardsRepository (PostgreSQL integration)', () => {
  const ownerId = '11111111-1111-4111-8111-111111111111';
  const firstListId = '22222222-2222-4222-8222-222222222222';
  const secondListId = '33333333-3333-4333-8333-333333333333';
  const missingId = '44444444-4444-4444-8444-444444444444';
  const migration = new CreateCards1790553600000();
  let dataSource: DataSource;
  let queryRunner: QueryRunner;
  let cards: CardsRepository;
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

    const schema = `kanban_cards_test_${randomUUID().replaceAll('-', '')}`;
    await queryRunner.query(`CREATE SCHEMA "${schema}"`);
    await queryRunner.query(`SET LOCAL search_path TO "${schema}", public`);
    await queryRunner.query('CREATE TABLE "users" ("id" uuid PRIMARY KEY)');
    await queryRunner.query('INSERT INTO "users" ("id") VALUES ($1)', [
      ownerId,
    ]);
    await new CreateLists1790467200000().up(queryRunner);
    await queryRunner.query(
      'INSERT INTO "lists" ("id", "title", "owner_id") VALUES ($1, $2, $3), ($4, $5, $3)',
      [firstListId, 'Todo', ownerId, secondListId, 'Done'],
    );
    await migration.up(queryRunner);
    cards = new CardsRepository(queryRunner.manager.getRepository(Card));
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

  it('persists a card with generated id, timestamps, and defaults', async () => {
    const created = await cards.createCard({
      title: 'First card',
      listId: firstListId,
    });

    expect(created).toEqual({
      id: expect.stringMatching(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      ),
      title: 'First card',
      description: '',
      position: 0,
      listId: firstListId,
      createdAt: expect.any(Date),
      updatedAt: expect.any(Date),
    });
    expect(
      await queryRunner.query(
        'SELECT "title", "description", "position", "list_id", "created_at", "updated_at" FROM "cards" WHERE "id" = $1',
        [created.id],
      ),
    ).toEqual([
      {
        title: 'First card',
        description: '',
        position: 0,
        list_id: firstListId,
        created_at: created.createdAt,
        updated_at: created.updatedAt,
      },
    ]);
  });

  it('preserves the supplied description and position when creating a card', async () => {
    const created = await cards.createCard({
      title: 'Detailed card',
      description: 'Acceptance criteria',
      position: 5,
      listId: secondListId,
    });

    await expect(cards.findById(created.id)).resolves.toMatchObject({
      title: 'Detailed card',
      description: 'Acceptance criteria',
      position: 5,
      listId: secondListId,
    });
  });

  it('returns only the requested list’s cards ordered by position, creation time, then id', async () => {
    const fixtures = [
      ['10000000-0000-4000-8000-000000000001', firstListId, 0, '2024-01-01'],
      ['10000000-0000-4000-8000-000000000003', firstListId, 0, '2024-01-02'],
      ['10000000-0000-4000-8000-000000000002', firstListId, 0, '2024-01-02'],
      ['10000000-0000-4000-8000-000000000004', firstListId, 2, '2023-01-01'],
      ['10000000-0000-4000-8000-000000000005', secondListId, 0, '2024-01-01'],
    ];

    for (const fixture of fixtures) {
      await queryRunner.query(
        'INSERT INTO "cards" ("id", "list_id", "position", "created_at", "title") VALUES ($1, $2, $3, $4, \'Card\')',
        fixture,
      );
    }

    expect(
      (await cards.findAllByListId(firstListId)).map((card) => card.id),
    ).toEqual([
      '10000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000002',
      '10000000-0000-4000-8000-000000000003',
      '10000000-0000-4000-8000-000000000004',
    ]);
    expect(
      (await cards.findAllByListId(secondListId)).map((card) => card.id),
    ).toEqual(['10000000-0000-4000-8000-000000000005']);
  });

  it('returns an empty array for a list without cards and null for an absent card', async () => {
    await expect(cards.findAllByListId(firstListId)).resolves.toEqual([]);
    await expect(cards.findById(missingId)).resolves.toBeNull();
  });

  it('saves edits and moves the same card while updating its modification time', async () => {
    const created = await cards.createCard({
      title: 'Before',
      listId: firstListId,
    });
    const previousUpdate = new Date('2024-01-01T00:00:00.000Z');
    await queryRunner.query(
      'UPDATE "cards" SET "updated_at" = $1 WHERE "id" = $2',
      [previousUpdate, created.id],
    );
    const card = (await cards.findById(created.id))!;
    expect(card.list).toBeUndefined();
    card.title = 'After';
    card.description = 'Completed';
    card.position = 3;
    card.listId = secondListId;

    const saved = await cards.save(card);

    expect(saved.updatedAt.getTime()).toBeGreaterThan(previousUpdate.getTime());
    await expect(cards.findById(created.id)).resolves.toMatchObject({
      id: created.id,
      title: 'After',
      description: 'Completed',
      position: 3,
      listId: secondListId,
      createdAt: created.createdAt,
      updatedAt: saved.updatedAt,
    });
    await expect(cards.findAllByListId(firstListId)).resolves.toEqual([]);
    expect(
      (await cards.findAllByListId(secondListId)).map((item) => item.id),
    ).toEqual([created.id]);
  });

  it('deletes one card and reports zero affected rows for an absent id', async () => {
    const deleted = await cards.createCard({
      title: 'Delete',
      listId: firstListId,
    });
    const retained = await cards.createCard({
      title: 'Keep',
      listId: firstListId,
    });

    expect((await cards.delete(deleted.id)).affected).toBe(1);
    await expect(cards.findById(deleted.id)).resolves.toBeNull();
    await expect(cards.findById(retained.id)).resolves.toMatchObject({
      id: retained.id,
    });
    expect((await cards.delete(missingId)).affected).toBe(0);
  });

  it('rejects a card whose parent list does not exist', async () => {
    await expect(
      cards.createCard({ title: 'Orphan', listId: missingId }),
    ).rejects.toMatchObject({ code: '23503' });
  });

  it('cascades list deletion only to that list’s cards', async () => {
    const deleted = await cards.createCard({
      title: 'Delete',
      listId: firstListId,
    });
    const retained = await cards.createCard({
      title: 'Keep',
      listId: secondListId,
    });

    await queryRunner.query('DELETE FROM "lists" WHERE "id" = $1', [
      firstListId,
    ]);

    await expect(cards.findById(deleted.id)).resolves.toBeNull();
    await expect(cards.findById(retained.id)).resolves.toMatchObject({
      id: retained.id,
    });
  });

  it('can roll the cards migration down and back up', async () => {
    await migration.down(queryRunner);
    expect(
      (
        await queryRunner.query(
          "SELECT to_regclass(current_schema() || '.cards') AS table_name",
        )
      )[0].table_name,
    ).toBeNull();

    await migration.up(queryRunner);
    const created = await cards.createCard({
      title: 'After migration',
      listId: firstListId,
    });
    await expect(cards.findById(created.id)).resolves.toMatchObject({
      title: 'After migration',
    });
  });
});
