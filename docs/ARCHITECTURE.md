# Architecture — Our Home

Status: Milestone 1 (Auth, Household, Wallets, Pockets, Categories, Transaction ledger).

## 1. System overview

Our Home is a mobile-first PWA for shared life management. Milestone 1 covers
authentication, household modeling, and the money ledger (wallets, pockets,
categories, income/expense/transfer transactions).

Stack:

- **Next.js (App Router, TypeScript strict)** — UI + server logic.
- **Supabase** (Postgres, Auth, Row Level Security) — data, identity, authorization.
- **Tailwind CSS** — styling via design tokens (see `src/components/ui`).
- No ORM. Migrations are plain SQL and are the single source of truth for schema.
  Application code talks to Postgres through the `@supabase/supabase-js` client
  (PostgREST) and a small number of `SECURITY INVOKER` RPC functions for
  operations that must write multiple rows atomically.

## 2. Frontend architecture

Feature-first layout under `src/`:

```
src/
  app/                    route segments only — composition, not business logic
    (auth)/               login, sign-up, auth callback
    (app)/                authenticated shell: onboarding, wallets, categories, household
  features/<name>/
    types.ts              domain types for the feature
    api.ts                repository layer — the ONLY code that calls Supabase for this feature
    actions.ts            Server Actions — validate input, call api.ts, revalidate paths
    domain/                pure business rules (no I/O), unit tested
    components/           feature-specific client/server components
  components/ui/          reusable presentation primitives (Button, Card, Input, ...)
  lib/
    supabase/              browser/server client factories + middleware session refresh
    validation/            shared zod schemas (money amount, etc.)
    utils/                 currency formatting, small pure helpers
  types/database.ts       hand-authored Supabase-generated DB types (see note below)
```

Dependency direction (one-way):

```
app/ (routes)  →  features/*/actions.ts  →  features/*/api.ts  →  Supabase
                          ↓
                 features/*/domain/*  (pure, no I/O, unit tested)
```

Components never call Supabase directly. A page/component calls a Server
Action or a repository function; it never constructs a Postgres query itself.
This keeps business rules in one place per feature and testable without
spinning up Next.js or a browser.

**Server Components by default.** Client Components (`"use client"`) are used
only where browser interactivity is required: forms with local state, the
category picker, bottom sheets/dialogs. Mutations go through Server Actions,
not client-side `fetch` to route handlers, except where a route handler is
required (the OAuth/email-confirmation callback).

## 3. Backend architecture

There is no separate backend service. "Backend" is:

1. **Postgres schema + constraints** (`supabase/migrations/`) — the enforced
   shape of the data (foreign keys, check constraints, uniqueness).
2. **Row Level Security policies** — the enforced authorization boundary.
   The frontend's own checks are a UX convenience only; RLS is what actually
   protects data (see §5).
3. **Postgres functions (RPC)** — used only where a single client action must
   write more than one row atomically (creating a transaction + its ledger
   entries; pocket/wallet transfers). These are declared `SECURITY INVOKER`
   (the default) so they run as the calling user and are still subject to
   RLS on every statement inside them — atomicity comes from the fact that a
   Postgres function body runs inside one transaction, so a failed insert
   (e.g. RLS rejects a row) rolls back the whole function. We deliberately do
   **not** use `SECURITY DEFINER` for these, because that would require
   re-implementing authorization checks by hand inside the function instead
   of getting them for free from RLS.

   `SECURITY DEFINER` is used only for a few narrow helper functions
   (`is_household_member`, `has_household_role`) whose entire job is to
   answer "does this user have access", precisely to avoid infinite RLS
   recursion when `household_members` policies would otherwise need to query
   `household_members`.

## 4. Auth approach

- Supabase Auth (`auth.users`) is the identity source. Email/password is the
  only method wired up in Milestone 1.
- Application profile data lives in a separate `public.profiles` table
  (1:1 with `auth.users`, same `id`), created automatically by a
  `handle_new_user` trigger on `auth.users` insert. No password or auth
  secret is ever duplicated into application tables.
- Because profile creation is a DB trigger rather than app code, adding
  Google/Apple sign-in later requires no redesign: any new `auth.users` row,
  regardless of provider, gets a `profiles` row the same way.
- Session handling follows the current official `@supabase/ssr` pattern:
  a browser client (`src/lib/supabase/client.ts`), a server client bound to
  the request's cookies (`src/lib/supabase/server.ts`), and a root
  `proxy.ts` (Next.js 16 renamed the `middleware` file convention to
  `proxy` — the exported function is `proxy`, not `middleware`) that
  refreshes the session cookie on every request. No deprecated
  `@supabase/auth-helpers-*` packages are used.

## 5. Row Level Security approach

Every application table has RLS enabled. The shape of every policy follows
one rule:

- **Personal** resource (`scope = 'PERSONAL'`): visible/writable only when
  `owner_user_id = auth.uid()`.
- **Household** resource (`scope = 'HOUSEHOLD'`): visible/writable only when
  the caller is an active member of `household_id` (checked via
  `is_household_member(household_id)`), with role-gated write access for
  operations like renaming the household or managing members
  (`has_household_role(household_id, array['owner','admin'])`).
- Resources that live "inside" a wallet (pockets) or "inside" a transaction
  (transaction_entries) do not duplicate `scope`/`owner_user_id`/
  `household_id`. Their policies check access through the parent row
  (`EXISTS (SELECT 1 FROM wallets WHERE ...)`), so authorization logic for
  "who can see this wallet" lives in exactly one place.

This means a manually-edited URL or API request for another user's personal
wallet, or another household's data, returns zero rows / a permission error
at the database level — never just a hidden UI element. See
`supabase/migrations` for the exact policies and
`docs/DOMAIN_RULES.md §Security` for the plain-language rules.

## 6. Feature structure (Milestone 1)

| Feature | Route(s) | Notes |
|---|---|---|
| `auth` | `/login`, `/sign-up`, `/auth/callback` | Server Actions for sign-in/up/out |
| `household` | `/household`, `/household/new` | Create household, list members, add member by email (owner/admin only) |
| `wallets` | `/wallets`, `/wallets/new`, `/wallets/[walletId]` | Personal + household wallets, balance from ledger |
| `pockets` | (inside wallet detail) | Created automatically (`Main`) and manually; balance from ledger |
| `categories` | `/categories`, inline picker in transaction form | Tree via `parent_id`, archive not delete once used |
| `transactions` | `/wallets/[walletId]/transactions/new`, `/wallets/[walletId]` (history) | Income, expense, pocket transfer, wallet transfer — all via RPC |

Explicitly out of scope for Milestone 1: Calendar, Tasks, Shopping lists,
Budgeting UI, Bills, Saving goals, Notes, receipt OCR, AI categorization,
offline sync, activity feed. The schema does not preclude adding them later.

## 7. Notable Milestone-1 simplifications (documented, not accidental)

- **Household invites are direct, not token-based.** `add_household_member`
  looks up an existing `profiles` row by email and inserts a
  `household_members` row immediately (owner/admin only). There is no
  invitation/notification/accept flow yet — both people must already have
  an account. A pending-invite table is a reasonable Milestone 2 addition
  and does not require changing the membership model.
- **`profiles.email` is a denormalized copy** of `auth.users.email`, kept in
  sync by the `handle_new_user` trigger at signup, solely so household
  invites can look a person up by email without exposing `auth.users` to
  clients. It is not used for authentication.
- **No cached balances.** Wallet/pocket balances are computed on read via
  `SUM(transaction_entries.amount)`. This is correct-by-construction and
  fast enough at this data scale; a materialized/cached balance is a future
  optimization, not a second source of truth (see `DOMAIN_RULES.md`).
- **No soft-delete UI yet for transactions.** The `deleted_at` column exists
  and every balance query already filters it out, so voiding is available at
  the data layer, but Milestone 1 does not ship an edit/void UI action.
- **Database types are hand-written** in `src/types/database.ts`, mirroring
  the migrations exactly. There is no live Supabase project connected in
  this environment to run `supabase gen types typescript`. Once a project is
  linked, regenerate this file and delete the "hand-authored" note at its
  top — nothing else should need to change.

## 8. PWA

`src/app/manifest.ts` provides the web app manifest (Next.js file
convention — this alone generates `/manifest.webmanifest` and the `<link>`
tag). `public/icons/` holds placeholder SVG icons. `public/sw.js` is an
intentionally empty pass-through service worker registered from the root
layout purely to satisfy installability; it implements no caching strategy.
Caching authenticated financial data in a service worker is an explicit
future decision (see `DOMAIN_RULES.md`), not an oversight.
