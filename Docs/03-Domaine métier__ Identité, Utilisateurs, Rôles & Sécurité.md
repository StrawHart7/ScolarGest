# 03 — Domaine métier : Identité, Utilisateurs, Rôles & Sécurité

## Spécifications fonctionnelles — Version 2.0

---

# 1. Objectif du domaine

Ce domaine gère tout ce qui concerne :

* les personnes utilisant la plateforme ;
* leur authentification (via Supabase Auth) ;
* leur step-up auth (PIN d'approbation) ;
* leurs droits et rôle ;
* leur appartenance à un établissement ;
* la traçabilité des actions.

Il constitue la base de sécurité de toute l'application.

---

# 2. Principes métier

## 2.1 Séparation entre utilisateur et personne métier

Un compte de connexion n'est pas forcément une personne métier.

Exemple : un Directeur possède un compte utilisateur pour accéder au système. Un élève est dans la base sans avoir de compte.

La séparation permet :

* de désactiver un accès sans supprimer une personne ;
* d'ajouter plus tard des accès parents/élèves ;
* de distinguer authentification et informations métier.

## 2.2 Compte obligatoire pour tout enseignant actif

Tout enseignant avec le statut `ACTIF` doit avoir un compte Clerk avec un email valide. Pas d'enseignant actif sans compte. Un email est donc obligatoire à la création d'un enseignant actif.

---

# 3. Entité Utilisateur

## Rôle

Représente une personne capable de se connecter à la plateforme.

## Structure

```text
Utilisateur
------------
id                     -- même UUID que auth.users.id (Supabase Auth)
etablissement_id
nom
prenom
email
telephone
role                   -- SUPER_ADMIN | DIRECTEUR | SECRETAIRE | COMPTABLE | ENSEIGNANT
statut                 -- ACTIF | INACTIF | BLOQUE
pin_approbation_hash   -- PIN 6 chiffres hashé (pour step-up auth)
dernier_acces
created_at
updated_at
```

Champs absents (gérés par Supabase Auth) : `mot_de_passe_hash`, `token_reinitialisation`, `expiration_token`.

Les claims `etablissement_id` et `role` sont injectés dans le JWT via un Supabase Auth Hook (`app_metadata`) — pas besoin de requête supplémentaire pour les lire côté serveur.

---

# 4. Statut utilisateur

| Statut | Signification |
|---|---|
| `ACTIF` | Compte utilisable |
| `INACTIF` | Désactivé volontairement (ex. départ d'un secrétaire) |
| `BLOQUE` | Blocage sécurité (ex. tentatives suspectes) |

---

# 5. Authentification principale — Supabase Auth

Supabase Auth est le fournisseur d'identité unique. Il gère :

* connexion / déconnexion (email + mot de passe) ;
* sécurité des mots de passe ;
* sessions et leur expiration ;
* récupération de compte ;
* invitations par email.

Dans Next.js : `@supabase/ssr` gère les cookies de session. Le middleware lit le JWT à chaque requête et en extrait les claims.

Notre application ne stocke jamais de mot de passe.

---

# 6. Step-up auth — PIN d'approbation

Pour les actions d'approbation (valider/rejeter une demande de modification de note), un second facteur applicatif est requis : un **PIN à 6 chiffres**.

* Stocké hashé dans `pin_approbation_hash` (notre base, pas Clerk)
* Distinct du mot de passe Clerk
* Requis juste avant l'action de validation — empêche une validation accidentelle
* Tout utilisateur recevant des demandes d'approbation doit en posséder un (actuellement : la Secrétaire)
* Le Directeur et la Secrétaire possèdent également ce PIN pour les modifications post-clôture d'année

---

# 7. Relation utilisateur / établissement

Un utilisateur appartient à un seul établissement. Relation :

```text
Etablissement 1 → N Utilisateurs
```

> Un établissement = un écosystème fermé.

Multi-établissement (ex. portail parent sur plusieurs écoles) : hors MVP.

---

# 8. Rôles MVP

Cinq rôles fixes. Pas de système de rôles dynamique en v1.

## SUPER_ADMIN

Équipe interne de la plateforme.

Accès : établissements, abonnements, support, administration SaaS.

## DIRECTEUR

Responsable principal de l'établissement.

Accès complet : configuration, utilisateurs, élèves, enseignants, notes (lecture), finance, rapports, flux d'activité.

Droits spéciaux : modifications sur années `TERMINEE` (avec PIN).

## SECRETAIRE

Gestion administrative.

Accès :
* élèves, inscriptions, documents ;
* création et génération de bulletins (sans validation requise) ;
* file d'approbation des modifications de notes (avec PIN) ;
* lecture seule sur les notes et la finance.

Droits spéciaux : modifications sur années `TERMINEE` (avec PIN).

## COMPTABLE

Gestion financière.

Accès : frais, factures, paiements, reçus, rapports financiers.

Lecture seule : élèves, classes (pour contextualiser les paiements).

## ENSEIGNANT

Accès pédagogique limité à ses affectations.

Accès :
* classes et matières affectées ;
* saisie des notes sur ses évaluations ;
* consultation des élèves de ses classes ;
* demande de modification d'une note déjà soumise (déclenche le workflow).

Ne peut pas : modifier paiements, voir d'autres classes, modifier ses propres affectations.

---

# 9. Attribution des rôles

Un utilisateur a un seul rôle dans le MVP. Multi-rôles (ex. Directeur + Comptable) : hors MVP.

---

# 10. Profil métier

Les informations métier détaillées ne sont pas dans `Utilisateur`.

```text
Utilisateur
    ↓
Enseignant (si rôle ENSEIGNANT)
    ↓
AffectationEnseignant
```

---

# 11. Workflow d'approbation — modification de note

C'est le seul vrai workflow avec file d'attente de la v1.

**Déclencheur** : un Enseignant modifie une note déjà soumise.

**Flux** :

```text
Enseignant soumet une demande de modification
    ↓
Note passe en statut EN_ATTENTE
    ↓
Secrétaire voit la demande dans sa file d'approbation (modal à la connexion)
    ↓
Secrétaire saisit son PIN (step-up auth)
    ↓
Action : Valider | Rejeter | Proposer une modification
    ↓
Note passe en statut VALIDE | REJETE
```

Tant que la note n'a pas été soumise, l'Enseignant peut la modifier librement sans workflow.

**Statuts de note** : `BROUILLON` | `SOUMISE` | `EN_ATTENTE` | `VALIDE` | `REJETE`

---

# 12. Journalisation — AuditLog

Toutes les actions sensibles doivent être enregistrées.

```text
AuditLog
---------
id
etablissement_id
user_id
action
module
objet_type
objet_id
ancienne_valeur
nouvelle_valeur
date
```

Actions auditées obligatoirement :

* connexion ;
* création / désactivation utilisateur ;
* modification / annulation paiement ;
* soumission / modification note ;
* validation d'approbation (avec résultat) ;
* génération de bulletin ;
* changement de rôle.

---

# 13. Sécurité multi-tenant

Règle absolue : chaque requête métier est filtrée par `etablissement_id` via la couche repository.

Un enseignant de l'école A ne peut jamais accéder aux données de l'école B.

---

# 14. Flux de création d'un utilisateur

## Directeur initial (création d'une école)

```text
SUPER_ADMIN crée l'établissement
    ↓
SUPER_ADMIN crée l'utilisateur Directeur
    ↓
supabase.auth.admin.inviteUserByEmail() → invitation envoyée
    ↓
Auth Hook injecte etablissement_id + role dans app_metadata
    ↓
Directeur accepte l'invitation et définit son mot de passe
    ↓
Compte actif — JWT signé avec les claims
```

## Autres utilisateurs (ajoutés par le Directeur)

```text
Directeur ajoute un utilisateur (email + rôle)
    ↓
supabase.auth.admin.inviteUserByEmail() → invitation envoyée
    ↓
Utilisateur accepte et active son compte
    ↓
Utilisateur définit son PIN d'approbation (si rôle concerné)
```

---

# 15. Décisions MVP

| Sujet | Décision |
|---|---|
| Authentification | Supabase Auth (pas de gestion interne de mots de passe) |
| Step-up auth | PIN 6 chiffres hashé en interne |
| Multi-établissement | Non partagé entre écoles |
| Utilisateur multi-écoles | Non MVP |
| Rôles | 5 rôles fixes |
| Permissions dynamiques | Reportées |
| Audit | Inclus |
| Suppression définitive | Évitée — statuts uniquement |
| Super admin | Inclus |
| Workflow approbation notes | Inclus (Secrétaire + PIN) |
| Compte enseignant | Obligatoire pour tout enseignant actif |

---

# 16. Hors MVP

Reporté :

* authentification parent ;
* authentification élève ;
* connexion multi-écoles ;
* MFA ;
* gestion fine des permissions par établissement ;
* multi-rôles.

---

# Résumé du domaine

Le système d'identité fournit une base sécurisée permettant :

* à notre équipe de gérer la plateforme (SUPER_ADMIN) ;
* aux écoles de gérer leurs utilisateurs (Directeur) ;
* aux employés d'avoir des accès adaptés à leur rôle ;
* de garantir une séparation stricte entre établissements ;
* de protéger les actions sensibles par step-up auth (PIN).
