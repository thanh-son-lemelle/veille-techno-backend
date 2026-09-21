# Mettre en place le GitHub Project (Kanban)

Ce document décrit comment configurer le board pour qu'il porte lui-même les bonnes pratiques : critères d'acceptation visibles, attributs par ticket, et des « lanes » qui regroupent visuellement les tickets par nature d'entité.

## 1. Créer le Project

1. Sur le repo (ou au niveau de ton compte/organisation) : **Projects → New project → Board**.
2. Nomme-le par exemple `Kanban Board API — Backlog`.

## 2. Créer les champs personnalisés (attributs des tickets)

Dans le Project, **onglet ⚙️ (Settings) → Fields → New field**, crée :

| Champ | Type | Valeurs |
|---|---|---|
| **Type** | Single select | `Feature`, `Bug`, `Chore`, `Documentation` |
| **Domaine** | Single select | `Infra`, `Auth & Users`, `Listes`, `Cartes`, `Documentation`, `Bonus` |
| **Priorité** | Single select | `Must have`, `Should have`, `Could have` |
| **Estimation** | Number | (story points, voir `TICKETS.md`) |

Le champ **Status** (colonnes du board) existe par défaut : configure-le avec `Backlog`, `À faire`, `En cours`, `En revue`, `Terminé`.

Ces attributs correspondent exactement aux métadonnées déjà indiquées dans chaque ticket de `TICKETS.md` et dans le formulaire d'issue `.github/ISSUE_TEMPLATE/feature.yml`.

## 3. Des « lanes » selon la nature de l'entité

GitHub Projects ne propose pas de swimlanes au sens strict (comme Jira), mais le même résultat s'obtient avec le **regroupement (Group by)** de la vue board :

1. Ouvre la vue Board du Project.
2. Clique sur **Group by** (en haut de la vue) → choisis le champ **Domaine**.

Le board affiche alors une lane horizontale par domaine (`Infra`, `Auth & Users`, `Listes`, `Cartes`, `Documentation`, `Bonus`), chacune avec ses propres colonnes de statut. C'est l'équivalent fonctionnel d'un swimlane Jira. Tu peux créer une seconde vue groupée par **Type** (Feature / Bug / Chore / Documentation) si tu veux basculer entre les deux lectures.

## 4. Créer les tickets

Deux méthodes, au choix :

- **Manuellement, avec le formulaire** : `Issues → New issue → Ticket fonctionnalité` fait apparaître le formulaire structuré (domaine, priorité, route, user story, critères d'acceptation nominal + erreurs, checklist DoD). Copie le contenu de chaque ticket de `TICKETS.md` dedans, puis ajoute l'issue au Project et renseigne ses champs (Type, Domaine, Priorité, Estimation).
- **Import rapide** : dans le Project, `+ Add item → Import from CSV` (ou glisser `backlog.csv`) pour créer rapidement tous les items avec Type/Domaine/Priorité/Estimation déjà remplis, puis compléter la description de chacun depuis `TICKETS.md`.

## 5. Automatisations utiles (optionnel)

Dans **Settings → Workflows** du Project :
- "Item added to project" → Status = `Backlog`
- "Item closed" → Status = `Terminé`
- "Pull request merged" → Status = `Terminé`

## Résultat attendu

Un board avec :
- des colonnes représentant le cycle de vie du ticket (`Backlog → À faire → En cours → En revue → Terminé`) ;
- des lanes horizontales par **Domaine** (ou Type), pour distinguer d'un coup d'œil une fonctionnalité d'un chore ou d'une tâche de documentation ;
- chaque ticket portant Type, Domaine, Priorité et Estimation ;
- chaque ticket documentant ses critères d'acceptation (nominal + erreurs) et cochant la Definition of Done avant de passer en `Terminé`.
