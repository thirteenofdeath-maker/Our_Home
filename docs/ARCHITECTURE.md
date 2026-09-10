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

**`auth.users` is authentication identity. `public.profiles` is the
application profile.** They are two different tables with two different
jobs, kept in a strict 1:1 relationship by id:

- `auth.users` (managed entirely by Supabase Auth/GoTrue) holds
  credentials and identity — email, password hash, provider info. The
  application never reads or writes it directly and never duplicates a
  password or auth secret into its own tables.
- `public.profiles` holds everything the *application* needs to know about
  a person — `display_name`, `email` (a denormalized, lowercased copy used
  only for household-invite lookups, not authentication),
  `avatar_url`. Every foreign key in the app schema
  (`wallets.owner_user_id`, `categories.owner_user_id`, etc.) points at
  `profiles.id`, never at `auth.users.id` directly — so "does this user
  have an application identity yet" is always a question about `profiles`,
  answered by one row existing or not.
- Application profile data is created automatically by a `handle_new_user`
  trigger on `auth.users` insert (0002, hardened in 0015 and 0022 — see
  §12). No password or auth secret is ever duplicated into application
  tables.
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
| `pockets` | (inside wallet detail) | First pocket created atomically with its wallet, user-named; every pocket equal, no default (§14); balance from ledger |
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
| `0017_default_pocket_invariant.sql` | A wallet's default pocket can no longer be unset or archived by a normal client, closing the gap between "at most one" (the existing unique index) and "exactly one" (what the app actually needs). **Superseded by `0029` (§14): the default-pocket concept this hardened was later removed entirely, not merely re-hardened again.** |
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

## 12. Data repair: missing profiles

Confirmed against a live Supabase project: some `auth.users` rows had no
matching `public.profiles` row, which surfaces as `wallets_owner_user_id_fkey`
/ `categories_owner_user_id_fkey` violations the moment that user tries to
create a wallet or category (both foreign keys point at `profiles.id`, not
`auth.users.id` — see §4). Likely cause: those `auth.users` rows predate
`on_auth_user_created` existing on this database, or predate the
null-email hardening below.

`0022_backfill_missing_profiles.sql`:

- **Hardens `handle_new_user` against a null/missing `auth.users.email`.**
  `profiles.display_name`/`.email` are both `NOT NULL`; the previous
  definition (0002, then 0015) derived both unconditionally from
  `new.email`, so a null email would fail the `NOT NULL` constraint —
  and because this trigger runs `AFTER INSERT` on `auth.users` in the same
  transaction, that failure rolls back the signup itself, not just the
  profile. The redefined function falls back to a synthetic-but-unique
  placeholder email (`<user id>@no-email.invalid`) and a `'Member'`
  display name when nothing better is available, and `on conflict (id) do
  nothing` on the insert.
- **Backfills** one `profiles` row for every existing `auth.users` row
  with none, using the same fallback logic. Existing `profiles` rows are
  never touched (`LEFT JOIN ... WHERE profiles.id IS NULL`, plus `ON
  CONFLICT (id) DO NOTHING` as a second guarantee) — this is a pure
  gap-fill, re-runnable without effect once every user has a profile.
- **Does not** loosen `wallets_owner_user_id_fkey` /
  `categories_owner_user_id_fkey`, and does not remove `profiles` or its
  foreign key to `auth.users` — the fix is making sure the row those keys
  depend on actually exists, not relaxing what depends on it.
- **No new attack surface**: `handle_new_user` is still only reachable as
  an `AFTER INSERT` trigger on `auth.users` (not a callable RPC), and
  `profiles` still has no client-facing `INSERT` grant or policy (0002,
  0015) — a normal authenticated client cannot create a profile for
  themselves or anyone else via PostgREST regardless of this migration.

Like every migration before it, `0022` was reviewed by hand but not
applied against a live Postgres instance in this environment — see §11.
`src/features/security/rls.integration.test.ts` now includes a signup
test (gated on the service role, since it creates and must clean up a
real `auth.users` row) that proves a newly signed-up user gets a profile
and can immediately create a PERSONAL wallet and category.

## 13. Finance Hub (M2.4)

`/finance` is now the app's primary money destination — the bottom nav's
"การเงิน" points here, and Wallet/Pocket/Category are Finance sub-tools
(`เครื่องมือการเงิน`) rather than competing top-level destinations. Their
routes (`/wallets`, `/categories`, …) are unchanged and still fully
functional on their own; nothing about the Money domain (wallets, pockets,
categories, the ledger, transfers) was redesigned for this — Finance Hub
is a consolidation of navigation and a read model on top of it.

- **`get_finance_hub_summary(p_month_start, p_month_end)`**
  (`0028_finance_hub_read_model.sql`) is one `SECURITY INVOKER` (fully
  RLS-scoped) SQL function returning wallet balances, per-currency
  totals, per-currency month income/expense, and the current month's top
  5 expense categories (also per-currency) — all in one round trip, so
  the dashboard never issues a query per wallet or loads full transaction
  history to compute a monthly figure (§11 performance requirement).
  Every aggregate is grouped by wallet `currency`; none of them ever sums
  two currencies together (a household with THB and USD wallets gets two
  separate rows everywhere, never one combined number). No stored balance
  column was added — everything here is still derived from
  `transaction_entries` on read.
- **`src/features/finance/domain/finance.ts`** holds the pure logic:
  mapping the RPC's wire response into the app's decimal-string types
  (`mapFinanceSummaryWire`), grouping raw ledger rows into logical
  recent-activity entries the same way wallet-scoped history already does
  — a pocket transfer's two entries (same wallet) or a wallet transfer's
  two entries (different wallets) become one row, never two
  (`mapRecentFinanceTransactions`) — and the quick-add link builders.
  `src/features/finance/api.ts` is a thin wrapper that only does the
  Supabase I/O and calls those pure functions; this split is what makes
  the currency-safety and transfer-grouping rules unit-testable without a
  database (see `finance/domain/finance.test.ts`).
- **Quick add returns to Finance.** `createIncomeExpenseAction`
  (`transactions/actions.ts`) accepts an optional `returnTo` field,
  whitelisted to the single known-safe constant `FINANCE_RETURN_TO`
  (`/finance`) — anything else is ignored and the action falls back to
  its original wallet-detail redirect. This is the smallest change that
  gets "Finance → Add → Save → back to Finance" without a second
  transaction writer: the existing Server Action, RPC, and validation are
  completely unchanged, only the redirect target is now sometimes
  different. Pocket/wallet transfer quick-add intentionally does not use
  this — it already correctly reaches the existing transfer chooser, and
  the task scope only asked for the daily income/expense flow to return
  to Finance.
- **Deferred, and why**: a current-month top-5 expense category list is
  shown, but a full parent-category rollup was not built — the task
  explicitly permits deferring this ("if this requires disproportionate
  changes... defer it"), and grouping by the exact category actually used
  (already what the RPC does) covers the common case without needing to
  decide a rollup policy for categories with no parent. A trend chart
  (income vs. expense over 3/6/12 months) is explicitly out of scope for
  this pass — planned as the next task.

## 14. Removal of the default-pocket concept

A domain decision, not a UI change: no Pocket is special. `is_default`
(0006), the "exactly one default" trigger (0017, §10), and the
auto-created "Main" pocket are all removed in
`0029_remove_pocket_default.sql`. Every Pocket inside a Wallet is now
equal — the app never pre-selects one as *the* default, only as a UI
convenience (first in `sort_order`), and never persists that choice.

- **Column dropped, not deprecated in place.** Audited every reference
  first (both hardening-pass migrations, every app file under
  `features/pockets`, `features/transactions`, `features/wallets`, the
  wallet detail page, `src/types/database.ts`) — nothing outside this
  repo depends on `is_default`, no other table has a foreign key to it,
  and every reference was updated in the same change. `DROP COLUMN` never
  touches other columns or rows, so an existing "Main" pocket keeps its
  id, name, and — critically — every `transaction_entries` row that
  already references it; only the column that ever marked it special is
  gone. No historical data was renamed or rewritten.
- **Wallet creation is now atomic wallet-plus-first-pocket.**
  `create_wallet_with_first_pocket` (SECURITY INVOKER — wallets/pockets
  have never had their client `INSERT` grant revoked, so unlike the
  ledger RPCs this one adds no privilege of its own; the existing
  `wallets_insert`/`pockets_insert` RLS policies are still what authorize
  each statement) replaces the old "insert wallet, trigger creates Main"
  flow. The user names the first Pocket themselves at wallet-creation
  time; if either insert fails, the whole function's effects roll back,
  so a Wallet can never be left with zero Pockets from a partial failure.
- **"At least one Pocket" is structural, not trigger-enforced.** `pockets`
  has never granted client-facing `DELETE` (0011) — an existing wallet's
  Pocket count can only grow. Combined with the atomic creation RPC
  above, a wallet can never legitimately reach zero Pockets through the
  app. A CHECK/trigger pair to enforce this at the row level was
  deliberately not added — it would need to run on both `pockets` DELETE
  and `wallets` INSERT with awkward ordering, for an invariant these two
  simpler facts already guarantee.
- **UI forms updated, not duplicated**: `TransactionForm`,
  `PocketTransferForm`, and the wallet detail page no longer look for
  `is_default` — they either pick the first pocket in list order as a
  pure UI convenience (never persisted) or let the user choose explicitly.
  `WalletForm` gained one required field ("first pocket name"); the
  create-wallet Server Action and repository function were adapted in
  place, not duplicated.

## 15. Money Tracker expansion — Phase A: Wallet & Pocket management

Full lifecycle management (rename, edit, archive, restore, conditional
hard delete) for both entities, added in
`0030_wallet_pocket_lifecycle.sql`. Detailed rules — currency
immutability once history exists, archive-requires-zero-balance,
delete-requires-zero-history, "always at least one pocket" — are
documented in `docs/FINANCE.md` rather than duplicated here, since this
file's job is architecture, not the growing list of Money domain rules.

Two design choices worth calling out at the architecture level:

- **Delete has no "must already be archived" precondition.** It was
  considered and rejected: `wallets` → `pockets` is `ON DELETE CASCADE`
  (0006), and Postgres fires a child table's own row-level triggers for
  cascaded deletes exactly as for a direct one. An "archived-first"
  precondition on pockets would fire during a wallet's cascade delete
  and reject it, because an archived *wallet*'s pockets are not
  necessarily individually archived. "Zero history" alone is both what
  the product spec asked for and what avoids this trap.
- **UI reuses the categories-management pattern.** Rename forms, and a
  new shared `<ActionButton>` (`src/components/ui/ActionButton.tsx`) for
  archive/delete controls that can genuinely fail with a reason the user
  must see — mirrors `RenameCategoryForm`/`CategoryManagerList` rather
  than inventing a new interaction pattern for wallets/pockets.

## 16. Money Tracker expansion — Phase B: Transaction management

Edit/void/restore for INCOME/EXPENSE transactions, added in
`0031_transaction_management.sql` + `/finance/transactions` (search) and
`/finance/transactions/[transactionId]` (detail, with `/edit`). Detailed
rules are in `docs/FINANCE.md` "Phase B"; the one architectural point
worth calling out here is that **the audit done before implementing this
phase found the void architecture already built**: `transactions.deleted_at`
has been the void marker since the original ledger migration (`0008`), and
every balance/summary function already excluded it. Phase B is additive on
top of that existing shape — new SECURITY DEFINER RPCs to actually set/
clear the column and correct a transaction's fields (direct `UPDATE` on
`transactions` has been revoked since `0012` and stays that way), plus two
new audit columns (`voided_by`, `void_reason`) — not a redesign of how
balances are derived.

Search (`/finance/transactions`) reuses the "group ledger entries by
transaction_id, expand transfer candidates to both sides" strategy already
established for wallet-scoped history (`listTransactionsForWallet`) and
the Finance Hub's recent-activity feed (`mapRecentFinanceTransactions`),
via a new `groupSearchRows` — the one difference is it does not hard-
exclude voided transactions (status is a caller-supplied filter here, not
a given) and does not assume a single "wallet being viewed" (results can
span every wallet the caller can see, so every row carries its own
`currency`, same as the Finance Hub's cross-wallet framing).

## 17. Money Tracker expansion — Phase C: Transaction Tags

Cross-cutting Tags, added in `0032_transaction_tags.sql` +
`/finance/tags` (management) and a `TagPicker` integrated into every
transaction create/edit form. Detailed rules are in `docs/FINANCE.md`
"Phase C"; two architectural points worth calling out here:

- **Two different mutation strategies for two different kinds of write.**
  Tag CRUD (create/rename/archive/restore) is a plain RLS-gated direct
  table write, mirroring `categories` — a simple single-row mutation
  needs no bespoke RPC. Attaching tags to a transaction
  (`set_transaction_tags`) is the opposite: the join table
  (`transaction_tags`) has **no** direct `INSERT`/`DELETE` grant to
  `authenticated` at all, matching the `transaction_entries` lockdown
  (`0012`), because the association still gates access to a financial
  transaction even though the tag itself carries no financial value. The
  same distinction shows up again one level down: `assign_transaction_tags`
  (the actual validate-then-replace logic, shared by `set_transaction_tags`
  and the three `create_*` RPCs) is declared `SECURITY INVOKER` and is
  never granted to `authenticated` — it only runs with elevated privilege
  when called from inside another `SECURITY DEFINER` function already
  owned by the same role, so it cannot be invoked as a standalone client
  RPC at all, on top of the table-level lockdown.
- **Extending three existing RPCs was the deliberate alternative to a
  second writer.** `create_income_expense_transaction`,
  `create_pocket_transfer`, `create_wallet_transfer`, and
  `update_income_expense_transaction` (0031) each gained a trailing
  optional `p_tag_ids` parameter via DROP + CREATE (not `CREATE OR
  REPLACE`, since the argument list itself changes) rather than shipping
  a separate "attach tags after create" call — a second round trip has
  no way to guarantee the create and the tag attachment succeed or fail
  together, and the product brief was explicit that a create should never
  silently drop the tags it was asked for.

## 18. Money Tracker expansion — Phase D: Refunds + Reimbursements

Refund/Reimbursement, added in `0033_refunds_reimbursements.sql` +
`/finance/transactions/[transactionId]/refund` and `/reimbursement`.
Detailed rules are in `docs/FINANCE.md` "Phase D"; the architectural
points worth calling out here:

- **No new `transaction_type` enum value.** The audit found
  `get_wallet_balance`/`get_pocket_balance` (0010) already sum every
  ledger entry with no type filter, and `get_finance_hub_summary` (0028)
  already computes `sum(-amount) filter (EXPENSE)` grouped by
  `category_id`. Storing a refund/reimbursement as an ordinary
  `transaction_type = 'EXPENSE'` row with a positive entry and the
  original's own `category_id` therefore nets correctly through both
  functions with **zero changes to either** — the same "one DB type,
  split by a small amount of adjacent structure" pattern already
  established for Pocket Transfer vs. Wallet Transfer under the single
  `'TRANSFER'` type. `ALTER TYPE ... ADD VALUE` was deliberately avoided:
  a new enum value cannot safely be used in the same transaction that
  adds it in every Postgres version, and none of these migrations can be
  verified against a live database in this environment.
- **Race safety via row locks, not optimistic checks.** The combined
  refund+reimbursement cap against one original expense is enforced by
  `select ... for update` on that original's own row, inside
  `create_expense_adjustment_transaction`, `update_income_expense_transaction`
  (amount floor), `void_transaction` (block-if-active), and
  `restore_transaction` (cap re-check) alike — all four funnel through
  the same `get_expense_adjustment_total()` helper after acquiring the
  lock, so two concurrent requests that would each individually fit
  under the cap but not together are guaranteed to serialize rather than
  race.
- **Void/restore were extended, not forked.** Because a refund is
  already just an `EXPENSE`-typed transaction underneath, Phase D adds
  its rules directly into the existing Phase B `void_transaction` /
  `restore_transaction` RPCs (same signatures, `CREATE OR REPLACE`) rather
  than introducing parallel refund-specific versions — one void/restore
  code path for the whole system, matching the product brief's explicit
  instruction to reuse Phase B semantics.

## 19. Money Tracker expansion — Phase E: Budgets

Monthly category Budgets, added in `0034_budgets.sql` +
`/finance/budgets` (list with month navigation), `/new`, and
`/[budgetId]` (detail/edit/archive/restore). Detailed rules are in
`docs/FINANCE.md` "Phase E"; the architectural points worth calling out
here:

- **Direct RLS-gated table writes, not an RPC — the opposite choice from
  Phase D.** Budget CRUD (create, edit amount, archive, restore) has no
  cross-table atomicity requirement beyond "does this category qualify,"
  which a single `BEFORE INSERT` trigger (`budgets_validate_category`)
  already covers — the same reasoning already applied to Category and
  Tag. This is a deliberate contrast with Phase D's
  `create_expense_adjustment_transaction`, which genuinely needed a
  SECURITY DEFINER RPC because it writes across three tables under a
  race-safe cap. Not every new entity needs the heavier mutation
  strategy; the right one depends on whether real cross-table invariants
  exist to protect.
- **The spending calculation was designed to require zero changes to
  Phase D or the Finance Hub.** `get_budget_summary`'s `net_spent` uses
  the exact same `sum(-amount) filter (EXPENSE)` shape as
  `get_finance_hub_summary`'s (0028) category CTE, for one exact
  `category_id` instead of "every EXPENSE category this month." Because
  Phase D refunds/reimbursements are themselves `EXPENSE`-typed rows with
  the original's own `category_id`, this nets them automatically with no
  special-case branch for "is this a refund" anywhere in Budget's own
  SQL — the second time in this project a new accounting feature has
  been designed to fall out of an existing signed-sum rather than adding
  a parallel calculation (see Phase D §18 for the first).
- **One batched read model, not a per-Budget query.** `get_budget_summary`
  computes every Budget's `net_spent` for a month via a single JOIN/
  GROUP BY inside one SQL function call — a Budget list page never issues
  one spending lookup per card, regardless of how many Budgets exist for
  that month.

## 20. Money Tracker expansion — Phase F: Transaction Templates

Reusable transaction Templates, added in `0035_transaction_templates.sql` +
`/finance/templates` (list), `/new`, `/[templateId]` (detail),
`/[templateId]/edit`, and `/[templateId]/use` (fallback wallet picker).
Detailed rules are in `docs/FINANCE.md` "Phase F"; the architectural
points worth calling out here:

- **No second transaction writer.** A Template never creates a
  `transactions` row itself — "using" one routes into the existing
  `/wallets/[walletId]/transactions/new` page via `?templateId=`, which
  loads the Template server-side and passes its fields into
  `TransactionForm` as ordinary prefilled defaults (new optional
  `default*`/`staleNotices` props, all backward compatible). The actual
  save still goes through Phase B's `create_income_expense_transaction`
  RPC — the same validation, tags, budget effect, and `returnTo` handling
  a manually-typed transaction gets, with zero new transaction-creation
  code. The query string carries only a `templateId`, never encoded field
  values, so the Template row — re-validated server-side — is always the
  authority over what actually prefills.
- **A narrow `/use` page exists only for one stale case.** If a
  Template's saved wallet is missing or archived, the destination route
  (`/wallets/[walletId]/...`) has no wallet to target. Rather than adding
  a wallet-picker into `TransactionForm` itself — which would break Phase
  B's "wallet fixed by route" contract for every other caller —
  `/finance/templates/[templateId]/use` is a small intermediate page
  whose only job is listing the user's other eligible active wallets and
  linking each straight back into the same existing `new` route.
- **A lower atomicity bar for template tags than for transaction tags, by
  design.** Phase C embeds `p_tag_ids` directly into the transaction
  create RPC because a transaction has real accounting stakes — a
  create-succeeded-but-tags-failed gap would be a correctness bug.
  Templates carry none: `createTemplate` is a plain `INSERT`, followed by
  a separate `set_template_tags` RPC call. A gap between the two is a
  minor UX rough edge (tags missing until re-saved), never a ledger or
  Budget inconsistency, so the heavier atomic pattern was deliberately
  not reused here.
- **`transaction_template_tags` is locked down the same way
  `transaction_tags` and `expense_adjustments` are.** No direct INSERT/
  UPDATE/DELETE grant to `authenticated` on the join table; all writes go
  through the single SECURITY DEFINER `set_template_tags`, which
  re-checks PERSONAL-owner/HOUSEHOLD-member authorization and every tag's
  active/scope-compatible status itself rather than trusting RLS on the
  join table alone.
- **A new `CategorySelect`, not a reused `CategoryPicker`.** `CategoryPicker`'s
  inline "quick create category" affordance always sends a `walletId` to
  `createCategoryAction`, whose schema `.uuid()`-validates that field
  before treating an empty value as absent — passing `""` (a Template has
  no wallet context) would fail validation. Rather than touching a
  component already used across Phases A–D, Templates get their own
  plain flat-`<select>` `CategorySelect` with no inline-create feature at
  all, sidestepping the bug instead of fixing it in a shared component
  under time pressure.
- **Three-tier stale-reference handling, applied consistently to wallet,
  pocket, category, and tag.** (1) rejected at the moment a Template is
  created or a reference field is edited (`transaction_templates_validate_references`,
  firing only on INSERT or on UPDATE OF the reference columns themselves);
  (2) left alone if the Template is edited *without* touching that field —
  a Template that goes stale after saving stays readable, matching the
  archived-history principle used for Budget and Category; (3) surfaced
  as an explicit warning with no silent substitution at *use* time, via
  `staleNotices` in `TransactionForm` and the eligibility check on the
  `/[templateId]` detail page's "use" link.

## 21. Money Tracker expansion — Phase G: Recurring Transactions

Recurring Transactions, added in `0036_recurring_transactions.sql` +
`/finance/recurring` (list with Active/Paused/Archived + upcoming),
`/new`, `/[recurringId]` (detail, schedule, occurrence history),
`/[recurringId]/edit`, and `/occurrences/[occurrenceId]` (post/skip a
single due date, with an `/use` fallback wallet-picker). Detailed rules
are in `docs/FINANCE.md` "Phase G"; the architectural points worth
calling out here:

- **No cron, no background poster — occurrence generation is entirely
  read-triggered.** `materialize_recurring_occurrences` runs once before
  every recurring-data read (list, detail, Finance Hub) and lazily
  backfills whatever `UPCOMING` rows are missing for that caller's active
  rules, up to a 90-day horizon. This was a deliberate simplification the
  brief explicitly asked for (SAFE CONFIRM-BEFORE-POST, no scheduled
  server-side posting) — it also means there is no infrastructure this
  app doesn't already have (a request handler and a database) that this
  phase needed to introduce.
- **Every rule-lifecycle mutation stayed a plain RLS-gated table write —
  even the two with a real second-table side effect.** Create/edit
  defaults/edit schedule/pause/resume/archive/restore all go through
  ordinary `INSERT`/`UPDATE` on `recurring_transactions`, matching
  Category/Tag/Budget/Template precedent. The two edits that must touch
  `recurring_occurrences` (a schedule change rebuilding future `UPCOMING`
  rows; a resume/restore reactivating a dormant rule) do it via `AFTER
  UPDATE` triggers that are themselves `SECURITY DEFINER`, rather than
  via a bespoke "edit" RPC — the trigger runs with elevated privilege on
  behalf of the client's ordinary, lower-privileged `UPDATE`. This is a
  new variant of this codebase's two-tier mutation-strategy pattern:
  Phase D needed an RPC because it validates and writes atomically across
  three tables in one client-initiated call; Phase G's side effects are
  entirely deterministic consequences of a value actually changing, so a
  trigger expresses them with less surface area than a parallel RPC would.
- **Month-end/leap-year math lives in exactly one place,
  `recurring_next_due_date`, and always clamps against the ORIGINAL
  anchor.** `anchor_day` is a generated column
  (`extract(day from start_date)`) recomputed automatically whenever
  `start_date` changes, so it can never be sent inconsistently by a
  client or drift out of sync with the date it's derived from. Each step
  clamps against THAT anchor, never against the previous, possibly
  already-clamped occurrence — this is what turns `31 Jan -> 28 Feb ->
  31 Mar -> 30 Apr` into the correct sequence instead of drifting to
  `31 -> 28 -> 28 -> 28`.
- **Reactivation (resume/restore) fast-forwards past a dormant gap
  instead of backfilling it.** The same generation loop used for
  ordinary materialization takes a `fast_forward` flag, used only by the
  reactivation trigger, that advances the first candidate due date past
  "today" in cadence steps without ever creating rows for what it skips.
  Ordinary generation never sets this flag, so a rule that was simply
  never paused still shows real overdue occurrences as `UPCOMING` — the
  fast-forward exists specifically to stop a months-dormant rule from
  flooding history the moment it wakes back up, not to hide genuinely
  due items on an active rule.
- **`post_recurring_occurrence` delegates to the existing writer instead
  of duplicating its accounting logic, while still being genuinely
  atomic.** It locks the occurrence row, rejects anything not
  `UPCOMING`, then calls the unmodified `create_income_expense_transaction`
  (0032) from inside its own `SECURITY DEFINER` body — the nested call
  still authorizes against the real calling user, since `auth.uid()`
  reads the JWT claim rather than the current role, unaffected by the
  definer-role switch — and marks the occurrence `POSTED` in the same
  implicit transaction. A failed post and a successful post are each
  fully atomic with the occurrence's own status; double-posting is
  prevented by the row lock alone, with a partial unique index on
  `posted_transaction_id` as cheap defense-in-depth on top of it, not
  the actual mechanism.
- **`recurring_occurrences` is the strictest lockdown in this app.**
  Unlike Template/Budget/Tag, which grant `INSERT`/`UPDATE` directly to
  `authenticated` for their own metadata, occurrence rows have **no**
  direct write grant of any kind — every write (generation, posting,
  skipping) goes through one of three vetted RPCs. The justification is
  narrower than Phase C/D's tag/adjustment lockdowns: occurrence rows
  aren't just "mediating access to something sensitive," their very
  *existence and timing* must only ever come from the deterministic
  generation algorithm, never a freehand client write.
- **A Recurring rule was deliberately never made to point at a Template
  as its data source**, even though the two share almost the same
  "default transaction fields" shape. A Template can change or be
  archived independently of any rule that might reference it; a
  Recurring rule needs stable, independently-owned scheduled defaults
  that don't shift out from under it. "Create recurring from Template"
  was considered and deferred rather than built on top of a coupling
  that would undermine that stability.

## 22. Money Tracker expansion — Phase H: Bills / Due Dates

Bills use definition + stable occurrence tables in `0037_bills.sql`.
They reuse Phase G recurrence date math but remain a separate obligation
domain. OPEN urgency derives from Bangkok today; no background status
mutation or financial posting exists.

`pay_bill_occurrence` row-locks occurrence, enforces OPEN plus Bill
scope/currency, delegates to existing EXPENSE writer, then records PAID
provenance atomically. Batched reads avoid per-Bill occurrence/tag/payment
queries. Bill occurrences are Calendar-ready but never copied into
`calendar_events`.

## 23. Phase I — Installments

Installment plans generate fixed numbered Expense expectations. Exact
distribution and final remainder run in PostgreSQL numeric. Plan metadata
has zero ledger effect; payment reuses existing Expense writer behind a
row-locked atomic RPC. Schedule/total are immutable in V1 to preserve
stable occurrence history and avoid implicit re-amortization.

## 24. Phase J — Saving Goals

Linked-Pocket model keeps Goal as planning metadata and Pocket ledger balance
as sole progress authority. One batched SQL read returns Wallet currency,
source lifecycle, raw progress, and derived presentation values. No Goal
transaction or contribution subsystem exists.

## 25. Phase K — Debt / Borrow / Lend

Cash-linked debt uses explicit `DEBT_PRINCIPAL` transactions so Wallet/Pocket
cash stays authoritative without polluting Income/Expense. Immutable debt events
derive outstanding principal. SECURITY DEFINER RPCs validate scope/currency,
lock contracts for concurrent writes, and atomically compose principal with
ordinary interest transactions. RLS exposes only authorized account/event reads.

## 26. Phase L — Analytics / Reports

Reports use one RLS-scoped SQL read model. PostgreSQL numeric computes totals,
`occurred_at` defines Bangkok periods, and currency remains in every grouping.

## 27. Phase M — Finance and Calendar Composition

Calendar reads a union view over Finance occurrence tables through security
invoker RLS. Native Calendar events and Finance sources stay separate; UI merges
only presentation by canonical date.

## 28. Phase N — Finance Attachments

Private Storage objects and metadata share transaction authorization. Application
validates MIME/size, uploads object, then records metadata with cleanup on failure.
Reads create short-lived signed URLs. Ledger stays independent.

## 29. Phase O — CSV Import

Client parses and previews CSV with explicit column mapping. Server validates all
rows, then one SECURITY DEFINER RPC posts the bounded batch through existing
transaction writer. Fingerprints make retries idempotent without raw ledger access.

## 30. Phase P — Export

Route Handler calls one security-invoker SQL read model and serializes UTF-8 CSV.
SQL returns logical transactions and applies all filters under existing RLS.

## 31. Phase Q — Net Worth

One security-invoker SQL read model composes ledger-derived Wallet balances and
event-derived debt principal. It returns independent currency rows only.

## 32. Phase R — Insights

Server-side SQL rules generate traceable values and references. UI renders those
values without opaque scoring, AI interpretation, or client financial arithmetic.

## 33. Phase S — Global Quick Add

Global layout owns only navigation. Quick Add links to verified transaction and
transfer routes using an authorized active Wallet. It introduces no writer.

## 34. Phase T — Final Finance Hub

Hub composes established feature APIs plus one batched final read model. Cards use
progressive disclosure into feature routes; no duplicate writer or balance cache exists.
