# Cahier des charges — API Kanban Board

> Contrat de référence pour l'exercice de veille technologique backend (NestJS / Symfony / Spring Boot).
> Ce document liste les fonctionnalités et les routes attendues, **indépendamment du framework choisi**. C'est ce contrat commun qui permettra de comparer les implémentations à la fin de l'exercice.

## Contexte

Vous êtes responsable technique d'une start-up et vous avez carte blanche sur la stack backend. Le projet fil rouge est une API pour une application de **Kanban Board** (utilisateurs, listes, cartes).

## Fonctionnalités attendues (rappel du sujet)

1. Inscrire un nouvel utilisateur et connecter un utilisateur
2. Changer les informations (droits inclus) d'un utilisateur
3. Créer une nouvelle liste
4. Créer une nouvelle carte dans une liste et modifier la carte (titre, description, etc.)
5. Supprimer une carte ou une liste
6. Documenter l'API (point d'entrée Swagger, ex. `/api`)

## Modèle de données (indicatif)

- **User** : `id`, `email`, `password` (haché), `name`, `role` (`user` \| `admin`), `createdAt`
- **List** : `id`, `title`, `position`, `ownerId`, `createdAt`
- **Card** : `id`, `title`, `description`, `position`, `listId`, `createdAt`, `updatedAt`

Libre à vous d'adapter les noms de champs à votre implémentation, tant que les routes et leur comportement respectent ce cahier des charges.

## Règles transverses (s'appliquent à toutes les routes concernées)

### Propriété des ressources

- Une **List** appartient à l'utilisateur qui l'a créée (`ownerId`). Une **Card** hérite du propriétaire de sa liste.
- Un utilisateur ne peut **modifier ou supprimer** qu'une liste ou une carte dont il est l'auteur. Toute tentative sur une ressource dont il n'est pas l'auteur renvoie **403 Forbidden** (pas 404 : on choisit ici d'être explicite sur le refus de droits plutôt que de masquer l'existence de la ressource — c'est un choix assumé, une variante en 404 "opaque" est acceptable si vous la justifiez dans votre README).
- `GET /api/lists` ne retourne que les listes de l'utilisateur connecté (scoping implicite : pas besoin de 403 puisqu'aucune ressource tierce n'est exposée dans une liste de résultats).
- Ce contrôle de propriété s'ajoute au contrôle d'authentification (401) et de rôle (403 admin/non-admin sur `/api/users/{id}`) : les deux sont des cas de 403 distincts, à tester séparément.

### Sécurité des réponses

- Le champ `password` (haché ou non) **ne doit jamais apparaître** dans une réponse API, quelle que soit la route qui retourne un objet utilisateur (`register`, `users/me`, `PATCH /users/{id}`, etc.).
- `POST /api/auth/login` retourne un **JWT** dans `accessToken`. Ce token embarque au minimum l'identifiant de l'utilisateur (claim `sub` ou équivalent) et une date d'expiration (claim `exp`) ; une durée d'expiration courte (ex. 1h) est recommandée. L'API ne renvoie jamais le mot de passe, y compris au login.

## Routes attendues

Toutes les routes sont préfixées par `/api` (c'est aussi le point d'entrée de la documentation Swagger).

### Authentification & utilisateurs

| Méthode | Route | Description | Auth requise | Corps / Réponse |
|---|---|---|---|---|
| POST | `/api/auth/register` | Inscrire un nouvel utilisateur | Non | Body: `email, password, name` → 201 + user (**sans** `password`) |
| POST | `/api/auth/login` | Connecter un utilisateur | Non | Body: `email, password` → 200 + `accessToken` (JWT) |
| GET | `/api/users/me` | Récupérer le profil de l'utilisateur connecté | Oui | 200 + user (**sans** `password`) |
| PATCH | `/api/users/{id}` | Modifier les informations d'un utilisateur (y compris son rôle/droits) | Oui + auteur ou admin | Body: champs modifiés → 200 + user à jour (**sans** `password`) |

### Listes

| Méthode | Route | Description | Auth requise | Corps / Réponse |
|---|---|---|---|---|
| GET | `/api/lists` | Lister les listes de l'utilisateur connecté | Oui | 200 + tableau de listes (scopé à l'utilisateur) |
| POST | `/api/lists` | Créer une nouvelle liste | Oui | Body: `title` → 201 + liste créée (l'utilisateur en devient l'auteur) |
| PATCH | `/api/lists/{id}` | Modifier une liste (titre, position) | Oui + auteur | Body: champs modifiés → 200 + liste à jour |
| DELETE | `/api/lists/{id}` | Supprimer une liste | Oui + auteur | 204 |

### Cartes

| Méthode | Route | Description | Auth requise | Corps / Réponse |
|---|---|---|---|---|
| GET | `/api/lists/{listId}/cards` | Lister les cartes d'une liste | Oui + auteur de la liste | 200 + tableau de cartes |
| POST | `/api/lists/{listId}/cards` | Créer une nouvelle carte dans une liste | Oui + auteur de la liste | Body: `title, description?` → 201 + carte créée |
| GET | `/api/cards/{id}` | Récupérer une carte | Oui + auteur de la liste parente | 200 + carte |
| PATCH | `/api/cards/{id}` | Modifier une carte (titre, description, position, liste) | Oui + auteur de la liste parente (et de la liste cible en cas de déplacement) | Body: champs modifiés → 200 + carte à jour |
| DELETE | `/api/cards/{id}` | Supprimer une carte | Oui + auteur de la liste parente | 204 |

### Documentation

| Méthode | Route | Description |
|---|---|---|
| GET | `/api` | Documentation Swagger / OpenAPI interactive (Swagger UI ou équivalent) |

## Critères d'acceptation

- Toutes les routes ci-dessus sont implémentées et répondent aux codes HTTP attendus.
- L'authentification protège les routes marquées "Oui" (401 si absente/invalide).
- La documentation Swagger est accessible sur `/api` et permet de tester chaque route directement depuis le navigateur.
- Le fichier `openapi.yaml` fourni dans ce repo peut être importé tel quel dans Swagger UI / Postman / Insomnia pour valider le contrat, quel que soit le framework choisi.

**Le détail ticket par ticket** — user story, critères d'acceptation Given/When/Then (cas nominal **et** cas d'erreur : 400/401/403/404/409 selon le ticket), priorité et estimation — est dans `TICKETS.md`. La Definition of Done commune à tous les tickets (couverture de test, documentation Swagger, gestion des erreurs) est dans `DEFINITION_OF_DONE.md`.

## Aller plus loin (optionnel)

- Tests d'API et fixtures
- Base de données GraphQL en complément du REST
- Réflexion sur la performance et l'optimisation propres à la techno choisie

## Livrables finaux (rappel)

- Le code de l'API
- `rapport-veille-back.pdf` (présentation des 3 technos + justification du choix, ~200 mots chacun)
- Un README détaillé du projet
- Repository GitHub public : `github.com/prenom-nom/veille-techno-backend`
