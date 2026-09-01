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

npx tsx scripts/seed-onboarding-test.ts            # établissement VIDE + Directeur, pour /demarrage
npx tsx scripts/seed-onboarding-test.ts --reset    # purge puis recrée
npx tsx scripts/seed-onboarding-test.ts --eleves   # 50 élèves dans les classes créées
npx tsx scripts/seed-onboarding-test.ts --secretaire  # compte pour le parcours finance
npx tsx scripts/seed-onboarding-test.ts --purge    # supprime tout
```

`scripts/seed-onboarding-test.ts` est le pendant *vide* de `seed-demo.ts` :
celui-ci remplit l'établissement, ce qui le ferait apparaître comme déjà
configuré et sauterait tout l'onboarding. Il crée un abonnement ACTIF —
indispensable, voir « Onboarding : où vit la vérité » plus bas. Comptes de
test : `directeur.test.onboarding@scolargest.local` et
`secretaire.test.onboarding@scolargest.local`, mot de passe
`TestOnboarding2026!`. Les adresses en `.local` conviennent à
`auth.admin.createUser` mais **Supabase les refuse pour les invitations**
(`inviteUserByEmail`) : tester les étapes 8 et 9 exige de vraies adresses
délivrables, et le SMTP par défaut est fortement limité en débit.

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

### Périmètre : collège et lycée uniquement

Décision produit du 2026-08-31 — ScolarGest ne s'adresse plus à la maternelle
ni au primaire. Migration `0014_cycles_secondaire_uniquement.sql`.

**Retrait du catalogue, pas suppression.** `cycle.disponible` vaut `false` pour
MATERNELLE et PRIMAIRE. La colonne signifie exactement « proposable à la
configuration d'un établissement », et rien de plus :

- `listCycles()` la filtre — ces cycles disparaissent de `/etablissement/cycles`
  et de l'étape 2 de `/demarrage`.
- `activerCycle()` la vérifie **à l'écriture**. Le `cycleId` vient de
  l'appelant : masquer un cycle dans une liste n'empêche pas de l'activer par un
  appel forgé. Même raisonnement que pour les gardes de rôle — la liste informe,
  l'écriture décide.
- `listCyclesActifs()` ne la filtre **pas**, délibérément. Un établissement déjà
  en primaire garde ses classes, ses notes et ses bulletins ; filtrer ici lui
  ferait disparaître son école sous les pieds. C'est aussi pourquoi le gabarit
  générique `src/lib/pdf/templates/bulletin.ts` reste vivant : le dispatch de
  `bulletin.ts:94` peut encore l'atteindre pour une classe de primaire
  existante. **Ne pas le supprimer comme code mort.**

`niveauSuivantId` est coupé sur les cycles retirés : **la 6ème est le niveau
d'entrée**, `CM2 → 6ème` n'existe plus.

**Piège de lecture** : `0003_seed_catalogues.sql` et `supabase/seed.sql`
insèrent toujours les quatre cycles — volontairement, ils reconstruisent le
catalogue historique que `0014` restreint ensuite. Aucun des deux n'est l'état
final du périmètre.

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

See `PLAN.md` for the full roadmap. **All 9 phases are complete** (Phases 0–9 terminées). The app is deployed in production at [scolargest.com](https://scolargest.com). `analysis.md` documents design decisions (Q0–Q17), all resolved.

**Post-Phase 9 work is tracked by feature, not by numbered phase.** New work lives in `PLAN.md` § 8 "Fonctionnalités", one independent entry per feature (Statut / Objectif / Livrables checklist / Dépendances / DoD). **Listing a feature there — even fully detailed with a checklist — is not authorization to implement it.** Work on a given feature starts only when the user explicitly asks for that specific feature.

**Active branches** (2026-09-01) :
- `feat/emploi-du-temps` — ✅ livrée (2026-09-01), en attente de merge :
  grille hebdomadaire par classe, export PDF, plus deux corrections sur les
  écrans de classe et deux correctifs de robustesse du build. Migration `0018`.
  Voir `PLAN.md` § 8.
- `feat/kpi-graphes` — créée, vide. Réservée aux KPI et aux graphes.
- `feat/super-admin` — ✅ terminée et mergée sur `main` (2026-08-31) : console plateforme — tableau de bord, inventaire des écoles, file des prospects, fiche d'usage, journal d'audit transverse. Aucune migration. Voir `PLAN.md` § 8.
- `feat/pricing` — ✅ terminée et mergée sur `main` (2026-08-31) : modèle économique complet — essai gratuit de 30 jours, facturation par cycle, section de tarifs publique, paiement Mobile Money via FedaPay, bascule sur le domaine `scolargest.com`. Migrations `0015` à `0017`. Voir `PLAN.md` § 8.
- `feat/secondaire-uniquement` — ✅ terminée et mergée sur `main` (2026-08-31) : retrait de la maternelle et du primaire du catalogue. Migration `0014`.
- `feat/identite-documents` — ✅ terminée et mergée sur `main` (2026-08-30) : logo et filigrane sur bulletins et reçus, plus deux corrections du bulletin secondaire (note définitive = moyenne × coefficient, suppression des lignes de remplissage anonymes). Migration `0013`. Voir `PLAN.md` § 8.
- `feat/demarrage-carte` — ✅ terminée et mergée sur `main` (2026-08-30) : `/demarrage` passe du fil conversationnel à une carte flottante à deux colonnes, plus un écran de félicitations chiffré.
- `feat/onboarding` — ✅ terminée et mergée sur `main` (2026-08-29) : questionnaire de configuration guidée `/demarrage`, scripté (pas de LLM), par rôle. Migration `0012`. Voir `PLAN.md` § 8.
- `feat/pwa` — ✅ terminée et mergée sur `main` (2026-08-28) : premier incrément hors-ligne (page `/offline`, contexte de connectivité, brouillons de notes en IndexedDB). Voir `PLAN.md` § 8.
- `feat/mobile-ui-redesign` — corrections UI mobile (StatCard compact, Dialog clavier adaptatif, CoefficientsForm liste mobile, tableaux de saisie en cartes sous `md`, écran de chargement stylisé `BrandedLoader`). En cours, mergée sur `main` à chaque milestone. Reste : pages de liste sans `FiltresMobile`/`BarreOutilsListe`, pages d'indirection à raccourcir.
- `feat/corrections-fonctionnelles` — ✅ terminée et mergée sur `main` (2026-08-25) : versements, droits finance Secrétaire, invitation de plusieurs Directeurs, refonte du workflow de validation des notes (voir `PLAN.md` § 8).
- `feat/refonte-mobile` — refonte mobile premium (plan complet dans `Docs/16-Refonte-mobile-plan.md`). **En pause** — reprendra quand les assets seront réunis.

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
n'est pas explicitement exclu de son `matcher`. Le manifeste, `sw.js` et les
assets publics (`.ico`, `.webmanifest`, images) doivent y figurer en négation,
sinon ils sont servis comme une redirection d'auth à un visiteur non connecté.
Toute nouvelle ressource publique servie hors `/_next` doit être ajoutée à cette
exclusion.

**Service worker et installation** : `public/sw.js` (enregistré par
`src/components/pwa/pwa-installer.tsx`, monté dans le layout racine) porte le
handler `fetch` qui rend l'app *installable* — sans lui, ce n'est qu'un raccourci
« écran d'accueil ». Il précache la seule coquille statique et ne met **jamais**
en cache de page authentifiée ni de donnée Supabase (RLS). Bumper `CACHE_VERSION`
à tout changement de stratégie (l'ancien cache est purgé à l'activation). Les
navigateurs n'ouvrant plus d'invite automatique, `PwaInstaller` capte
`beforeinstallprompt` et affiche une bannière maison (refus mémorisé en
`localStorage`, masquée en mode standalone) ; iOS n'émet pas l'événement.

**Hors-ligne : la donnée persistée EST la file d'attente.** Les brouillons de
saisie de notes vivent en IndexedDB (`src/lib/offline/notes-brouillon-db.ts`,
paquet `idb`) et une ligne `dirty` est une ligne restant à envoyer — pas de
structure de file parallèle à maintenir. Trois règles qui en découlent :
les fonctions avalent leurs erreurs (IndexedDB indisponible ne doit jamais
faire planter un formulaire) ; la clé est namespacée par `userId` et la base
est vidée à la déconnexion (`DeconnexionButton`), sans quoi un brouillon
serait restaurable sous un autre compte sur un poste partagé ; et le retry
est idempotent parce que `saisirNoteAction` est un upsert sur
`(evaluationId, eleveId)`.

### Server Actions : ne jamais supposer qu'un appel aboutit

Une Server Action interrompue — coupure réseau, redémarrage du serveur de
développement — ne rejette pas toujours : elle peut se **résoudre sur
`undefined`**. Un `if (!resultat.ok)` direct produit alors une erreur
d'exécution brute à la place d'un message. Sur une application qui vise des
connexions instables, c'est un cas courant. `src/app/demarrage/appel-action.ts`
est l'enveloppe de référence ; reprendre ce motif pour tout nouvel appel
d'action déclenché depuis du code client.

**Les erreurs Supabase ne sont pas des `Error`.** Les services les propagent
telles quelles (`if (error) throw error`), or ce sont des objets simples : un
test `e instanceof Error` est **toujours faux** et masque la cause réelle
(contrainte violée, refus RLS) derrière un message générique. Extraire
`message`/`details`/`hint`/`code`, et reconnaître un doublon par le code
Postgres `23505` autant que par le texte.

### Onboarding : où vit la vérité

`/demarrage` (voir `PLAN.md` § 8) est un **questionnaire scripté, sans LLM** —
les catalogues système sont finis et fermés, tout est sélection dans des listes
connues. Les étapes sont déclarées dans `src/lib/onboarding/etapes.ts`, les
suggestions (matières, types de frais) dans `suggestions.ts`.

L'interface est une **carte flottante à deux colonnes** (`FilDemarrage.tsx`) :
une seule étape à la fois, rail de progression à gauche (`RailEtapes.tsx`),
écran de félicitations chiffré à la fin (`EcranFinal.tsx`). **Pas de bouton
« Retour »** : chaque étape écrit en base au moment où elle est validée et
`activerCycle` est définitive — un retour arrière mentirait. Le rail montre ce
qui a été fait, il ne le défait pas.

L'avancement se **déduit des données** (`src/services/onboarding.ts`) et ne se
stocke pas : le dupliquer le ferait diverger dès qu'une configuration passe par
les écrans habituels. `onboarding_progression` ne porte que l'indéductible —
étapes sautées, bannière masquée, et par sa seule existence le fait d'avoir
déjà été redirigé une fois.

**Deux pièges de schéma à connaître** :
- Il n'existe **ni `niveau_etablissement` ni `serie_etablissement`**. Un niveau
  n'est « enseigné » que parce qu'une classe existe dessus — c'est ainsi que le
  périmètre se redéduit à la reprise du parcours.
- `programme_etablissement` est unique sur `(etablissement, niveau, matiere)`,
  **sans série**. La différenciation par série passe par
  `coefficient_matiere.serieId` ; un coefficient absent vaut `0` dans le calcul
  des bulletins, ce qui retire la matière de la moyenne de cette série.

**Un établissement sans abonnement est en lecture seule** (`evaluerAcces` →
`AUCUN` → toutes les écritures en 403). C'est intentionnel, mais ça bloque
entièrement l'onboarding : un établissement de test doit avoir un abonnement
ACTIF, sinon chaque étape échoue sans explication.
`scripts/seed-onboarding-test.ts` en crée un (`--reset`, `--eleves`,
`--secretaire`, `--purge`).

### Modèle économique : essai, facturation par cycle, paiement FedaPay

Décidé et livré le 2026-08-31. Migrations `0015` à `0017`.

**L'essai n'est pas un abonnement.** `abonnement_etablissement.planId` est
`NOT NULL` : y loger un essai imposerait un plan fictif à prix nul, qui
remonterait ensuite dans l'historique de facturation et les relances. Il vit
donc sur `etablissement` (`essaiDebuteLe`, `essaiFinLe`) et démarre à la
définition du PIN de démarrage — première écriture réelle du Directeur.

**Les dates d'essai ne sont pas écrivables par le tenant.** La policy
`etablissement_tenant` est `for all` : un Directeur peut écrire sur sa propre
ligne d'établissement, et prolongeait donc son propre essai. Le trigger
`fn_proteger_dates_essai` **réécrit** les valeurs au démarrage — 30 jours
imposés par le serveur, quoi qu'envoie l'appelant — et refuse toute
modification ultérieure. La migration `0016` reconnaît en plus la clé
service-role, sans quoi le trigger bloquait les outils de la plateforme
eux-mêmes (`seed-onboarding-test --reset`).

**`evaluerAcces` prend un objet `EtatFacturation`** et porte cinq niveaux, dont
`ESSAI` qui autorise l'écriture. L'ordre compte : `SUSPENDU` prime toujours,
puis l'abonnement payé, puis l'essai. Une école qui souscrit pendant son essai
est traitée comme cliente ; une école suspendue ne retrouve pas l'écriture via
un essai encore ouvert.

**Facturation par cycle.** Le prix du catalogue est celui d'**un** cycle
(10 000/mois, 100 000/an) ; un complexe collège-lycée en porte deux.
`nombreCycles` et `montantTotal` sont figés sur la période, comme les tarifs
scolaires — changer le catalogue ne doit pas réécrire ce qu'une école a payé.

**`src/lib/tarifs.ts` n'est pas la source de vérité de la facturation.**
`plan_abonnement` et `abonnement_etablissement.montantTotal` le sont. Ce
fichier existe parce que `listPlans()` exige une session alors que la page de
tarifs s'adresse à des visiteurs anonymes. Toute modification doit être
répercutée des deux côtés.

### Paiement FedaPay : les pièges

**La page de paiement doit rester sous `/abonnement/`.**
`PATHS_TOUJOURS_ACCESSIBLES` (`src/lib/supabase/middleware.ts`) y laisse passer
les écritures même en lecture seule. Ailleurs, la Server Action de paiement
serait refusée par la garde d'abonnement — le paywall bloquerait exactement les
écoles venues payer.

**`api/fedapay` est exclu du `matcher` de `src/middleware.ts`.** Sans cela,
FedaPay reçoit un 307 vers `/login`, le compte comme une livraison réussie, et
aucun abonnement n'est activé — sans la moindre erreur nulle part. C'est la
panne la plus silencieuse de l'intégration.

**Le webhook fait foi, pas la redirection de retour.** `/abonnement/retour`
n'active rien : elle est atteinte par une redirection de navigateur que
n'importe qui peut fabriquer en tapant l'URL.

**La signature se vérifie sur le corps brut** (`request.text()` avant tout
parsing) et **les erreurs du SDK FedaPay ne sont pas des `Error`** — même piège
que Supabase. `estErreurSignature()` teste
`instanceof SignatureVerificationError`, pas le texte du message : une version
par expression régulière renvoyait 500 au lieu de 400, ce qui aurait fait
rejouer indéfiniment une charge toujours refusée.

**L'idempotence repose sur l'état**, pas sur un identifiant d'événement :
`transaction_fedapay.abonnementId` non nul signifie « déjà honorée ». Ça résiste
aussi à deux événements distincts portant sur la même transaction.

**Le tenant n'écrit jamais dans `transaction_fedapay`** — RLS en lecture seule.
Les écritures passent par la clé service-role, depuis un service gardé ou un
webhook signé.

**`sendNowWithToken(mode, token, params)` prend le corps de la requête**, pas
le numéro : le SDK fait `params.token = token` puis poste `params` tel quel, il
faut donc `{ phone_number: { number, country } }`. L'exemple de la
documentation officielle induit en erreur et produit un `400 — Paramètre
manquant ou la valeur est vide phone_number`.

**En bac à sable, utiliser `momo_test`** et non `moov_tg` : ce mode « ne dépend
pas des serveurs de test des opérateurs ». Numéros acceptés `64000001` et
`66000001`, tout autre simule un échec.

**Aucun champ de carte bancaire** : les héberger ferait entrer ScolarGest dans
le périmètre PCI-DSS. Le Mobile Money ne demande qu'un numéro de téléphone.

### Authentification par lien : deux mécanismes, pas un

`/auth/callback` reçoit **trois** parcours : OAuth Google, invitation
d'utilisateur, réinitialisation de mot de passe. Ils n'arrivent pas de la même
façon, et traiter le second comme le premier est la panne du 2026-08-31.

- **`?code=`** — flux PKCE. `exchangeCodeForSession` exige un `code_verifier`
  déposé en cookie **dans le navigateur qui a démarré le flux**. Cela convient à
  Google, qui part et revient depuis le même navigateur.
- **`?token_hash=&type=`** — `verifyOtp`, **sans vérificateur**. Le seul
  mécanisme viable pour un lien reçu par email : une invitation démarre dans le
  navigateur du SUPER_ADMIN et se termine dans celui de l'invité, où le
  vérificateur n'existe pas. L'échange échouait donc systématiquement, et
  l'invité atterrissait sur `/login` sans explication.

Le second suppose que les **gabarits d'email Supabase** envoient `token_hash` et
non le `{{ .ConfirmationURL }}` par défaut :

```
{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=invite
{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=recovery
```

**Une invitation et une réinitialisation mènent à `/update-password`**, déduit
du `type`. Un invité n'a pas encore de mot de passe : l'envoyer au tableau de
bord le laisserait sans moyen de se reconnecter le lendemain.

**Les redirections d'auth utilisent `urlApplication()`, jamais l'en-tête
`origin`.** Celui-ci vaut l'hôte réellement appelé, qui peut être une adresse de
déploiement Vercel plutôt que le domaine public. Si l'URL construite ne figure
pas dans les **Redirect URLs** de Supabase, Supabase l'ignore silencieusement et
renvoie sur son *Site URL* — l'utilisateur revient sur la page d'accueil,
connecté mais perdu, sans aucun message.

**`/login` affiche le motif** passé en `?error=` (`lien_invalide`,
`session_introuvable`, `lien_incomplet`). Sans cela, trois causes distinctes
produisent le même écran muet. Le paramètre est lu dans un `useEffect` et non
avec `useSearchParams`, qui imposerait une frontière `Suspense` et ferait
échouer le build d'une page prérendue.

### Console SUPER_ADMIN : ce qu'elle voit, et ce qu'elle ne voit pas

`src/services/plateforme.ts` agrège toutes les écoles. Toutes ses fonctions sont
gardées par `requireRole()` sans argument — SUPER_ADMIN seul, ce qui est bien
l'intention : aucune école ne doit voir les chiffres des autres.

**La console compte, elle ne consulte pas.** Aucune donnée d'élève, de note ou
de facture n'y est lue : états d'abonnement, effectifs, dates d'activité. Une
prise en main du contexte d'une école pour le support a été explicitement
écartée. L'isolation entre écoles est la promesse du produit ; la console ne
doit pas être le trou par lequel elle fuit.

**L'état d'une école suit l'ordre de `evaluerAcces`** — suspension, puis
abonnement payé, puis essai. Reproduire cet ordre est obligatoire : une console
qui contredirait l'accès réel de l'école serait pire qu'une console vide.

**Le revenu vient de `montantTotal`**, figé à la souscription, jamais de
`plan_abonnement` : recalculer depuis le catalogue réécrirait rétroactivement le
revenu constaté à chaque changement de prix. Les plans annuels sont ramenés au
douzième.

**Les effectifs se comptent sur `inscription` en statut ACTIVE**, jamais sur la
table `eleve`, qui accumule les élèves partis.

**`demande_demo` était écrite et jamais lue** — la table, son énumération de
statuts et ses policies existaient depuis `0002`, seul l'écran manquait. Le
formulaire public de la page d'accueil y déverse les prospects ; `/super-admin/
demandes` est le seul endroit qui les affiche. Si un jour le formulaire change,
vérifier que cet écran suit.

**Le SUPER_ADMIN est redirigé de `/dashboard` vers `/super-admin`.** La route
`/dashboard` reste la destination commune après connexion pour les quatre autres
rôles — ne pas la supprimer.

### Emploi du temps : une grille sans horloge

Migration `0018`. Les colonnes sont les jours (lundi a samedi), les lignes des
rangs ordonnes — « Premiere heure » a « Huitieme heure ». **Aucune heure
d'horloge nulle part.**

Une ecole togolaise n'a pas de journee type universelle : imposer une grille
horaire obligerait chaque etablissement a decrire sa journee avant de placer le
moindre cours. Le rang suffit a dire « ce cours vient avant celui-la », seule
information dont l'affichage a besoin.

**Consequence structurante** : les deux conflits deviennent des index uniques,
pas des calculs de chevauchement. Ni `btree_gist`, ni `EXCLUDE USING gist`.
Celui de l'enseignant est **partiel** — un creneau peut n'avoir personne
d'affecte, et NULL ne doit pas entrer en conflit avec NULL.

**Le conflit est annonce puis refuse.** `detecterConflitEnseignant` ne protege
rien : elle produit une phrase lisible pendant la saisie, la ou le code Postgres
`23505` ne dirait rien. C'est l'index qui refuse. Supprimer l'un des deux en
croyant l'autre suffisant est une erreur — deux secretaires saisissant en meme
temps passeraient la verification applicative sans jamais franchir l'index.

**Suppression franche assumee.** Un creneau n'est ni une note, ni une facture,
ni une inscription. L'invariant « pas de suppression dure » protege les donnees
financieres et academiques historisees ; un emploi du temps est un reglage
courant, reecrit plusieurs fois par trimestre.

**`src/lib/emploi-du-temps.ts` ne depend de rien**, deliberement : le gabarit
PDF et le composant client y puisent JOURS, RANGS et la forme d'un creneau sans
tirer le graphe serveur. Ne jamais y importer de service.

**Les matieres proposees sont celles du programme du niveau.** Une matiere hors
programme produirait un emploi du temps que le bulletin ignorerait.

### Toute fonction qui genere un PDF doit etre tracee

`outputFileTracingIncludes` (`next.config.mjs`) doit lister **chaque** route qui
appelle `renderHtmlToPdf`. Le tracing de fichiers de Vercel omet les assets
brotli de `@sparticuz/chromium` (`bin/*.br`), lus a l'execution et jamais
`require`d.

L'oubli ne casse ni le build ni le developpement local : le chemin serverless
n'y est pas emprunte. L'export echoue **en production seulement**, avec « The
input directory .../@sparticuz/chromium/bin does not exist ». C'est exactement
ce qui est arrive a `/api/emploi-du-temps`.

### Le build ne doit dependre d'aucun service tiers

Le 2026-09-01, un deploiement a mis trente minutes sans la moindre erreur de
compilation. Deux attentes reseau, independantes :

- `sentry-cli releases new` bloque 3 min 26 avant un `504 Downstream timeout`.
  Un `errorHandler` degrade desormais ces echecs en avertissement.
- `next/font/google` telechargeait les polices **pendant le build**. Elles sont
  auto-hebergees (`next/font/local`, fichiers dans `src/app/fonts/`).

**L'auto-hebergement ne change rien pour l'utilisateur final** :
`next/font/google` servait deja les fichiers depuis notre domaine
(`_next/static/media/`), jamais depuis Google. Seule l'origine au moment du
build change.

Deux details qui coutent une compilation :

- Le chargeur de polices exige des **litteraux**. `unicode-range` factorise dans
  une constante partagee fait echouer le build (`Font loader values must be
  explicitly written literals`) — d'ou sa repetition dans les deux appels.
- Sans `unicode-range`, un caractere hors du sous-ensemble latin s'afficherait
  en carre vide au lieu de tomber sur la police de repli.

### Domaine et URL publique

`urlApplication()` (`src/lib/url-app.ts`) résout dans l'ordre
`NEXT_PUBLIC_APP_URL`, puis `VERCEL_URL`, puis localhost. Le repli sur
`VERCEL_URL` fait qu'une **preview renvoie sur elle-même** au lieu de rejeter
l'utilisateur en production au retour d'un paiement. `NEXT_PUBLIC_APP_URL` ne
doit donc être déclarée **que pour la production** sur Vercel.

Deux conséquences hors du dépôt à ne pas oublier lors d'un changement de
domaine : les **Redirect URLs de Supabase Auth** (sinon invitations et
réinitialisations de mot de passe mènent à une erreur) et l'**URL du webhook
FedaPay**.

**La protection de déploiement Vercel bloque les webhooks en preview.**
`vercel_auth_enabled` renvoie un 401 avant d'atteindre le code. Il faut une
exception de chemin sur `/api/fedapay/webhook`, ou tester en production.

### Vérification : `typecheck` n'est pas optionnel

`.github/workflows/ci.yml` enchaîne `npm ci`, `lint`, **`typecheck`** puis
`test`. Lancer seulement lint et les tests laisse passer les erreurs de typage —
c'est ainsi qu'un `variant="outline"` inexistant sur le `Button` du projet a
fait échouer CI et Vercel. `npm run typecheck` coûte une trentaine de secondes
et n'est pas un build.

### Identité des documents : logo et filigrane

`parametres_document` (migration `0013`, une ligne par établissement) porte le
filigrane (texte libre + activation) et le chemin du logo. Table dédiée plutôt
que des colonnes sur `etablissement`, qui n'est écrite que par le SUPER_ADMIN :
le réglage relève du Directeur. `etablissement.logo` existe depuis `0001` mais
n'est **jamais utilisée** — laissée en l'état délibérément, ne pas s'en servir.

Le bucket `documents` étant privé, le logo est **lu côté serveur et intégré en
data URI** au moment du rendu (`chargerLogoDataUri`) : Chromium n'aurait aucune
session pour aller chercher un fichier protégé. Cette fonction reçoit un chemin
arbitraire et lit avec la clé service-role — elle vérifie donc que le chemin est
préfixé par l'établissement appelant, en plus de sa garde de rôle.

Le filigrane est en `position: fixed` (`src/lib/pdf/templates/identite.ts`),
seule façon de le faire **répéter sur chaque page** du PDF ; en `absolute` il
n'apparaîtrait que sur la première. Module partagé par les trois gabarits.

C'est un élément d'**identité visuelle**, pas une protection : un filigrane se
copie. Pour l'authentification d'un document, la piste est un QR code adossé à
`generateNumeroDocument`.

### Composants UI mobile — règles d'usage

**`StatCard`** (`src/components/ui/stat-card.tsx`) a un layout dual : ligne
horizontale compacte sur mobile (icône arrondie + label/valeur), carte verticale
`h-32` sur desktop. Aucune variante à passer — le responsive est interne.
Les grilles de stat cards utilisent `grid-cols-2` comme base mobile.

**`Dialog`** (`src/components/ui/dialog.tsx`) intègre un hook `useKeyboardOffset`
(Visual Viewport API) qui décale la bottom sheet vers le haut quand le clavier
virtuel s'ouvre sur mobile. La hauteur max est en `85dvh` (viewport dynamique).
Sur desktop le hook est inactif (keyboardOffset reste 0).

**Clavier numérique** : sur tout `<Input type="number">` affiché sur mobile,
ajouter `inputMode="numeric"` pour ouvrir le clavier numérique au lieu du
clavier alphanumérique.
