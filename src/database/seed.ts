import dataSource from './data-source';
import {
  seedCards,
  seedDatabase,
  seedLists,
  seedPassword,
  seedUsers,
} from './development-seed';

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Le seed de démonstration est interdit en production.');
  }

  await dataSource.initialize();
  try {
    await dataSource.runMigrations();
    await seedDatabase(dataSource.manager);
    console.log('Seed terminé : 3 utilisateurs, 4 listes et 4 cartes.');
    console.log(`Mot de passe des comptes de démonstration : ${seedPassword}`);
    console.table(seedUsers);
    console.table(seedLists);
    console.table(seedCards, ['id', 'title', 'position', 'listId']);
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Échec du seed.');
  process.exitCode = 1;
});
