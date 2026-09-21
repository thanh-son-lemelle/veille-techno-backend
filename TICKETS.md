# Backlog détaillé — Kanban Board API

Chaque ticket ci-dessous est prêt à être copié tel quel dans une issue GitHub (voir `.github/ISSUE_TEMPLATE/feature.yml`), ou dans un item de GitHub Project. Les champs **Type**, **Domaine**, **Priorité** et **Estimation** correspondent aux champs personnalisés à créer dans le Project (voir `GITHUB_PROJECT_SETUP.md`).

Priorité en MoSCoW : **Must have** (bloquant pour rendre le projet), **Should have** (attendu mais non bloquant), **Could have** (bonus).

La **Definition of Done** générale (`DEFINITION_OF_DONE.md`) s'applique à chaque ticket ; seules les exigences spécifiques au ticket sont rappelées ici.

> **Règles transverses valables sur tous les tickets concernés** (détaillées dans `CAHIER_DES_CHARGES.md`) :
> - **Propriété** : une liste appartient à son créateur, une carte hérite du propriétaire de sa liste. Agir (modifier/supprimer) sur une ressource dont on n'est pas l'auteur → **403 Forbidden**. C'est un cas d'erreur différent du 401 (pas authentifié) et doit être testé séparément.
> - **Sécurité** : le champ `password` n'apparaît **jamais** dans une réponse, sur aucune route.
> - **JWT** : `POST /api/auth/login` retourne un `accessToken` de type JWT (claims minimum : id utilisateur, expiration).

---

## Domaine : Infra

### Initialisation du projet
**Type** : Chore · **Priorité** : Must have · **Estimation** : 3

**Description** : Mettre en place le squelette du framework choisi, la connexion à la base de données et la configuration d'environnement.

**Critères d'acceptation**
- ✅ Nominal — Given un environnement local configuré (variables d'environnement renseignées), When je lance la commande de démarrage du projet, Then le serveur démarre et répond sur le port configuré.
- ⚠️ Erreur — Given une variable d'environnement critique manquante (ex. URL de base de données), When je lance le serveur, Then le démarrage échoue avec un message d'erreur explicite (pas un crash silencieux ni une erreur bas niveau illisible).

---

### Documentation Swagger de base
**Type** : Chore · **Priorité** : Must have · **Estimation** : 2

**Description** : Exposer une documentation interactive sur `/api`, alignée sur le contrat `openapi.yaml` fourni.

**Critères d'acceptation**
- ✅ Nominal — Given le serveur démarré, When je visite `/api`, Then je vois une interface Swagger listant toutes les routes du contrat.
- ⚠️ Erreur — Given une route du contrat pas encore implémentée, When elle apparaît dans la documentation, Then elle est identifiable comme non finalisée plutôt que silencieusement absente ou trompeuse.

---

## Domaine : Auth & Users

### Inscription utilisateur
**Type** : Feature · **Priorité** : Must have · **Estimation** : 3
**Route** : `POST /api/auth/register`

**User story** : En tant que visiteur, je veux créer un compte afin d'accéder à l'application.

**Critères d'acceptation**
- ✅ Nominal — Given un email non utilisé et un mot de passe valide, When j'appelle la route avec `email`, `password`, `name`, Then je reçois **201** et l'utilisateur créé. **Le champ `password` n'apparaît sous aucune forme (ni en clair, ni haché) dans la réponse.**
- ⚠️ Erreur (conflit) — Given un email déjà utilisé, When j'appelle la route, Then je reçois **409** avec un message explicite.
- ⚠️ Erreur (validation) — Given un email au format invalide ou un mot de passe trop court, When j'appelle la route, Then je reçois **400** précisant le(s) champ(s) en erreur.

**Exigence spécifique** : le mot de passe est haché avant stockage (jamais en clair, y compris dans les logs applicatifs).

---

### Connexion utilisateur
**Type** : Feature · **Priorité** : Must have · **Estimation** : 2
**Route** : `POST /api/auth/login`

**User story** : En tant qu'utilisateur inscrit, je veux me connecter afin d'obtenir un accès authentifié à l'API.

**Critères d'acceptation**
- ✅ Nominal — Given des identifiants valides, When j'appelle la route, Then je reçois **200** et un objet `{ "accessToken": "<JWT>" }`. Le JWT contient au minimum l'identifiant de l'utilisateur (claim `sub`) et une date d'expiration (claim `exp`, ex. 1h). **Aucune information sur le mot de passe n'est présente dans la réponse ni dans le token.**
- ⚠️ Erreur — Given un email inconnu **ou** un mot de passe incorrect, When j'appelle la route, Then je reçois **401** avec un message générique qui ne précise pas lequel des deux est en cause (bonne pratique de sécurité — ne pas révéler si l'email existe).

---

### Profil de l'utilisateur connecté
**Type** : Feature · **Priorité** : Should have · **Estimation** : 1
**Route** : `GET /api/users/me`

**Critères d'acceptation**
- ✅ Nominal — Given un token valide, When j'appelle la route, Then je reçois **200** et les informations de l'utilisateur courant. **Le champ `password` n'apparaît pas dans la réponse.**
- ⚠️ Erreur — Given aucun token, ou un token invalide/expiré, When j'appelle la route, Then je reçois **401**.

---

### Modification d'un utilisateur (droits inclus)
**Type** : Feature · **Priorité** : Must have · **Estimation** : 3
**Route** : `PATCH /api/users/{id}`

**User story** : En tant qu'utilisateur, je veux modifier mes informations ; en tant qu'admin, je veux pouvoir changer le rôle d'un autre utilisateur.

**Critères d'acceptation**
- ✅ Nominal — Given un utilisateur authentifié qui modifie son propre profil avec des champs valides, When il appelle la route, Then il reçoit **200** et l'utilisateur à jour. **Le champ `password` n'apparaît pas dans la réponse.**
- ⚠️ Erreur (propriété/droits) — Given un utilisateur non-admin qui tente de modifier **un profil qui n'est pas le sien** (quel que soit le champ, pas seulement le rôle), When il appelle la route, Then il reçoit **403**.
- ⚠️ Erreur (droits, cas particulier) — Given un utilisateur (même auteur de son propre profil) qui tente de modifier son propre `role`, When il appelle la route, Then il reçoit **403** (seul un admin peut changer un rôle).
- ⚠️ Erreur (introuvable) — Given un `id` qui n'existe pas, When on appelle la route, Then **404**.
- ⚠️ Erreur (validation) — Given un payload invalide (ex. rôle non reconnu), When on appelle la route, Then **400**.

---

## Domaine : Listes

### Lister les listes
**Type** : Feature · **Priorité** : Must have · **Estimation** : 1
**Route** : `GET /api/lists`

**Critères d'acceptation**
- ✅ Nominal — Given un utilisateur authentifié, When il appelle la route, Then il reçoit **200** et un tableau contenant **uniquement ses propres listes** (vide si aucune liste). Les listes des autres utilisateurs ne doivent jamais apparaître (scoping par utilisateur, pas de fuite de données).
- ⚠️ Erreur — Given une requête non authentifiée, When elle est appelée, Then **401**.

---

### Créer une liste
**Type** : Feature · **Priorité** : Must have · **Estimation** : 2
**Route** : `POST /api/lists`

**Critères d'acceptation**
- ✅ Nominal — Given un titre valide, When j'appelle la route, Then je reçois **201** et la liste créée, avec l'utilisateur courant comme auteur (`ownerId`).
- ⚠️ Erreur — Given un titre vide ou absent, When j'appelle la route, Then je reçois **400**.
- ⚠️ Erreur — Given une requête non authentifiée, When elle est appelée, Then **401**.

---

### Modifier une liste
**Type** : Feature · **Priorité** : Should have · **Estimation** : 2
**Route** : `PATCH /api/lists/{id}`

**Critères d'acceptation**
- ✅ Nominal — Given une liste existante **dont je suis l'auteur** et un payload valide, When j'appelle la route, Then je reçois **200** et la liste à jour.
- ⚠️ Erreur (propriété) — Given une liste existante **appartenant à un autre utilisateur**, When j'appelle la route, Then je reçois **403**.
- ⚠️ Erreur — Given un `id` inconnu, When j'appelle la route, Then **404**.
- ⚠️ Erreur — Given un payload invalide, When j'appelle la route, Then **400**.

---

### Supprimer une liste
**Type** : Feature · **Priorité** : Must have · **Estimation** : 2
**Route** : `DELETE /api/lists/{id}`

**Critères d'acceptation**
- ✅ Nominal — Given une liste existante **dont je suis l'auteur**, When j'appelle la route, Then je reçois **204** et la liste n'apparaît plus dans `GET /api/lists`.
- ⚠️ Erreur (propriété) — Given une liste **appartenant à un autre utilisateur**, When j'appelle la route, Then je reçois **403**.
- ⚠️ Erreur — Given un `id` inconnu, When j'appelle la route, Then **404**.
- ⚠️ Erreur — Given une requête non authentifiée, When elle est appelée, Then **401**.

**À trancher et documenter dans le README** : que deviennent les cartes de la liste supprimée ? (suppression en cascade, ou refus si la liste n'est pas vide — les deux sont acceptables si c'est un choix assumé et documenté.)

---

## Domaine : Cartes

### Lister les cartes d'une liste
**Type** : Feature · **Priorité** : Must have · **Estimation** : 1
**Route** : `GET /api/lists/{listId}/cards`

**Critères d'acceptation**
- ✅ Nominal — Given une liste existante **dont je suis l'auteur**, When j'appelle la route, Then je reçois **200** et le tableau de ses cartes.
- ⚠️ Erreur (propriété) — Given une liste existante **appartenant à un autre utilisateur**, When j'appelle la route, Then je reçois **403**.
- ⚠️ Erreur — Given une liste inconnue, When j'appelle la route, Then **404**.

---

### Créer une carte
**Type** : Feature · **Priorité** : Must have · **Estimation** : 2
**Route** : `POST /api/lists/{listId}/cards`

**Critères d'acceptation**
- ✅ Nominal — Given un titre valide et une liste **dont je suis l'auteur**, When j'appelle la route, Then je reçois **201** et la carte créée dans la bonne liste.
- ⚠️ Erreur (propriété) — Given une liste **appartenant à un autre utilisateur**, When j'appelle la route, Then je reçois **403** (je ne peux pas ajouter de carte dans la liste de quelqu'un d'autre).
- ⚠️ Erreur — Given un titre manquant, When j'appelle la route, Then **400**.
- ⚠️ Erreur — Given une liste inconnue, When j'appelle la route, Then **404**.

---

### Récupérer une carte
**Type** : Feature · **Priorité** : Should have · **Estimation** : 1
**Route** : `GET /api/cards/{id}`

**Critères d'acceptation**
- ✅ Nominal — Given une carte existante dont la liste parente m'appartient, When j'appelle la route, Then **200** et la carte.
- ⚠️ Erreur (propriété) — Given une carte dont la liste parente **appartient à un autre utilisateur**, When j'appelle la route, Then **403**.
- ⚠️ Erreur — Given un `id` inconnu, When j'appelle la route, Then **404**.

---

### Modifier une carte
**Type** : Feature · **Priorité** : Must have · **Estimation** : 3
**Route** : `PATCH /api/cards/{id}`

**User story** : En tant qu'utilisateur, je veux modifier le titre, la description ou déplacer une carte vers une autre liste.

**Critères d'acceptation**
- ✅ Nominal — Given une carte existante dont la liste parente m'appartient et un payload valide, When j'appelle la route, Then **200** et la carte à jour (y compris si `listId` change vers une **autre liste dont je suis aussi l'auteur**).
- ⚠️ Erreur (propriété, carte) — Given une carte dont la liste parente **appartient à un autre utilisateur**, When j'appelle la route, Then **403**.
- ⚠️ Erreur (propriété, déplacement) — Given un déplacement de la carte vers une liste **cible appartenant à un autre utilisateur**, When j'appelle la route, Then **403** (même si la carte elle-même m'appartient).
- ⚠️ Erreur — Given une carte inconnue, When j'appelle la route, Then **404**.
- ⚠️ Erreur — Given un `listId` cible inconnu, When j'appelle la route, Then **404**.
- ⚠️ Erreur — Given un payload invalide, When j'appelle la route, Then **400**.

---

### Supprimer une carte
**Type** : Feature · **Priorité** : Must have · **Estimation** : 1
**Route** : `DELETE /api/cards/{id}`

**Critères d'acceptation**
- ✅ Nominal — Given une carte existante dont la liste parente m'appartient, When j'appelle la route, Then **204**.
- ⚠️ Erreur (propriété) — Given une carte dont la liste parente **appartient à un autre utilisateur**, When j'appelle la route, Then **403**.
- ⚠️ Erreur — Given un `id` inconnu, When j'appelle la route, Then **404**.
- ⚠️ Erreur — Given une requête non authentifiée, When elle est appelée, Then **401**.

---

## Domaine : Documentation & Qualité

### Rapport de veille technologique
**Type** : Documentation · **Priorité** : Must have · **Estimation** : 3

Rédiger `rapport-veille-back.pdf` : présentation des 3 technos (200 mots ± 20) + justification du choix (200 mots ± 20).

### README détaillé du projet
**Type** : Documentation · **Priorité** : Must have · **Estimation** : 1

Instructions de lancement, variables d'environnement, choix d'implémentation (ex. comportement de suppression en cascade, format exact du 403 vs 404 sur les ressources), lien vers `/api`.

### Mise en place des tests (fixtures)
**Type** : Chore · **Priorité** : Must have · **Estimation** : 2

Jeux de données de test / fixtures pour rejouer les scénarios nominaux et d'erreur ci-dessus de façon reproductible, **y compris deux utilisateurs distincts pour tester systématiquement les cas de propriété (403)**.

---

## Domaine : Bonus (aller plus loin)

### Tests d'API automatisés avancés
**Type** : Feature · **Priorité** : Could have · **Estimation** : 3

### API GraphQL en complément du REST
**Type** : Feature · **Priorité** : Could have · **Estimation** : 5

### Étude de performance / optimisation
**Type** : Documentation · **Priorité** : Could have · **Estimation** : 2
