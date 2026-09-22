# Mettre en place le repo template GitHub

Ce dossier contient tout ce qu'il faut pour créer un repository GitHub que chaque élève pourra dupliquer indépendamment ("fork" fonctionnel via les templates GitHub — Jira ne le permet pas nativement, d'où ce choix).

## 1. Créer le repository

1. Créez un nouveau repository, par exemple `veille-techno-backend-template`.
2. Ajoutez-y tous les fichiers et dossiers de ce dossier, y compris le dossier `.github/` (le formulaire d'issue ne fonctionne que s'il est bien à la racine du repo, dans `.github/ISSUE_TEMPLATE/`) :
   - `README.md`
   - `CAHIER_DES_CHARGES.md`
   - `DEFINITION_OF_DONE.md`
   - `TICKETS.md`
   - `GITHUB_PROJECT_SETUP.md`
   - `openapi.yaml`
   - `backlog.csv`
   - `.github/ISSUE_TEMPLATE/feature.yml`
   - `.github/ISSUE_TEMPLATE/config.yml`
3. Dans **Settings → General**, cochez **"Template repository"**.

À partir de là, chaque élève voit un bouton **"Use this template"** sur la page du repo : il crée sa propre copie indépendante dans son compte, sans historique lié à l'original — y compris le formulaire d'issue et la DoD. C'est l'équivalent d'un vrai "fork" personnel, ce que Jira ne propose pas.

## 2. Créer le GitHub Project (Kanban)

Voir `GITHUB_PROJECT_SETUP.md` pour la configuration complète : champs personnalisés (Type, Domaine, Priorité, Estimation), colonnes de statut, et le regroupement ("Group by") qui fait office de swimlanes par domaine.

Si tu veux que les élèves puissent aussi dupliquer le Project lui-même (pas seulement le repo) : rends-le public, puis chacun peut utiliser **"Make a copy"** en choisissant son propre compte comme propriétaire de la copie.

## 3. Vérifier le contrat d'API fourni

Le fichier `openapi.yaml` est testable immédiatement, avant même d'avoir écrit une ligne de backend :

- **Swagger Editor** : https://editor.swagger.io → coller/importer `openapi.yaml`
- **Postman** : Import → File → `openapi.yaml` (génère automatiquement une collection de requêtes)
- **Insomnia** : Import → From File → `openapi.yaml`

Une fois l'API développée par l'élève (NestJS, Symfony ou Spring Boot), il branche sa propre implémentation de Swagger UI sur `/api` en s'alignant sur ce même contrat.
