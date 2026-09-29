import * as argon2 from 'argon2';
import type { EntityManager } from 'typeorm';
import { User, UserRole } from '../identity/user.entity';
import { Card } from '../kanban/card.entity';
import { List } from '../kanban/list.entity';

export const seedPassword = 'SeedPassword123!';

export const seedUsers = [
  {
    id: '10000000-0000-4000-8000-000000000001',
    email: 'admin@seed.example.com',
    name: 'Admin démo',
    role: UserRole.ADMIN,
  },
  {
    id: '10000000-0000-4000-8000-000000000002',
    email: 'alice@seed.example.com',
    name: 'Alice démo',
    role: UserRole.USER,
  },
  {
    id: '10000000-0000-4000-8000-000000000003',
    email: 'bob@seed.example.com',
    name: 'Bob démo',
    role: UserRole.USER,
  },
];

export const seedLists = [
  {
    id: '20000000-0000-4000-8000-000000000001',
    title: 'Administration',
    position: 0,
    ownerId: seedUsers[0].id,
  },
  {
    id: '20000000-0000-4000-8000-000000000002',
    title: 'À faire',
    position: 0,
    ownerId: seedUsers[1].id,
  },
  {
    id: '20000000-0000-4000-8000-000000000003',
    title: 'Terminé',
    position: 1,
    ownerId: seedUsers[1].id,
  },
  {
    id: '20000000-0000-4000-8000-000000000004',
    title: 'Veille de Bob',
    position: 0,
    ownerId: seedUsers[2].id,
  },
];

export const seedCards = [
  {
    id: '30000000-0000-4000-8000-000000000001',
    title: 'Vérifier les rôles',
    description:
      'Modifier un profil et son rôle avec le compte administrateur.',
    position: 0,
    listId: seedLists[0].id,
  },
  {
    id: '30000000-0000-4000-8000-000000000002',
    title: 'Lire la documentation NestJS',
    description:
      'Tester la lecture et la modification de cette carte avec Alice.',
    position: 0,
    listId: seedLists[1].id,
  },
  {
    id: '30000000-0000-4000-8000-000000000003',
    title: 'Tester le déplacement',
    description: '',
    position: 1,
    listId: seedLists[1].id,
  },
  {
    id: '30000000-0000-4000-8000-000000000004',
    title: 'Explorer PostgreSQL',
    description: 'Cette carte est accessible uniquement à Bob.',
    position: 0,
    listId: seedLists[3].id,
  },
];

export async function seedDatabase(manager: EntityManager): Promise<void> {
  const users = await Promise.all(
    seedUsers.map(async (user) => ({
      ...user,
      password: await argon2.hash(seedPassword, { type: argon2.argon2id }),
    })),
  );

  await manager.transaction(async (transaction) => {
    await transaction.upsert(User, users, ['id']);
    await transaction.upsert(List, seedLists, ['id']);
    await transaction.upsert(Card, seedCards, ['id']);
  });
}
