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
3. **Postgres functions (RPC)** — used both where a single client action must
   write more than one row atomically (creating a transaction + its ledger
   entries; pocket/wallet transfers) and, after the Milestone 1 hardening
   pass (see §9), as the *only* way to write the ledger or add a household
   member at all.

   **This changed from the original Milestone 1 design.** The three
   `create_*` ledger RPCs and `add_household_member` were originally
   `SECURITY INVOKER`, on the reasoning that they'd run as the calling user
   and get authorization "for free" from RLS. A security/integrity audit
   found the flaw in that reasoning: RLS on `transactions`/
   `transaction_entries`/`household_members` only ever checked *who the
   caller was*, not *what values they were writing* — an authenticated
   client could call PostgREST directly (bypassing the RPCs and the
   Next.js app entirely) and, e.g., insert a `transactions` row with a
   spoofed `owner_user_id`, or a `household_members` row promoting
   themselves to `owner`. TypeScript types and Server Action validation
   are not a security boundary against that; only privileges and RLS on
   the tables themselves are.

   The fix (migrations `0012` and `0016`): `INSERT`/`UPDATE` on
   `transactions`, `INSERT` on `transaction_entries`, and
   `INSERT`/`UPDATE`/`DELETE` on `household_members` are revoked from
   `authenticated` entirely. With direct writes closed, the three `create_*`
   RPCs and `add_household_member` were redefined as `SECURITY DEFINER` —
   they now run as the function owner (the table owner, which bypasses RLS
   on these tables by default in Postgres, since none of them use `FORCE
   ROW LEVEL SECURITY`) and each one **re-implements its own authorization
   check by hand** before writing anything:
   - the three ledger RPCs call a shared `is_wallet_authorized(wallet_id)`
     helper (PERSONAL: `owner_user_id = auth.uid()`; HOUSEHOLD:
     `is_household_member(household_id)`) for every wallet they touch, and
     derive `scope`/`owner_user_id`/`household_id` exclusively from that
     wallet row — never from a client-supplied parameter;
   - `add_household_member` checks the caller's own role in the target
     household, rejects assigning `'owner'` outright, and restricts
     `admin` callers to inviting `'member'` only (see
     `DOMAIN_RULES.md §Security`).
   Every one of these functions also sets `search_path = ''` and fully
   schema-qualifies every reference, closing the classic SECURITY DEFINER
   search-path-hijack (an attacker-controlled `search_path` shadowing an
   unqualified name), and has `EXECUTE` explicitly revoked from `PUBLIC`/
   `anon` and granted only to `authenticated`.

   `SECURITY DEFINER` is otherwise used only for a few narrow helper
   functions (`is_household_member`, `has_household_role`,
   `is_wallet_authorized`) whose entire job is to answer "does this user
   have access", precisely to avoid infinite RLS recursion when
   `household_members` policies would otherwise need to query
   `household_members`, and to let the ledger RPCs see a wallet row
   regardless of the caller's own RLS visibility (which is the point — it
   *is* the authorization check).

   The balance readers (`get_pocket_balance`, `get_wallet_balance`) remain
   `SECURITY INVOKER`: they only ever `SELECT`, so letting RLS govern what
   they can see is correct and requires no special handling.

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

**RLS is the boundary for reads; grants + triggers are the boundary for
writes that need more than "who is the caller".** RLS answers "may this
role see/touch this row" well, but a plain `USING`/`WITH CHECK` policy
cannot cleanly express "and these specific columns may never change" or
"and the new value of this column must be one of a restricted set
depending on the caller's role" against `OLD` in a `PATCH`-style update.
For those cases (§3, §9) the table's `GRANT` is narrowed (sometimes to
nothing at all, forcing all writes through a `SECURITY DEFINER` RPC) and a
trigger enforces the finer-grained rule. Both layers are database-level,
not application code — the distinction is *which* database mechanism is
the right tool, not whether the frontend can be trusted (it can't).

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
  `household_members` row immediately (owner/admin only, and never as
  `'owner'` — see `DOMAIN_RULES.md §Security`). There is no invitation/
  notification/accept flow yet — both people must already have an
  account. A pending-invite table is a reasonable Milestone 2 addition and
  does not require changing the membership model.
- **`profiles.email` is a denormalized copy** of `auth.users.email`,
  lowercased and kept in sync by the `handle_new_user` trigger at signup
  and `handle_user_email_change` if the user later changes their auth
  email, solely so household invites can look a person up by email without
  exposing `auth.users` to clients. It is not used for authentication, is
  protected by a case-insensitive unique index, and is not client-writable
  (column-level `GRANT` covers only `display_name`/`avatar_url` — see §9).
- **Household member roles cannot be changed and members cannot be
  removed yet.** `add_household_member` covers "add"; Milestone 1 has no
  UI or RPC for "change role" or "remove", so `UPDATE`/`DELETE` on
  `household_members` are revoked from `authenticated` outright rather
  than left open with only an RLS check that (as the hardening pass found)
  could not safely express the real rules. A future RPC for this needs to
  re-derive the same protections `household_members_protect_owner`
  already gives for free (never leave zero owners) plus the same
  self-promotion guard `add_household_member` gives for free (never
  create a second owner).
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

## 9. Milestone 1 hardening pass

A security/integrity audit of the Milestone 1 implementation above found
that several database-level protections were weaker than the application
code (and the original version of this document) assumed. Migrations
`0012`–`0018` close those gaps; nothing in `0001`–`0011` was rewritten, per
the standing rule that committed migration history is not edited after the
fact. Summary, in migration order:

| Migration | Closes |
|---|---|
| `0012_lockdown_transaction_writes.sql` | Direct `INSERT`/`UPDATE` on `transactions`/`transaction_entries` from `authenticated`; ledger RPCs redefined `SECURITY DEFINER` with explicit `is_wallet_authorized()` checks; `create_wallet_transfer` rejects cross-currency transfers; stray `PUBLIC`/`anon` `EXECUTE` grants revoked. |
| `0013_ledger_relationship_validation.sql` | An entry's wallet must be compatible with its transaction's scope/owner/household (defense-in-depth; the RPCs above already guarantee this by construction). |
| `0014_immutable_identity_fields.sql` | `wallets`/`pockets`/`categories` identity columns (scope, owner, household, `created_by`, `wallet_id`, `is_system`, wallet `currency`) can no longer be changed after creation. |
| `0015_profile_email_security.sql` | `profiles.email` is no longer client-writable (column-level grant), gets a case-insensitive unique index, and is normalized to lowercase; an `auth.users` email-change trigger keeps it in sync going forward. |
| `0016_household_invite_and_owner_integrity.sql` | `household_members` writes revoked from `authenticated` entirely; `add_household_member` redesigned `SECURITY DEFINER` with real role rules (see `DOMAIN_RULES.md §Security`); a trigger refuses to leave a household with zero owners. |
| `0017_default_pocket_invariant.sql` | A wallet's default pocket can no longer be unset or archived by a normal client, closing the gap between "at most one" (the existing unique index) and "exactly one" (what the app actually needs). |
| `0018_category_hierarchy_ownership.sql` | A category and its parent must now share the same scope and owner/household (and both be system or both not). |

Two related application-layer fixes shipped alongside the migrations
(no schema change, so no new migration):

- The transaction form's category picker and its inline "add category"
  flow now derive scope/owner/household from the **specific wallet** being
  transacted against (loaded server-side, RLS-checked) instead of from
  `getMyPrimaryHousehold()` — which picks an arbitrary household when a
  user belongs to more than one, and would previously offer or create
  categories for the wrong household. See `features/categories/api.ts`
  (`listCategoriesForWallet`) and `features/categories/actions.ts`.
- Wallet transaction history now groups `transaction_entries` by
  `transaction_id` before rendering, so a pocket transfer (which is two
  ledger rows in the same wallet) reads as one "Main → Travel" line
  instead of two unrelated rows. Presentation-only — see
  `features/transactions/api.ts` (`listTransactionsForWallet`).

## 10. Second Milestone 1 hardening pass

A follow-up review of §9's pass found three more gaps and several
integration tests that didn't actually isolate what they claimed to.
Migrations `0019`–`0021` close the schema gaps; `0012`–`0018` are not
edited, per the same standing rule.

| Migration | Closes |
|---|---|
| `0019_category_transaction_type_immutable.sql` | `categories.transaction_type` added to the existing immutability trigger — an EXPENSE category could previously be flipped to INCOME after the fact, silently corrupting the classification of every historical transaction that used it. |
| `0020_reject_archived_wallets_and_pockets.sql` | All three ledger RPCs now reject an archived wallet or pocket, mirroring the existing archived-category check. Write-time only — archiving never touches existing `transaction_entries` or the balances derived from them. |
| `0021_household_created_by_immutable.sql` | `households.created_by` added to the immutable-column guard (households had none before); renaming a household is untouched. |

Test suite fixes in `src/features/security/rls.integration.test.ts` (no
schema change, so no migration): the wallet-immutability test previously
wrote a user's own id back to their own row and asserted an error — a
no-op the trigger correctly allows, so the test could have passed even if
the trigger were broken. It now attempts an actual owner **A → B**
reassignment. The direct-`transaction_entries`-INSERT test used a
nonexistent transaction id, which a foreign-key violation could reject
even if the privilege lockdown itself were broken; it now creates a real
transaction via the approved RPC first, then attempts a direct INSERT
against that real id. The "PERSONAL transaction can't reference a
HOUSEHOLD wallet" test used a personal pocket (which the older
pocket-wallet trigger from 0008 would already reject on its own), so it
never actually exercised the newer transaction-wallet-scope trigger from
0013; it now uses a real pocket that belongs to the household wallet, so
only the scope trigger is left to catch it. A same-currency wallet
transfer success case was added (source down, destination up, combined
balance unchanged) alongside the existing pocket-transfer one. The
household-invite success test's cleanup was only conditional on
`SUPABASE_TEST_SERVICE_ROLE_KEY` being set, which left orphaned rows on a
rerun without it; that test now lives in its own `describe.skipIf(!hasServiceRole)`
block instead of quietly depending on an "optional" key for repeatability.

## 11. Verification note

Everything above was verified by typecheck, lint, unit tests, and a
production build. The new migrations were reviewed by hand but — like
`0001`–`0018` before them — **not applied against a live Postgres
instance**, because no Supabase project or local Postgres/Docker was
available in the environment either pass was done in. Treat the SQL as
carefully reviewed, not as integration-tested, until it has actually run
against a real database. `src/features/security/rls.integration.test.ts`
lists exactly which behaviors should be re-verified against once a
disposable Supabase project is available.

`src/app/manifest.ts` provides the web app manifest (Next.js file
convention — this alone generates `/manifest.webmanifest` and the `<link>`
tag). `public/icons/` holds placeholder SVG icons. `public/sw.js` is an
intentionally empty pass-through service worker registered from the root
layout purely to satisfy installability; it implements no caching strategy.
Caching authenticated financial data in a service worker is an explicit
future decision (see `DOMAIN_RULES.md`), not an oversight.
