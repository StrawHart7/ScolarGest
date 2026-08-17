# ScoolAdmin

Multi-tenant SaaS for private school management (West Africa, initially Togo).

## Stack

Next.js 14 (App Router) + TypeScript strict + Tailwind + shadcn-style primitives + Prisma + Supabase (Auth, Postgres, Storage) + TanStack Query + react-hook-form + Zod + Vitest + Playwright.

## Prerequisites

- Node.js 20+
- A Supabase project (Postgres + Auth + Storage)
- `.env.local` filled from `.env.example`

## Setup

```bash
npm install
npx prisma generate
npx prisma migrate dev
npm run prisma:seed
npm run dev
```

## Commands

| Command | Description |
|---|---|
| `npm run dev` | Next.js dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript typecheck |
| `npm run test` | Vitest unit tests |
| `npm run test:e2e` | Playwright E2E |
| `npx prisma migrate dev` | Apply DB migrations |
| `npm run prisma:seed` | Seed system catalogs (cycles, niveaux, series, plans) |

## Architecture

```
src/
  app/              Next.js App Router (routes/layouts only)
    (auth)/         Auth flows
  modules/          One folder per business domain
    academics/      Grade calculation engine (pure fns)
    students/
    teachers/
    finance/
    reports/
    identity/
  services/         Cross-domain services (tenant, audit, matricule, pin)
  lib/              Shared utilities (prisma, supabase, cn)
  components/       UI primitives + layout components
  security/         Guards, middleware helpers
prisma/
  schema.prisma
  seed.ts
```

Multi-tenant isolation is applicative: every query filters by `etablissement_id` via the service layer. No RLS.

See `CLAUDE.md`, `PLAN.md`, `Docs/` for domain rules.
