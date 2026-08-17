# 02 — Architecture du système

## Principes techniques et structure globale — Version 2.0

---

# 1. Objectif architectural

L'architecture doit permettre de construire une plateforme SaaS scolaire :

* sécurisée ;
* multi-établissements ;
* maintenable ;
* évolutive ;
* capable de supporter l'ajout progressif de nouveaux modules.

Le système doit privilégier :

* la séparation des responsabilités ;
* la protection des données ;
* la stabilité du noyau métier ;
* l'évolution progressive.

---

# 2. Stack technique (figée)

| Couche | Technologie |
|---|---|
| Frontend / Full-stack | Next.js (App Router) + TypeScript |
| Styling | Tailwind CSS + shadcn/ui |
| Forms & Validation | react-hook-form + Zod |
| Server State | TanStack Query |
| Auth | Supabase Auth (`@supabase/ssr`) |
| Base de données | PostgreSQL via Supabase |
| ORM | Prisma |
| Stockage fichiers | Supabase Storage |
| Génération PDF | HTML → PDF via Playwright (server-side) |
| Tests unitaires | Vitest |
| Tests E2E | Playwright |
| Hébergement | Vercel + Supabase |

---

# 3. Architecture générale

Le système suit une architecture web SaaS moderne, 100 % en ligne (pas de mode hors-ligne).

```
Utilisateur
    |
Interface Web (Next.js App Router)
    |
Clerk Auth Middleware
    |
Server Actions / Route Handlers
    |
Service layer (logique métier)
    |
Data Access Layer (repository — injecte etablissement_id)
    |
Prisma → PostgreSQL (Supabase)
```

---

# 4. Architecture multi-tenant

## 4.1 Principe

La plateforme héberge plusieurs établissements. Chaque établissement constitue un environnement indépendant.

```
Plateforme SaaS
        |
 ----------------------
 |          |          |
Ecole A   Ecole B   Ecole C
```

Chaque donnée métier appartient obligatoirement à un établissement via `etablissement_id`.

---

## 4.2 Isolation des données — Repository pattern

Approche retenue : **isolation applicative stricte**.

Toutes les tables métier possèdent `etablissement_id`. La couche d'accès aux données (repository) injecte systématiquement ce filtre sur chaque requête. Aucune requête métier ne peut passer sans ce filtre.

Pas de Row Level Security (RLS) PostgreSQL en v1 — incompatible avec Prisma sans contournements fragiles. Peut être ajouté post-lancement si un audit de sécurité l'exige.

Exemple :

```typescript
// Toujours via le repository — jamais de requête directe sans tenant
const eleves = await eleveRepository.findAll({ etablissementId });
```

---

## 4.3 Pourquoi une base unique ?

* coût réduit ;
* maintenance simplifiée ;
* déploiement plus simple ;
* adapté au MVP ;
* suffisant avec une isolation applicative stricte.

---

# 5. Structure d'un établissement

L'établissement est la racine métier. Toutes les données scolaires en dépendent.

```
Etablissement
    |
Année scolaire
    |
Structure scolaire (cycles, niveaux, classes)
    |
Elèves / Enseignants / Notes / Paiements
```

---

# 6. Authentification — Supabase Auth + PIN step-up

## 6.1 Authentification principale (Supabase Auth)

Supabase Auth est le fournisseur d'identité unique. Il gère email/mot de passe, sessions, récupération de compte et invitations.

La table `Utilisateur` a son `id` = `auth.users.id` (même UUID — pas de champ séparé `supabase_auth_id`).

Les claims `etablissement_id` et `role` sont injectés dans le JWT via un **Supabase Auth Hook** (custom claims dans `app_metadata`) — disponibles côté serveur sans requête supplémentaire.

Dans Next.js : `@supabase/ssr` gère les cookies de session ; le middleware extrait les claims du JWT à chaque requête.

Les champs `mot_de_passe_hash`, `token_reinitialisation`, `expiration_token` n'existent pas dans notre table — tout cela est géré par Supabase Auth.

## 6.2 Flux de provisioning d'un compte

```
SUPER_ADMIN / Directeur crée un utilisateur (email + rôle)
    |
supabase.auth.admin.inviteUserByEmail() → email d'invitation envoyé
    |
L'utilisateur accepte et définit son mot de passe
    |
Auth Hook injecte etablissement_id + role dans app_metadata du JWT
    |
Compte actif
```

Tout enseignant actif doit obligatoirement avoir un email et donc un compte Supabase Auth. Pas d'enseignant actif sans compte.

## 6.3 Step-up auth — PIN d'approbation

Pour les actions sensibles (validation d'une demande de modification de note), un second facteur applicatif est requis : un **PIN à 6 chiffres** géré par nous, stocké hashé dans `pin_approbation_hash`.

Ce PIN est distinct du mot de passe Supabase Auth. Il protège les actions d'approbation contre une validation accidentelle (personne de passage sur la machine).

Tous les rôles qui reçoivent des demandes d'approbation doivent posséder ce PIN (actuellement : la Secrétaire).

---

# 7. Gestion des rôles

Cinq rôles fixes, non dynamiques en v1 :

| Rôle | Responsabilité |
|---|---|
| `SUPER_ADMIN` | Gestion de la plateforme SaaS |
| `DIRECTEUR` | Administration générale de l'école |
| `SECRETAIRE` | Gestion administrative + approbation de notes |
| `COMPTABLE` | Gestion financière |
| `ENSEIGNANT` | Saisie des notes sur ses classes affectées |

Un utilisateur a un seul rôle. Pas de multi-rôles en v1.

---

# 8. Sécurité

## 8.1 Autorisation

Chaque action vérifie :

1. Qui est l'utilisateur ? (Clerk session)
2. À quel établissement appartient-il ? (`etablissement_id` extrait du claim Clerk)
3. A-t-il le droit d'effectuer cette action ? (rôle)

## 8.2 Audit

Toutes les actions sensibles sont enregistrées dans `AuditLog` :

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

Actions auditées obligatoirement : connexion, création utilisateur, modification/annulation paiement, modification note, changement de rôle, validation d'approbation.

---

# 9. Architecture applicative

```
src/
├── app/                    # Next.js App Router — pages et layouts uniquement
│   ├── (auth)/             # Clerk auth flows
│   └── [module]/           # Routes par domaine
├── modules/                # Un sous-répertoire par domaine métier
│   ├── students/
│   ├── teachers/
│   ├── finance/
│   ├── academics/
│   ├── reports/
│   └── identity/
├── services/               # Services partagés inter-domaines
├── database/               # Instance Prisma, queries partagées
└── security/               # Guards tenant, audit helpers, auth middleware
```

Chaque module suit la même structure interne :

```
[module]/
├── models/        # Types TypeScript + types Prisma
├── services/      # Logique métier
├── validations/   # Schémas Zod
└── components/    # Composants React
```

---

# 10. Couche métier

La logique métier ne doit pas être dans l'interface.

```
Interface
    ↓
Server Action / Route Handler
    ↓
Service (logique métier)
    ↓
Repository (accès données + filtre tenant)
    ↓
Prisma → PostgreSQL
```

---

# 11. Base de données — principes

* Relations explicites avec clés étrangères
* Historique conservé — pas de suppression destructive pour les données sensibles
* Soft delete via statuts (`ANNULE`, `ARCHIVE`) pour : paiements, factures, notes, inscriptions
* Coefficients historisés par `annee_scolaire_id`
* Une seule année `ACTIVE` par établissement à la fois

---

# 12. Gestion des fichiers

```
Base de données
    |
Référence fichier (chemin + métadonnées)
    |
Supabase Storage
```

Les PDF (bulletins, reçus, rapports) sont générés server-side via Playwright et stockés dans Supabase Storage.

---

# 13. Importation des données

```
Fichier Excel
    ↓
Analyse + Correspondance champs
    ↓
Validation (Zod)
    ↓
Import transactionnel
    ↓
Rapport d'erreurs
```

Les imports ne doivent jamais écrire directement sans validation préalable.

---

# 14. Principes non négociables

| Principe | Règle |
|---|---|
| Isolation tenant | Toute requête filtre par `etablissement_id` via repository |
| Pas de hard delete | Données sensibles → statut `ANNULE`/`ARCHIVE` |
| Historisation | Coefficients et tarifs liés à `annee_scolaire_id` |
| Une année active | Une seule `AnneeScolaire` avec statut `ACTIVE` par école |
| Audit | Toute action sensible → `AuditLog` |
| Rôles fixes | 5 rôles en v1, pas de système dynamique |
| Interface séparée | Logique métier dans les services, pas dans React |

---

# 15. Décisions validées

| Sujet | Décision |
|---|---|
| Type application | SaaS Web, 100 % en ligne |
| Stack | Next.js + Prisma + Supabase + Clerk + Vercel |
| Auth principale | Clerk |
| Auth step-up | PIN 6 chiffres géré en interne |
| Isolation tenant | Repository pattern (pas de RLS en v1) |
| Création école | Manuelle par SUPER_ADMIN après demande de démo |
| Rôles | 5 rôles fixes |
| Sécurité | Prioritaire |
| Audit | Inclus |
| Suppression données sensibles | Évitée — statuts uniquement |
