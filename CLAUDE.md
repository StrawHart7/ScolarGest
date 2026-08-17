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

## Architecture

### Directory Structure

```
src/
├── app/              # Next.js App Router — pages and layouts only
│   ├── (auth)/       # Supabase Auth flows (login, etc.)
│   └── [module]/     # Domain-specific routes
├── modules/          # One subdirectory per business domain
│   ├── students/
│   ├── teachers/
│   ├── finance/
│   ├── academics/
│   ├── reports/
│   └── identity/
├── services/         # Shared cross-domain business services
├── database/         # Supabase client instances, shared queries
└── security/         # Tenant guards, audit helpers, auth middleware
```

Each module follows the same internal structure: `models/` (TS types), `services/` (business logic), `validations/` (Zod schemas), `components/` (React UI).

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

See `PLAN.md` for the full 10-phase roadmap. Phase 0 (scaffold, Supabase schema/RLS, Supabase Auth wiring, design tokens) is done. Phase 1 (établissement, structure scolaire & utilisateurs) is next. `analysis.md` documents open design questions (Q0–Q17) that block specific phases — resolve the relevant question before starting the phase.

## Design System

The design system is called **Luminous Institutional**. All color tokens, typography scale, spacing, and component variants are defined in `DESIGN.md`. Tailwind config must be derived from those tokens, not from Tailwind defaults.

Before creating any new page, check the `/design-maquette` directory for a subfolder matching the page (e.g. `dashboard_directeur_edusync_erp`), and inspect it to match the intended style before implementing.
