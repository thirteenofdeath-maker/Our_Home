# Our Home

A mobile-first, shared life-management PWA (personal + household finance to
start). This is Milestone 1: authentication, households, wallets, pockets,
categories, and the income/expense/transfer ledger. See:

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — system, frontend, backend, auth, RLS
- [docs/DOMAIN_RULES.md](docs/DOMAIN_RULES.md) — the money model's business rules
- [docs/DATABASE.md](docs/DATABASE.md) — schema, ER diagram, functions

## Stack

Next.js (App Router) · TypeScript (strict) · Tailwind CSS · Supabase
(Postgres + Auth + RLS) · Vitest. No ORM — SQL migrations under
`supabase/migrations/` are the source of truth for the schema.

## Getting started

1. Create a Supabase project.
2. Copy `.env.example` to `.env.local` and fill in your project's URL and
   anon key (Project Settings → API).
3. Apply the migrations in `supabase/migrations/` in order, either via the
   Supabase CLI (`supabase db push`, once linked to your project) or by
   running each file's SQL against your project in order.
4. `npm install`
5. `npm run dev` and open http://localhost:3000.

There is no live Supabase project linked in the environment this codebase
was built in, so the migrations and RLS policies have been reviewed by hand
but not applied against a real Postgres instance — see the note in
`docs/ARCHITECTURE.md` §7 and the skipped tests in
`src/features/security/rls.integration.test.ts` for exactly what to verify
once you have a project.

## Scripts

```bash
npm run dev        # start the dev server
npm run build      # production build (also type-checks)
npm run typecheck  # tsc --noEmit
npm run lint       # eslint
npm run test       # vitest run (unit tests for the money/ledger rules)
```

## Project layout

Feature-first under `src/features/*` (types, repository, Server Actions,
pure domain logic, components), reusable UI primitives under
`src/components/ui`, Supabase client setup under `src/lib/supabase`. See
`docs/ARCHITECTURE.md` for the full layering rules.
