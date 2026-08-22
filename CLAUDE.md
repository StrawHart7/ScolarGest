# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**ScolarGest** (working directory and some legacy docs still say "ScoolAdmin" — same project, `ScolarGest` is the final product name) is a multi-tenant SaaS web application for private school management in West Africa (initially targeting Togo). Phase 0 (foundations) is complete — see Development Phases below. The `/MVP` directory contains an abandoned PyQt6/SQLite desktop prototype — ignore it entirely.

No emojis anywhere in the product: UI copy, generated documents, notifications, etc.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend / Full-stack | Next.js (App Router) + TypeScript |
| Styling | Tailwind CSS + shadcn/ui |
| Forms & Validation | react-hook-form + Zod |
| Server State | TanStack Query |
| Auth | Supabase Auth (`@supabase/ssr`, custom claims `role` + `etablissement_id` in `app_metadata`) |
| Database | PostgreSQL via Supabase, accessed via `@supabase/supabase-js` / `@supabase/ssr` (no ORM) |
| File Storage | Supabase Storage |
| PDF Generation | HTML → PDF via Playwright (server-side) |
| Unit Tests | Vitest |
| E2E Tests | Playwright |
| Hosting | Vercel + Supabase |

## Commands

```bash
npm run dev          # Next.js dev server
npm run build        # Production build
npm run lint         # ESLint + Prettier
npm run test         # Vitest unit tests
npm run test:e2e     # Playwright E2E tests
npx supabase db push    # Apply DB migrations (supabase/migrations/*.sql)
npx supabase db reset   # Reset local DB and reapply migrations + seed

npm run seed:demo -- --list                                 # list établissements
npm run seed:demo -- --etablissement <uuid>                 # fictitious data for manual testing
npm run seed:demo -- --purge --seed --etablissement <uuid>  # wipe that demo data and re-seed
```

`scripts/seed-demo.ts` (service-role, deterministic) fills one existing établissement with a full cursus — classes, matières, programme, coefficients, élèves, responsables, inscriptions, enseignants, affectations, évaluations, notes — plus the finance side (types de frais, tarifs, factures, paiements), and creates SECRETAIRE / COMPTABLE / ENSEIGNANT test accounts (password `Demo2026!`). It deliberately produces varied states (statuts de facture mixtes, absences, one class left in `BROUILLON`/`SOUMISE` at T3) so every screen has something to show. `--purge` does real hard deletes — test bases only.

**`supabase/seed.sql` only runs with `db reset` (local).** It never runs on `db push`, so any remote/staging/prod project set up via `db push` alone will be missing the system catalogs (cycles, niveaux, séries, plans d'abonnement) unless they were also captured in a versioned migration. System-catalog seed data (rows with no `etablissement_id`, i.e. not tenant data) must additionally live in a numbered migration (see `supabase/migrations/0003_seed_catalogues.sql`, idempotent via `on conflict`) so `db push` alone provisions a fully working environment.

## Architecture

### Directory Structure

As actually implemented since Phase 0/1 (simpler than the originally planned per-domain `modules/` layout — services live flat in `src/services/`, one file per domain, not nested under `models/`/`validations/`/`components/` subfolders):

```
src/
├── app/              # Next.js App Router — pages, layouts, and colocated
│   │                 # Server Actions (actions.ts) + small client components
│   │                 # per route (e.g. a form component next to its page.tsx)
│   ├── (auth)/       # Supabase Auth flows (login, forgot/update password)
│   └── [domain]/     # Domain-specific routes (super-admin/, etablissement/,
│                     # utilisateurs/, profil/, dashboard/)
├── services/         # One file per domain (tenant, authorization, audit,
│                     # etablissement, annee-scolaire, classe, structure,
│                     # utilisateur, abonnement, pin, matricule,
│                     # document-numero) — business logic + tenant guard
│                     # (`requireRole`) + `auditLog()` call for sensitive writes
├── components/
│   ├── ui/           # shadcn-style primitives (Button, Card, Input, Select,
│   │                 # DatePicker/Calendar, Badge, StatCard, …)
│   └── layout/       # AppLayout, Sidebar, Header, PageHeader
└── lib/
    ├── supabase/     # client.ts (browser), server.ts (SSR, cookie-based,
    │                 # RLS-scoped), admin.ts (service-role, bypasses RLS —
    │                 # only for Server Actions provisioning Auth users)
    └── navigation.ts # getSidebarItems(role) — per-role nav item lists
```

**`requireRole()` with no arguments means SUPER_ADMIN only** — it is not "any authenticated user". Writing it on a service that école roles legitimately call silently locks them out, and unit tests won't catch it when the service is mocked by its callers (this is exactly how Phase 5 shipped a `getEtablissement` that made every bulletin/reçu generation fail for Directeur, Secrétaire and Comptable). When a service must be readable tenant-wide, list the roles explicitly and compare the requested `etablissementId` against `ctx.etablissementId` yourself.

### Permissions : la matrice fait foi, et elle est testée

`Docs/11-Matrice-permissions.md` est **généré** depuis les `requireRole(...)` de
`src/services/` par `npx tsx scripts/matrice-permissions.ts`. Ne jamais l'éditer
à la main.

Un instantané versionné (`src/lib/permissions/__tests__/matrice.instantane.txt`)
est comparé par les tests : **toute modification d'une garde de rôle fait échouer
la suite**. C'est voulu. Après un changement délibéré, régénérer avec
`--instantane` et relire le diff — c'est le geste qui manquait quand la Phase 5 a
livré un `getEtablissement` réservé au SUPER_ADMIN sans que personne le voie.

Deux règles qui en découlent :

- Une fonction de service qui ouvre un client Supabase **doit** avoir une garde.
  Les seules exceptions sont nominatives et justifiées dans `matrice.test.ts`.
- S'appuyer sur la seule RLS ne suffit pas. Quand un identifiant d'établissement
  arrive d'un appelant, le comparer explicitement à `ctx.etablissementId`.

Avant de resserrer une garde, chercher qui appelle la fonction. `/abonnement` est
ouverte à tous les rôles par conception, et la Secrétaire a un accès finance en
lecture seule (doc 08 § 17) : resserrer sans vérifier casse une page entière pour
un rôle légitime.

### Vérifier l'isolation entre écoles

`npx tsx scripts/verifier-isolation.ts` monte deux écoles jetables et tente des
accès croisés par le chemin réel de l'application — client anon plus session,
**jamais** la clé service-role, qui contournerait précisément ce qu'on teste.
Nettoyer ensuite avec `--purge`.

Le script confirme que chaque cible existe avant de tenter d'y accéder : une
lecture qui ne ramène rien parce que la table est vide ne prouve rien, et un test
de sécurité qui rassure à tort est pire que pas de test.

Server Actions live in an `actions.ts` file next to the `page.tsx` that uses them (Zod-validated `FormData` in, `redirect()` or a message string out) — see `src/app/(auth)/login/actions.ts` for the reference pattern.

### Data Flow

```
Request → Supabase Auth middleware (session refresh)
  → Tenant context extracted from JWT app_metadata (getTenantContext())
  → Next.js Server Action / Route Handler
  → Service layer (business rules)
  → Supabase client (`@supabase/supabase-js` / `@supabase/ssr`) → PostgreSQL
```

### Multi-Tenancy

Every table includes `etablissement_id`. Isolation is enforced at the **database level via Supabase Row Level Security (RLS)** policies (see `supabase/migrations/0001_init.sql`) — every tenant-scoped table has a policy comparing `etablissement_id` against the caller's JWT claim (`auth_etablissement_id()`), with a `SUPER_ADMIN` bypass. Still always pass `etablissement_id` explicitly in application code (defense in depth, and RLS aside, cleaner queries) — never rely solely on RLS to omit it from a query's `.eq()` filters.

### Non-Negotiable Invariants

- **No hard deletes** for financial data, grades, invoices, or enrollment — use soft-delete status fields (`ANNULE`, `ARCHIVE`).
- **Historization**: tuition rates and grade coefficients are always tied to a specific academic year. Changing a current value must never alter past records or documents.
- **One active academic year** per school at a time.
- **Audit log** every sensitive write (payments, grade validation, user creation).
- **5 fixed roles**: `SUPER_ADMIN`, `DIRECTEUR`, `SECRETAIRE`, `COMPTABLE`, `ENSEIGNANT` — no dynamic role system in v1.

## Domain Documentation

All business rules live in `Docs/`. Read the relevant file before implementing any domain feature:

| File | Domain |
|---|---|
| `Docs/02-Architecture.md` | Technical architecture, tenant isolation, stack decisions |
| `Docs/03-…Identité…` | Users, roles, permissions, Supabase Auth integration |
| `Docs/04-…Structure scolaire.md` | Schools, cycles, academic years, levels, classes |
| `Docs/05-…élèves.md` | Students, legal guardians, enrollment |
| `Docs/06-…Enseignants.md` | Teachers, subject and class assignments |
| `Docs/07-…académique.md` | Subjects, coefficients, evaluations, grade bulletins |
| `Docs/08-…financière.md` | Tuition, invoices, payments, receipts |
| `Docs/09-…Documents…` | PDF generation, exports, data imports |
| `Docs/10-…entités…` | Complete ERD — source of truth for all relations |
| `DESIGN.md` | "Luminous Institutional" design system, Tailwind color tokens |

Where a section is labelled **"Modifications"**, treat it as the authoritative override of the base content in the same document.

## Development Phases

See `PLAN.md` for the full 10-phase roadmap. Phase 0 (scaffold, Supabase schema/RLS, Supabase Auth wiring, design tokens) and Phase 1 (établissement, structure scolaire & utilisateurs) are done. `analysis.md` documents open design questions (Q0–Q17) that block specific phases — resolve the relevant question before starting the phase.

**Starting a new phase**: follow `PLAN.md` § 7 "Workflow d'exécution d'une phase" step by step (scoping → plan → implementation → continuous build/lint verification → debug → tests → deliverables/doc updates → branch-per-phase closeout). It captures concrete pitfalls hit during Phase 1 (stale `.next`/webpack dev caches, `db push` not running `seed.sql`, Playwright port collisions with a running `next dev`) — do not rediscover them.

**Post-Phase 9 work is tracked by feature, not by numbered phase.** Once Phase 9 closes, new work lives in `PLAN.md` § 8 "Fonctionnalités", one independent entry per feature (Statut / Objectif / Livrables checklist / Dépendances / DoD) instead of the sequential phase model above. **Listing a feature there — even fully detailed with a checklist — is not authorization to implement it.** Work on a given feature starts only when the user explicitly asks for that specific feature, regardless of what `PLAN.md` says.

## Design System

The design system is called **Luminous Institutional**. All color tokens, typography scale, spacing, and component variants are defined in `DESIGN.md`. Tailwind config must be derived from those tokens, not from Tailwind defaults.

Before creating any new page, check the `/design-maquette` directory for a subfolder matching the page (e.g. `dashboard_directeur_edusync_erp`), and inspect it to match the intended style before implementing.

### Mobile : le motif de liste fait foi

`Docs/15-Motif-liste-mobile.md` décrit la structure **de référence** de toute
page de liste sous `md` : barre d'outils (recherche + filtres repliés +
action), ligne de densité, carte de liste, bouton flottant, barre d'onglets
flottante. Une nouvelle liste la reprend telle quelle — mesures comprises —
plutôt que d'improviser un rendu mobile page par page.

Le desktop n'est pas concerné : le tableau et le `PageHeader` restent en
place à partir de `md`. Les grilles à colonnes dynamiques et les tableaux de
saisie sont explicitement hors motif (voir la dernière section du document).

**Never use native `<select>` or `<input type="date">` directly** — their dropdown/calendar popups are rendered by the OS/browser and cannot be styled, which breaks the design system. Use `src/components/ui/select.tsx` (Radix Select — still form-submits via a real hidden `<select>`, so it drops into existing `FormData`-based Server Actions unchanged) and `src/components/ui/date-picker.tsx` (Popover + `calendar.tsx`, submits an ISO `yyyy-MM-dd` via a hidden input) instead.

### Titres de page : un seul token responsive

Le titre `<h1>` d'une page utilise `text-display-sm` — token défini en
`clamp(1.25rem, 5vw, 1.5rem)` dans `tailwind.config.ts` : ~20px sur mobile
étroit, plafonné à 24px dès ~480px. Un seul token adapte tous les titres au
mobile, sans surcharge `md:` par page. **`text-headline-lg` n'existe pas** dans
l'échelle — ne pas l'employer (bug déjà rencontré). Le repli desktop de la
sidebar (`src/components/layout/sidebar-collapse.tsx`) est piloté par un contexte
client persisté en `localStorage` ; le clic sur le logo la réduit au rail
d'icônes de 72px (`sidebar-rail`).

### Profil et paramètres

`/profil` porte désormais les réglages de compte (mot de passe, PIN
Directeur/Secrétaire) et de session (déconnexion). `/profil/parametres` existe
encore comme point d'accès alternatif avec le même contenu — ne pas dupliquer la
logique, `seDeconnecterAction` vit dans `src/app/profil/parametres/actions.ts`.

### PWA : le manifeste est généré par Next

Le manifeste PWA est **généré** par `src/app/manifest.ts`
(route `/manifest.webmanifest`) — c'est la source de vérité. Le fichier statique
`public/assets/icons/site.webmanifest` est obsolète (name vides, chemins
d'icônes cassés), ne pas s'y référer. Les icônes/favicon vivent sous
`public/assets/icons/` et sont câblés via `metadata.icons` + `viewport.themeColor`
dans `src/app/layout.tsx`.

**Piège middleware** : `src/middleware.ts` redirige vers `/login` tout ce qui
n'est pas explicitement exclu de son `matcher`. Le manifeste et les assets
publics (`.ico`, `.webmanifest`, images) doivent y figurer en négation, sinon ils
sont servis comme une redirection d'auth à un visiteur non connecté. Toute
nouvelle ressource publique servie hors `/_next` doit être ajoutée à cette
exclusion.
