<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ npm install
```

## Développement local avec Docker

Avec Docker Desktop démarré en mode conteneurs Linux, créer la configuration
locale depuis la racine du backend :

```powershell
if (-not (Test-Path .env.docker)) { Copy-Item .env.docker.example .env.docker }
```

Adapter `DB_USERNAME`, `DB_PASSWORD`, `DB_DATABASE` et `DOCKER_API_PORT` dans
`.env.docker`. Générer un secret, puis copier le résultat dans `JWT_SECRET`
(au moins 32 caractères) :

```bash
docker run --rm node:24-bookworm-slim node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Le fichier [`.env.docker.example`](.env.docker.example) est versionné ;
`.env.docker` est ignoré par Git et exclu de l'image Docker. Utiliser
`--env-file .env.docker` pour toutes les commandes Compose : ce fichier fournit
les paramètres partagés par l'API et PostgreSQL, à la place du `.env` de
l'installation sans Docker. Les variables déjà exportées dans le terminal
restent prioritaires.

Démarrer l'environnement :

```bash
docker compose --env-file .env.docker up --build --wait
```

Cette commande construit l'image Node.js 24, démarre PostgreSQL 17, attend que
la base soit prête, applique les migrations puis lance l'API en mode watch.
Swagger est accessible sur [http://localhost:3000/api](http://localhost:3000/api).
Le démarrage est terminé lorsque les deux services sont sains (`healthy`).

Les dossiers `src`, `test` et `docs` sont partagés avec les conteneurs. Les
modifications TypeScript dans `src` relancent automatiquement l'API
Après un changement de `package.json`, `package-lock.json` ou des fichiers de configuration à la racine,
relancer `docker compose --env-file .env.docker up --build --wait`.
Après un changement de `.env.docker`, relancer la même commande pour recréer les
conteneurs avec les nouvelles valeurs. Attention : sur un volume PostgreSQL déjà
initialisé, changer `DB_USERNAME`, `DB_PASSWORD` ou `DB_DATABASE` ne modifie pas
les utilisateurs, mots de passe ou bases existants ; ces changements doivent
aussi être effectués dans PostgreSQL.

Commandes utiles :

```bash
# État et logs
docker compose --env-file .env.docker ps
docker compose --env-file .env.docker logs -f api

# Charger les comptes et données de démonstration décrits plus bas
docker compose --env-file .env.docker exec api npm run seed

# Exécuter les tests dans cet environnement
docker compose --env-file .env.docker exec api npm test -- --runInBand
docker compose --env-file .env.docker exec api npm run test:integration -- --runInBand
docker compose --env-file .env.docker exec api npm run test:e2e -- --runInBand

# Ouvrir une session SQL dans la base Docker
docker compose --env-file .env.docker exec postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'

# Arrêter et supprimer les conteneurs, en conservant les données
docker compose --env-file .env.docker down
```

Si le port 3000 est déjà occupé, renseigner `DOCKER_API_PORT=3001` dans
`.env.docker`, puis relancer :

```bash
docker compose --env-file .env.docker up --build --wait
```

Swagger sera alors disponible sur [http://localhost:3001/api](http://localhost:3001/api).
Pour remettre la base Docker à zéro,
`docker compose --env-file .env.docker down --volumes` supprime aussi le volume
et **toutes ses données**. Au démarrage suivant, les migrations recréent les tables ;
le seed reste une commande explicite.

## Configuration de la base de données sans Docker

Le backend utilise PostgreSQL avec TypeORM. Copier `.env.example` vers `.env`
et renseigner les accès à votre serveur PostgreSQL :

```powershell
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

Si `.env` existe déjà, le conserver et vérifier les variables `DB_HOST`, `DB_PORT`,
`DB_USERNAME`, `DB_PASSWORD` et `DB_DATABASE`. Le fichier `.env` est ignoré par Git.

Renseigner aussi `JWT_SECRET` dans `.env` avant de démarrer l'API. Cette valeur
est obligatoire, doit contenir au moins 32 caractères et reste vide dans
`.env.example`. Générer un secret aléatoire avec la commande suivante, puis copier
le résultat dans `JWT_SECRET` :

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

PostgreSQL doit être démarré et la base indiquée par `DB_DATABASE` doit exister.
Pour créer la base locale de l'exemple, avec un utilisateur autorisé :

```bash
createdb -h 127.0.0.1 -p 5432 -U postgres veille_techno
```

Appliquer les migrations avant de démarrer l'API :

```bash
npm run migration:run
```

Au démarrage, `AppModule` valide les variables d'environnement avec Zod puis
établit la connexion TypeORM. Les entités enregistrées avec
`TypeOrmModule.forFeature(...)` sont chargées automatiquement. La synchronisation
du schéma est désactivée (`synchronize: false`) : le démarrage ne crée ni ne modifie
les tables.

Pour vérifier la connexion réelle et les dépôts, lancer
`npm run test:integration -- --runInBand`. Les parcours HTTP avec PostgreSQL
(authentification, utilisateurs et listes) se lancent avec
`npm run test:e2e -- --runInBand`.
La base locale configurée dans `.env` sert au développement et aux tests.
Ces deux commandes appliquent d'abord les migrations manquantes via
`pretest:integration` ou `pretest:e2e`. Les migrations déjà enregistrées ne sont
pas rejouées.

Les tests de listes utilisent les vraies tables et contraintes créées par les
migrations. Leurs utilisateurs et listes sont créés dans des transactions annulées
après les tests ; les vérifications portent uniquement sur ces données de test.
Les tests d'inscription suppriment leurs utilisateurs temporaires après chaque
scénario.

## Seed : données de démonstration

Avec un fichier `.env` existant et PostgreSQL démarré, exécuter :

```bash
npm run seed
npm run start:dev
```

`npm run seed` applique les migrations manquantes puis affiche les identifiants
des données créées. Il refuse de s'exécuter si `NODE_ENV=production`. Le mot de
passe commun aux trois comptes est `SeedPassword123!` :

| Compte | Rôle | ID |
| --- | --- | --- |
| `admin@seed.example.com` | `admin` | `10000000-0000-4000-8000-000000000001` |
| `alice@seed.example.com` | `user` | `10000000-0000-4000-8000-000000000002` |
| `bob@seed.example.com` | `user` | `10000000-0000-4000-8000-000000000003` |

Les listes sont `Administration` (admin, ID `20000000-0000-4000-8000-000000000001`),
`À faire` et `Terminé` (Alice, IDs finissant par `002` et `003`), et
`Veille de Bob` (Bob, ID finissant par `004`). `Terminé` est vide. Les cartes
sont `Vérifier les rôles` (admin, ID `30000000-0000-4000-8000-000000000001`),
`Lire la documentation NestJS` (Alice, `002`, description renseignée, position 0),
`Tester le déplacement` (Alice, `003`, description vide, position 1) et
`Explorer PostgreSQL` (Bob, `004`). Les IDs complets figurent dans la sortie du seed.

Le seed peut être relancé : il restaure ces fixtures par UUID, leurs mots de
passe, rôles et modifications, ainsi que les fixtures supprimées, sans effacer
les autres données. Si une adresse du seed appartient déjà à un autre UUID,
la transaction échoue au lieu de modifier ce compte.

Pour obtenir un token, envoyer `POST /api/auth/login` avec, par exemple,
`{"email":"alice@seed.example.com","password":"SeedPassword123!"}`.
Dans Swagger sur `/api`, cliquer sur **Authorize** et fournir l'`accessToken`
en Bearer pour essayer les routes protégées.

| Routes | Essais utiles et réponses attendues |
| --- | --- |
| `POST /api/auth/register`, `POST /api/auth/login` | Inscription 201 (`role=user`), doublon 409 ; connexion 200, mauvais mot de passe 401. |
| `PATCH /api/users/:id` | Alice modifie son profil 200 ; celui de Bob ou son propre rôle 403 ; admin modifie un rôle 200. |
| `GET`, `POST /api/lists` | Listes du compte connecté uniquement 200 ; nouvelle liste 201. |
| `PATCH`, `DELETE /api/lists/:id` | Propriétaire 200/204 ; liste d'un autre compte 403, même pour admin ; ID absent 404. |
| `GET`, `POST /api/lists/:listId/cards` | `Terminé` retourne `[]` ; création 201 ; liste étrangère 403. |
| `GET`, `PATCH`, `DELETE /api/cards/:id` | Carte propriétaire 200/200/204 ; carte étrangère 403 ; déplacement d'Alice de `À faire` vers `Terminé` 200, vers `Veille de Bob` 403. |

Sans token, les routes protégées renvoient 401. Un UUID mal formé renvoie 400.
`GET /api/users/me` apparaît dans le contrat mais n'est pas encore implémenté.
Relancer le seed après les essais de modification ou de suppression.

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Documentation de l’API

Après démarrage, Swagger est accessible sur [http://localhost:3000/api](http://localhost:3000/api)
(adapter le port à la variable `PORT`). Le document JSON est disponible sur `/api-json`.
Le contrat de référence est [docs/openapi.yaml](docs/openapi.yaml). Il est conservé
tel quel ; la documentation des routes implémentées est enrichie via les
décorateurs NestJS (`@ApiOperation`, `@ApiBody`, `@ApiResponse`, etc.). Les schémas
des corps de requête proviennent des schémas Zod déclarés dans `@Body`.

Au démarrage, les opérations du contrat sont comparées aux routes des contrôleurs
enregistrés dans Nest, via Swagger. La comparaison tient compte de la méthode HTTP,
du préfixe `/api` et des paramètres de chemin. Les opérations absentes portent la
mention **Non implémentée**.

## Run tests

| Commande | Tests sélectionnés | PostgreSQL requis |
| --- | --- | --- |
| `npm test` | Tous les tests unitaires et HTTP avec dépendances simulées | Non |
| `npm run test:unit` | `src/**/*.spec.ts`, près des classes testées | Non |
| `npm run test:http` | `test/http/**/*.http-spec.ts`, requêtes Supertest | Non |
| `npm run test:integration` | `test/integration/**/*.integration-spec.ts`, connexion et dépôts réels | Oui |
| `npm run test:e2e` | `test/*.e2e-spec.ts`, parcours HTTP avec la base réelle | Oui |

`npm run test:cov` mesure la couverture des tests sans PostgreSQL et génère les
rapports dans `coverage`. Les tests HTTP des cartes utilisent des dépôts TypeORM
simulés ; leurs contraintes SQL sont vérifiées séparément par les tests
d'intégration.

`npm run test:cov:identity` sélectionne les tests unitaires de `src/identity`
et les tests HTTP de `test/http/identity`, sans PostgreSQL. La couverture porte
sur `src/identity/**/*.ts` et les rapports sont générés dans `coverage/identity`.

Pour exécuter toutes les catégories, lancer `npm test`, puis
`npm run test:integration -- --runInBand` et `npm run test:e2e -- --runInBand`
avec la base configurée et démarrée.

## Intégration continue (CI)

Le workflow [CI backend](.github/workflows/ci.yml) s'exécute sur GitHub Actions
à chaque push et pull request. Il peut aussi être lancé manuellement depuis
l'onglet **Actions** une fois le workflow présent sur la branche principale.

Sur Ubuntu avec Node.js 24, il exécute dans cet ordre :

1. `npm ci` pour installer les versions du `package-lock.json`.
2. `npm run format:check`,`npm run lint` puis `npm run build`.
3. `npm test -- --ci --runInBand` pour les tests unitaires et HTTP.
4. `npm run test:integration -- --ci --runInBand`.
5. `npm run test:e2e -- --ci --runInBand`.

Les tests avec base de données utilisent un service PostgreSQL 17 temporaire,
créé pour chaque job. Les scripts `pretest:integration` et `pretest:e2e`
appliquent les migrations automatiquement. Les suites s'exécutent successivement
pour éviter les interférences entre leurs données de test.

Aucun fichier `.env` ni secret GitHub n'est nécessaire : le workflow définit
des identifiants et un `JWT_SECRET` réservés à cette base de test éphémère.
Une nouvelle exécution annule la précédente pour la même branche ou pull request.

Après avoir poussé le workflow, consulter **Actions → CI backend** pour voir
le résultat et les logs de chaque étape. Pour rendre la CI obligatoire avant
fusion, ajouter le contrôle **Lint, build et tests** aux contrôles requis de
la règle de protection de la branche concernée, après sa première exécution.

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Observability

In production applications, observability is essential for understanding how your system behaves, detecting issues early, and maintaining reliable performance.

[NestJS Observe](https://observe.nestjs.com) automatically instruments your NestJS application, giving you deep visibility into your system with minimal setup:

- **Distributed tracing:** Follow requests across services and understand how they flow through your system.
- **Waterfall analysis:** Visualize request execution and identify slow operations, bottlenecks, and unexpected delays.
- **Performance analysis:** Analyze application performance in real time and quickly pinpoint areas that need optimization.
- **Metrics:** Track key application and infrastructure metrics to understand system health and performance trends.
- **Logging:** Centralize and correlate logs with traces and other telemetry to make debugging easier.
- **Error tracking:** Detect errors quickly and investigate their root causes with the surrounding context.
- **SLA monitoring:** Track service-level objectives and identify when your application is approaching or exceeding defined thresholds.
- **Alarms and alerts:** Set up alerts for critical errors, performance degradation, SLA violations, and other anomalies so your team can react quickly.

To add it to this project:

```bash
$ npm install @nestjs/observe
```

Then follow the [setup guide](https://docs.nestjs.com/observability/overview) - it takes a single import and an app key.

The free plan needs no payment details and covers 300,000 events a month. You can also browse the [live demo](https://www.observe-demo.nestjs.com/dashboard) first - the whole dashboard over a busy service's data, with nothing to install.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Auto-instrument your application with [NestJS Observe](https://observe.nestjs.com). Distributed tracing, metrics, and logging made easy. Error tracking and performance monitoring for your NestJS applications.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
