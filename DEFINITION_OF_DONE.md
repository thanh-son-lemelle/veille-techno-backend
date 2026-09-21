# Definition of Done (DoD)

Cette DoD s'applique à **tous les tickets de type Feature**, quel que soit le framework choisi (NestJS, Symfony, Spring Boot). Un ticket ne passe en colonne **Terminé** que si tous les points ci-dessous sont cochés.

## DoD générale — tickets Feature

- [ ] **Code implémenté** et relu (auto-review a minima ; pull request si travail à plusieurs)
- [ ] **Tests automatisés** couvrant :
  - [ ] le ou les cas nominaux décrits dans les critères d'acceptation
  - [ ] **chaque cas d'erreur** décrit dans les critères d'acceptation (400, 401, 403, 404, 409 selon le ticket)
- [ ] **Couverture de test** du module concerné ≥ 80 % (mesurée avec l'outil de coverage du framework : Jest pour NestJS, PHPUnit/Xdebug pour Symfony, JaCoCo pour Spring Boot)
- [ ] **Documentation Swagger/OpenAPI à jour** pour toute route ajoutée ou modifiée :
  - [ ] la route apparaît dans `/api`
  - [ ] tous les codes de réponse (succès **et** erreurs) sont documentés avec un exemple
  - [ ] le schéma de la ressource (body/response) est à jour
- [ ] **Gestion des erreurs conforme** aux critères d'acceptation : le bon code HTTP est renvoyé, avec un message exploitable (jamais une 500 sur un cas prévisible comme une validation ou une ressource introuvable)
- [ ] **Contrôle de propriété testé** : si le ticket manipule une liste ou une carte, un test vérifie explicitement le refus (403) quand la ressource appartient à un autre utilisateur
- [ ] **Aucune donnée sensible exposée** : un test vérifie que le champ `password` n'apparaît jamais dans une réponse qui retourne un utilisateur
- [ ] **Aucune régression** : la suite de tests complète du projet passe
- [ ] **Code mergé** sur la branche principale

## DoD allégée — tickets Chore / Infra

- [ ] Le résultat est vérifiable (le serveur démarre, la commande fonctionne, etc.)
- [ ] Documenté dans le README si un développeur qui arrive sur le projet en a besoin
- [ ] Pas de régression sur l'existant

## DoD — tickets Documentation

- [ ] Contenu relu (orthographe, clarté)
- [ ] Cohérent avec le contrat `openapi.yaml` et le `CAHIER_DES_CHARGES.md`
- [ ] Lié si besoin depuis le README

## Pourquoi ces deux exigences sont non négociables

- **La couverture de test** garantit que le comportement décrit dans les critères d'acceptation (y compris les cas d'erreur) est vérifié automatiquement, pas seulement testé à la main une fois.
- **La documentation Swagger** est le contrat vivant de l'API : sans elle, comparer les 3 implémentations à la fin de l'exercice serait impossible, et un tiers ne pourrait pas consommer l'API sans lire le code.
