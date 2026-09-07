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
There is exactly one default pocket per wallet at all times (enforced by a
partial unique index on `pockets (wallet_id) WHERE is_default`).

## Pocket

Belongs to exactly one wallet (`wallet_id`, `ON DELETE CASCADE` — a pocket
cannot outlive its wallet). Inherits scope/ownership through its wallet; it
does not store its own `scope`, `owner_user_id`, or `household_id`. This
avoids the possibility of a pocket disagreeing with its wallet about who owns
it.

## Category

Self-referencing tree via `parent_id` (no separate subcategories table).
Rules enforced by a trigger (`categories_validate_hierarchy`):

- A category cannot be its own parent.
- A category's `transaction_type` (`INCOME` or `EXPENSE`) must match its
  parent's `transaction_type`. You cannot nest an expense category under an
  income category or vice versa.
- Re-parenting cannot create a cycle (checked by walking the parent chain).

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

Both transfer kinds, plus income/expense creation, go through Postgres RPC
functions (`create_income_expense_transaction`,
`create_pocket_transfer`, `create_wallet_transfer`) so the header row and its
entry row(s) are written atomically — the database will never contain a
transaction with only one side of a transfer persisted.

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
- **Role-gated operations** (renaming a household, adding/removing members,
  archiving a household-scoped wallet or category on someone else's behalf)
  require role `owner` or `admin` — plain `member` can transact within
  household wallets but cannot change household structure or membership.
- These rules are enforced by Postgres Row Level Security, not only by the
  frontend. A user changing a URL or request body to reference another
  user's personal wallet, or a household they do not belong to, gets no rows
  back / a permission error from the database itself.
