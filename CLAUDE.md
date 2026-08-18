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
```

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

## Design System

The design system is called **Luminous Institutional**. All color tokens, typography scale, spacing, and component variants are defined in `DESIGN.md`. Tailwind config must be derived from those tokens, not from Tailwind defaults.

Before creating any new page, check the `/design-maquette` directory for a subfolder matching the page (e.g. `dashboard_directeur_edusync_erp`), and inspect it to match the intended style before implementing.

**Never use native `<select>` or `<input type="date">` directly** — their dropdown/calendar popups are rendered by the OS/browser and cannot be styled, which breaks the design system. Use `src/components/ui/select.tsx` (Radix Select — still form-submits via a real hidden `<select>`, so it drops into existing `FormData`-based Server Actions unchanged) and `src/components/ui/date-picker.tsx` (Popover + `calendar.tsx`, submits an ISO `yyyy-MM-dd` via a hidden input) instead.
