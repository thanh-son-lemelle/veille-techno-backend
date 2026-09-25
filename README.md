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

## Configuration de la base de données

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

Au démarrage, `AppModule` valide les variables d'environnement avec Zod puis
établit la connexion TypeORM. Les entités enregistrées avec
`TypeOrmModule.forFeature(...)` sont chargées automatiquement. La synchronisation
du schéma est désactivée (`synchronize: false`) : le démarrage ne crée ni ne modifie
les tables.

Pour vérifier la connexion réelle, lancer `npm run test:e2e -- --runInBand`.
Cette suite utilise la base configurée dans `.env` : elle vérifie la connexion
avec `SELECT 1`, puis teste l'inscription et la connexion avec des utilisateurs
temporaires supprimés après chaque test. Utiliser une base dédiée aux tests.

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
Le contrat de référence est [docs/openapi.yaml](docs/openapi.yaml).

Au démarrage, les opérations du contrat sont comparées aux routes des contrôleurs
enregistrés dans Nest, via Swagger. La comparaison tient compte de la méthode HTTP,
du préfixe `/api` et des paramètres de chemin. Les opérations absentes portent la
mention **Non implémentée**.

## Connexion utilisateur

La route publique `POST /api/auth/login` accepte un objet JSON contenant uniquement
`email` et `password`. L'email doit être valide et le mot de passe doit être une
chaîne non vide.

```json
{ "email": "alice@example.com", "password": "MotDePasse123!" }
```

- **200** : retourne `{ "accessToken": "<JWT>" }`. Le JWT est signé en HS256 avec
  `JWT_SECRET` et expire après une heure. Il contient `sub` (identifiant de
  l'utilisateur), `iat` (date d'émission) et `exp` (date d'expiration), sans mot de
  passe ni hash.
- **401** : retourne le même message `Identifiants invalides.` pour un email
  inconnu ou un mot de passe incorrect.
- **400** : un corps invalide retourne `statusCode: 400`, un tableau `message`
  précisant les erreurs de validation et `error: "Bad Request"`.

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

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
