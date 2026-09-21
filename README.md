# Veille Technologique Backend — Kanban Board API (template)

Base de démarrage commune pour l'exercice de veille technologique backend (NestJS / Symfony / Spring Boot) — La Plateforme, Master 1 Développement.

Ce repository (une fois publié en tant que **template GitHub**, voir `GITHUB_SETUP.md`) permet à chaque élève de partir d'une copie indépendante avec :

- **`CAHIER_DES_CHARGES.md`** — les fonctionnalités et routes attendues, indépendamment du framework choisi.
- **`openapi.yaml`** — le contrat d'API (Swagger/OpenAPI), testable immédiatement dans Swagger Editor, Postman ou Insomnia, avant même d'avoir codé quoi que ce soit.
- **`TICKETS.md`** — le backlog détaillé : chaque ticket avec sa user story, ses critères d'acceptation (cas nominal **et** cas d'erreur explicites), sa priorité (MoSCoW) et son estimation.
- **`DEFINITION_OF_DONE.md`** — la Definition of Done commune à tous les tickets : couverture de test ≥ 80 %, documentation Swagger à jour, gestion des erreurs conforme.
- **`backlog.csv`** — le même backlog, prêt à importer en masse dans un GitHub Project.
- **`.github/ISSUE_TEMPLATE/feature.yml`** — un formulaire d'issue qui impose la structure (domaine, priorité, user story, critères d'acceptation nominal/erreurs, checklist DoD) à chaque nouveau ticket créé.
- **`GITHUB_PROJECT_SETUP.md`** — comment monter le board Kanban : attributs des tickets et regroupement par domaine (équivalent de swimlanes).

## Pourquoi ce contrat est commun

Le choix de la techno (NestJS, Symfony ou Spring Boot) est libre, mais **le contrat d'API est identique pour tout le monde**. C'est ce qui permet, en fin de veille, de comparer les implémentations sur un même socle fonctionnel plutôt que de comparer des projets qui n'auraient rien en commun.

## Pour démarrer

1. Dupliquez ce repo (bouton "Use this template" une fois qu'il est configuré comme template).
2. Lisez `CAHIER_DES_CHARGES.md`, puis `TICKETS.md` et `DEFINITION_OF_DONE.md`.
3. Importez `openapi.yaml` dans Swagger Editor / Postman pour visualiser le contrat.
4. Mettez en place votre GitHub Project à partir de `GITHUB_PROJECT_SETUP.md`.
5. Implémentez l'API dans le framework de votre choix, en respectant les routes du contrat et en cochant la DoD ticket par ticket.
6. Exposez votre propre documentation Swagger sur `/api`.
7. Rédigez votre rapport de veille (`rapport-veille-back.pdf`) et un README détaillé de votre projet final.
