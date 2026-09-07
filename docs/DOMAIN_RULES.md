# Domain rules — Our Home

This document is the plain-language contract for the money model. If code and
this document disagree, this document wins until it is deliberately updated.

## Core distinctions

- **Wallet != Pocket.** A Wallet is a real source of money (a bank account,
  cash, a credit card). A Pocket is an allocation of the money already inside
  one Wallet. Pockets never move money between different real-world sources —
  that is a Wallet Transfer.
- **Pocket != Category.** A Pocket answers *"which portion of this wallet is
  this money currently sitting in?"*. A Category answers *"what was this
  money earned from or spent on?"*. An expense has exactly one Pocket (where
  the money left from) and exactly one Category (what it was spent on); these
  are independent choices.
- **Category != Budget.** A Category classifies a transaction. A Budget (not
  built in Milestone 1) would say how much is *planned* to be spent in a
  category over a period. Building categories does not imply budgets exist
  yet, and budgets — when added — read categories, they do not replace them.
- **Wallet balance derives from the ledger.** A wallet's `balance` is never a
  stored, directly-editable column. It is always
  `SUM(transaction_entries.amount)` over that wallet's entries (excluding
  voided transactions).
- **Pocket balance derives from the ledger.** Same rule, scoped to
  `pocket_id` instead of `wallet_id`.
- **A Transfer is not Income.** A Transfer is not Expense. Pocket transfers
  and wallet transfers are their own `transaction_type = 'TRANSFER'`, with
  `category_id` always `NULL`. They must never be modeled as a fake expense
  paired with a fake income — that would double-count in income/expense
  reports.
- **A Pocket transfer does not change the wallet balance.** Moving money
  between two pockets in the same wallet nets to zero at the wallet level by
  construction: the transfer's two entries share the same `wallet_id` and
  have opposite signs.
- **A Wallet transfer does not change total net worth.** Moving money between
  two wallets nets to zero across the whole ledger: the two entries have
  opposite signs and sum to zero, regardless of which wallets they touch.
- **Historical categories must survive archive/delete.** A transaction's
  `category_id` must keep resolving to a real row forever. Categories that
  have ever been used are archived (`archived_at` set), never hard-deleted.
  Archiving removes a category from *new*-transaction pickers but changes
  nothing about transactions that already reference it. Deleting or
  archiving a category must never cascade-delete transactions.
- **Personal data is private.** A `scope = 'PERSONAL'` wallet, category, or
  transaction is visible only to its `owner_user_id`. No household member
  sees it by virtue of being in the same household.
- **Household data is shared only with members.** A `scope = 'HOUSEHOLD'`
  resource is visible to active members of `household_id`, per their role
  (see Security below). It is never visible to a user who is not a member.

## Wallet

Real source of money. `scope` is exactly one of `PERSONAL` or `HOUSEHOLD`:

- `PERSONAL` → `owner_user_id` required, `household_id` must be `NULL`.
- `HOUSEHOLD` → `household_id` required, `owner_user_id` must be `NULL`.

Both invariants are enforced by a database `CHECK` constraint, not only in
application code.

Every wallet has at least one Pocket. On wallet creation, a database trigger
automatically creates a default Pocket named **Main** (`is_default = true`).
There is exactly one default pocket per wallet at all times: a partial
unique index on `pockets (wallet_id) WHERE is_default` guarantees *at most*
one, and a trigger (`pockets_protect_default`) refuses to unset or archive
the current default, which is what actually rules out *zero* — the index
alone did not (an earlier version of this document overstated this before
that trigger was added). There is no "reassign the default pocket" RPC yet;
that would be needed before a normal client could ever legitimately change
which pocket is the default.

Wallet identity is frozen after creation: `scope`, `owner_user_id`,
`household_id`, `created_by`, and `currency` cannot be changed by an
`UPDATE` once the row exists (enforced by a trigger, not just left to
convention). `currency` in particular is fully immutable in Milestone 1 —
there is no FX/conversion feature, so changing a wallet's currency after it
might already have ledger history would make its past balances
meaningless.

## Pocket

Belongs to exactly one wallet (`wallet_id`, `ON DELETE CASCADE` — a pocket
cannot outlive its wallet). Inherits scope/ownership through its wallet; it
does not store its own `scope`, `owner_user_id`, or `household_id`. This
avoids the possibility of a pocket disagreeing with its wallet about who owns
it. `wallet_id` itself is frozen after creation (trigger-enforced) — a
pocket cannot be moved to a different wallet, which would otherwise silently
rewrite which wallet's balance its historical entries count toward.

### Archiving stops new activity, not history

Archiving a wallet or pocket (`is_archived = true`) blocks it from being
used in any **new** write: all three ledger RPCs
(`create_income_expense_transaction`, `create_pocket_transfer`,
`create_wallet_transfer`) check every wallet and pocket they touch and
reject the call if any of them is archived. This mirrors the existing rule
for archived categories.

Archiving never touches existing data — a wallet/pocket's historical
`transaction_entries` rows, and therefore its balance, are completely
unaffected by archiving it. Archive is a write-time gate on the future,
not a retroactive change to the past (same principle as archived
categories — see below).

## Category

Self-referencing tree via `parent_id` (no separate subcategories table).
Rules enforced by a trigger (`categories_validate_hierarchy`):

- A category cannot be its own parent.
- A category's `transaction_type` (`INCOME` or `EXPENSE`) must match its
  parent's `transaction_type`. You cannot nest an expense category under an
  income category or vice versa.
- A category must share its parent's scope and ownership: a `PERSONAL`
  category's `owner_user_id` must match its parent's, and a `HOUSEHOLD`
  category's `household_id` must match its parent's. This rules out a
  personal category nested under a household one (or vice versa), and a
  household category nested under a *different* household's category.
- A category and its parent must both be `is_system` or both not — a
  future seeded system category tree (none exist in Milestone 1) stays a
  fully separate tree from user-owned categories, so it is always clear
  who may rename or archive a given node.
- Re-parenting cannot create a cycle (checked by walking the parent chain).
- `scope`, `owner_user_id`, `household_id`, `created_by`, `is_system`, and
  `transaction_type` are frozen after a category is created
  (trigger-enforced); only `name`, `icon`, `sort_order`, `parent_id`, and
  `archived_at` can change. `transaction_type` was added to this list in a
  hardening pass: an EXPENSE category silently becoming INCOME would make
  every historical transaction that used it internally inconsistent, and
  would desync it from its children (the hierarchy trigger enforces
  "child matches parent" at write time, but does not retroactively walk
  back down and revalidate every child if the parent changes later).

The V1 UI only ever shows two levels (Category → Subcategory) even though the
schema permits deeper nesting — that is a UI choice, not a schema limit,
documented so a future "sub-subcategory" UI change does not require a
migration.

### Deletion vs archiving

- A category that has **never** been used by any transaction may be
  hard-deleted.
- A category that **has** been used by at least one transaction must be
  archived (`archived_at = now()`), never deleted. Archived categories:
  - remain valid targets for `transactions.category_id` (existing rows keep
    resolving correctly, and historical reports keep working),
  - are excluded from the picker shown when creating a *new* transaction,
  - can be restored (`archived_at = NULL`) which makes them selectable again.
- System categories (`is_system = true`, reserved for a future seeded
  default set) follow the same archive-not-delete rule; Milestone 1 does not
  seed any system categories, but the column and the rule exist now so
  seeding one later does not require a schema or policy change.

## Transaction ledger

Two tables: `transactions` (the header — what kind of event, when, why) and
`transaction_entries` (the money movement — which wallet/pocket, how much).
A transaction is never just a number on a wallet; it is always the header
plus one or more signed entries.

Amounts use `numeric(14,2)` end to end. Nothing in this codebase does
financial math in JavaScript `number`/floating point — amounts are validated
against a decimal-string schema and passed through as strings, and all
summation happens in Postgres via `SUM(numeric)`.

### Signed entry convention

- `INCOME` → one entry, `+amount`.
- `EXPENSE` → one entry, `-amount`.
- `TRANSFER` → exactly two entries: source `-amount`, destination `+amount`.
  The two entries always sum to zero.

### Pocket transfer example

Move 2,000 from `KBank/Main` to `KBank/Travel`:

```
transactions:          { transaction_type: TRANSFER, category_id: NULL }
transaction_entries:   (KBank, Main,   -2000)
                        (KBank, Travel, +2000)
```

Wallet total (`KBank`) is unchanged; only the pocket split changes.

### Wallet transfer example

Move 3,000 from `KBank/Main` to `SCB/Main`:

```
transactions:          { transaction_type: TRANSFER, category_id: NULL }
transaction_entries:   (KBank, Main, -3000)
                        (SCB,   Main, +3000)
```

Total net worth across both wallets is unchanged.

A wallet transfer requires both wallets to use the same `currency`. A plain
transfer has no exchange-rate semantics — moving money between a THB wallet
and a USD wallet needs an explicit FX rate, which is a future feature, not
part of Milestone 1. `create_wallet_transfer` rejects the attempt outright.

Both transfer kinds, plus income/expense creation, go through Postgres RPC
functions (`create_income_expense_transaction`,
`create_pocket_transfer`, `create_wallet_transfer`) so the header row and its
entry row(s) are written atomically — the database will never contain a
transaction with only one side of a transfer persisted.

**These RPCs are also the *only* way to write the ledger.** `transactions`
and `transaction_entries` grant `SELECT` only to authenticated clients;
direct `INSERT` (both tables) and `UPDATE` (`transactions`) are revoked.
This is not a redundant restriction on top of "the RPCs already do the
right thing" — an authenticated client can call PostgREST directly with
its own access token, entirely bypassing the RPCs and the Next.js app, so
the tables themselves have to refuse the write. Each RPC is `SECURITY
DEFINER` and re-checks authorization by hand (via `is_wallet_authorized`)
before writing anything; see `docs/ARCHITECTURE.md §3` for why and how.

## Balance calculation

```
pocket_balance(pocket_id) = SUM(transaction_entries.amount)
                            WHERE pocket_id = :pocket_id
                              AND transaction is not deleted/voided

wallet_balance(wallet_id) = SUM(transaction_entries.amount)
                            WHERE wallet_id = :wallet_id
                              AND transaction is not deleted/voided
                            -- equivalently: SUM of that wallet's pocket balances
```

There is exactly one source of truth for balance (the ledger). If a cached/
materialized balance is introduced later for performance, it is a derived
cache that can be recomputed from the ledger at any time — it never becomes
a second thing that must be kept manually consistent with the first.

## Transaction correction

Milestone 1 does not ship an edit or void UI. The schema is already shaped so
that one can be added without a redesign: `transactions.deleted_at` exists
and every balance/read query already excludes soft-deleted transactions. When
correction UI is built, it should set `deleted_at` (void) rather than
`DELETE FROM transactions`, preserving history for audit. Full accounting
features (reversal entries with an audit trail table, multi-step approval,
etc.) are explicitly deferred — voiding is enough for Milestone 1's
successor, not a full audit subsystem.

## Security (household & personal access)

- **Personal resource access rule:** `auth.uid() = owner_user_id`.
- **Household resource access rule:** `auth.uid()` is a row in
  `household_members` for that `household_id`.
- **Day-to-day household money management is a member-level privilege, not
  an owner/admin one.** Any active member of a household may create,
  rename, and archive that household's wallets, pockets, and categories,
  and create transactions against them. This is a deliberate product
  decision (shared finance is meant to be jointly managed), and it is what
  the RLS policies on `wallets`/`pockets`/`categories`/`transactions`
  actually implement — an earlier version of this document incorrectly
  implied these were owner/admin-gated, which they are not and are not
  meant to be. What every member *cannot* do is change identity/scope
  columns after creation (frozen by trigger — see "Wallet", "Category"
  above) or touch the ledger directly instead of through the RPCs.
- **Household *structure* — membership and roles — is owner/admin-gated,
  and further restricted beyond that:**
  - Renaming the household itself requires role `owner` or `admin`.
  - Adding a member requires role `owner` or `admin`, via
    `add_household_member` (there is no direct-insert path — see below).
  - An **owner** may add a new member as `admin` or `member`.
  - An **admin** may add a new member as `member` **only** — an admin
    cannot mint another admin. (Documented choice, not a technical
    limit: a future version could allow admin-invites-admin if there's a
    product reason to.)
  - **Nobody can add a member as `owner`.** `add_household_member` rejects
    `p_role = 'owner'` unconditionally, regardless of the caller's own
    role. A second owner is not a Milestone 1 concept.
  - Changing an existing member's role, or removing a member, has **no
    supported path at all** in Milestone 1 (no UI, no RPC, and direct
    `UPDATE`/`DELETE` on `household_members` is revoked from
    `authenticated`). This closes a real gap found during the hardening
    pass: an RLS policy that only checks "is the caller owner/admin" says
    nothing about which role value they're allowed to *write*, so it could
    not by itself have stopped an admin from `PATCH`-ing their own row to
    `role: "owner"`, or deleting the actual owner's row.
  - A household can never end up with **zero owners**: a trigger
    (`household_members_protect_owner`) refuses to delete or demote the
    last `owner` row, independent of which code path attempts it.
  - `households.created_by` (who founded the household) is frozen after
    creation (trigger-enforced) — an owner/admin renaming the household
    (still fully supported) cannot also silently rewrite who created it.
- **`profiles.email` is not client-writable at all** (only
  `display_name`/`avatar_url` are, via a column-level `GRANT`), is
  normalized to lowercase, and is protected by a case-insensitive unique
  index — two profiles can never both plausibly claim the same invite
  email. It is kept in sync with `auth.users.email` by triggers at signup
  and on later email changes, but is never used for authentication itself.
- These rules are enforced by Postgres Row Level Security, table/column
  `GRANT`s, and triggers — not only by the frontend. A user changing a URL
  or request body to reference another user's personal wallet, a household
  they do not belong to, or a privileged field they shouldn't be able to
  set, gets no rows back / a permission error from the database itself.
