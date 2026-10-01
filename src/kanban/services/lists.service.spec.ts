import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { List } from '../list.entity';
import { ListsRepository } from '../lists.repository';
import { ListsService } from './lists.service';

describe('ListsService ownership', () => {
  let list: List;
  let service: ListsService;
  let repository: jest.Mocked<
    Pick<ListsRepository, 'findById' | 'save' | 'delete'>
  >;

  beforeEach(() => {
    list = Object.assign(new List(), {
      id: '550e8400-e29b-41d4-a716-446655440000',
      ownerId: '550e8400-e29b-41d4-a716-446655440001',
      title: 'à faire',
      position: 2,
      createdAt: new Date('2026-09-27T00:00:00Z'),
    });
    repository = {
      findById: jest.fn(async (id: string) => (id === list.id ? list : null)),
      save: jest.fn(async (entity: List) => entity),
      delete: jest.fn().mockResolvedValue({ affected: 1, raw: [] }),
    };
    service = new ListsService(repository as unknown as ListsRepository);
  });

  it.each(['update', 'delete'] as const)(
    '%s distinguishes a missing list from a forbidden list',
    async (operation) => {
      await expect(
        operation === 'update'
          ? service.update(list.ownerId, 'missing', { title: 'Nouveau' })
          : service.delete(list.ownerId, 'missing'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(repository.save).not.toHaveBeenCalled();
      expect(repository.delete).not.toHaveBeenCalled();
    },
  );

  it.each(['update', 'delete'] as const)(
    '%s rejects another owner before modifying the list',
    async (operation) => {
      await expect(
        operation === 'update'
          ? service.update('other-owner', list.id, { title: 'Nouveau' })
          : service.delete('other-owner', list.id),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(list.title).toBe('à faire');
      expect(repository.save).not.toHaveBeenCalled();
      expect(repository.delete).not.toHaveBeenCalled();
    },
  );

  it('accepts position zero and preserves an omitted title', async () => {
    await expect(
      service.update(list.ownerId, list.id, { position: 0 }),
    ).resolves.toMatchObject({ title: 'à faire', position: 0 });
    expect(repository.save).toHaveBeenCalledTimes(1);
    expect(repository.save).toHaveBeenCalledWith(list);
    expect(repository.delete).not.toHaveBeenCalled();
  });

  it('updates the title without changing the owner or position', async () => {
    await expect(
      service.update(list.ownerId, list.id, { title: 'En cours' }),
    ).resolves.toMatchObject({
      title: 'En cours',
      position: 2,
      ownerId: list.ownerId,
    });
    expect(repository.save).toHaveBeenCalledTimes(1);
    expect(repository.save).toHaveBeenCalledWith(list);
    expect(repository.delete).not.toHaveBeenCalled();
  });

  it('preserves all fields on an empty patch', async () => {
    const original = {
      id: list.id,
      title: list.title,
      position: list.position,
      ownerId: list.ownerId,
      createdAt: list.createdAt,
    };
    await expect(service.update(list.ownerId, list.id, {})).resolves.toEqual(
      original,
    );
    expect(repository.save).toHaveBeenCalledTimes(1);
    expect(repository.save).toHaveBeenCalledWith(list);
    expect(repository.delete).not.toHaveBeenCalled();
  });

  it('deletes the owned list', async () => {
    await expect(
      service.delete(list.ownerId, list.id),
    ).resolves.toBeUndefined();
    expect(repository.delete).toHaveBeenCalledTimes(1);
    expect(repository.delete).toHaveBeenCalledWith(list.id);
    expect(repository.save).not.toHaveBeenCalled();
  });
});
