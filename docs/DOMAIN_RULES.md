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
- **Category != Budget.** A Category classifies a transaction (accounting).
  A Budget (Phase E, `0034_budgets.sql`) says how much is *planned* to be
  spent in an EXPENSE category over one calendar month (planning). A
  Budget reads Categories — it never replaces or modifies them, and a
  Category's existence never implies a Budget exists for it.
- **Budget != Pocket.** A Pocket is real: it is where money is currently
  allocated inside a Wallet, and every ledger entry belongs to one. A
  Budget is pure planning metadata — it never moves money, never
  reserves ledger money, never creates a `transaction_entries` row, and
  never alters any Wallet/Pocket balance. Spending a Pocket's money and
  planning a Category's monthly limit are unrelated axes.
- **Budget != Saving Goal.** A future phase. A Budget is a spending
  *ceiling* for one category that resets every calendar month; a Saving
  Goal (not built) is an accumulating *target* with no monthly reset.
  Do not conflate the two when Saving Goals are added.
- **Budget spending is exact-category, not roll-up, in V1.** A Budget on
  a parent category counts only transactions whose `category_id` is
  exactly that parent — never its children's spending, and a child's
  Budget never counts the parent's. See `docs/FINANCE.md` "Phase E" for
  why (double-counting risk once both levels have their own budget).
- **Template != Transaction.** A Transaction Template (Phase F,
  `0035_transaction_templates.sql`) stores reusable *defaults* for
  creating a future INCOME/EXPENSE transaction — a name plus optional
  Wallet/Pocket/Category/amount/title/note/Tags. Creating, editing,
  archiving, or restoring a Template produces zero ledger effect: no
  `transactions` row, no `transaction_entries` row, no balance/Budget/
  report change of any kind. The real transaction exists only once a
  user opens the Template, reviews/edits the prefilled form, and presses
  Save — through the same `create_income_expense_transaction` writer a
  manually-typed entry uses.
- **Template != Recurring Transaction.** A Template is used **manually**,
  on demand, exactly when the user opens it and presses "ใช้ Template" —
  there is no schedule, no due date, and no expectation that it will ever
  be used again. A Recurring Transaction (Phase G,
  `0036_recurring_transactions.sql`) is a *rule that says a financial
  item is expected on a schedule* (weekly/monthly/yearly). A Template is
  not a weaker version of a Recurring rule, and a Recurring rule is not
  "a Template with a date bolted on" — they are different mechanisms
  entirely (explicit one-off reuse vs. an ongoing schedule), and Phase G
  deliberately does not let a Recurring rule point at a Template as its
  data source (see `docs/FINANCE.md` Phase G "Deferred").
- **Recurring Rule != Transaction, and a Recurring Occurrence != a
  ledger transaction either.** Creating, editing, pausing, resuming,
  archiving, or restoring a Recurring rule produces zero ledger effect.
  Generating an occurrence (a specific due date) produces zero ledger
  effect too — V1 is **safe confirm-before-post**: there is no scheduled/
  cron posting. An occurrence becomes a real transaction only once a
  user opens it, reviews/edits it, and presses "บันทึกรายการ" — through
  the same `create_income_expense_transaction` writer a manually-typed
  entry uses (via the atomic `post_recurring_occurrence` wrapper, see
  `docs/FINANCE.md` Phase G "Posting an occurrence").
- **Recurring Transaction != Bill/Installment.** A future phase. A
  Recurring Transaction (Phase G) only tracks *that something is
  expected on a schedule* — it has no concept of a total amount owed, a
  payoff date, or partial payments against a balance. A Bill/Installment
  (not built) would be a materially different domain: an amount that
  must eventually be fully paid off, tracked across multiple payments.
  Do not extend Recurring Transactions to model Bills when that phase
  arrives — build a separate domain instead, the same way Refund/
  Reimbursement (Phase D) got their own rules rather than overloading
  Transfer.
- **Category != Tag.** A Category is accounting classification: exactly one
  per INCOME/EXPENSE transaction (never on a TRANSFER), and it drives the
  Finance Hub's category totals. A Tag (Phase C,
  `0032_transaction_tags.sql`) is a reusable, cross-cutting label with no
  accounting meaning at all — a transaction can carry any number of them
  (including zero), of any mix, and every transaction type (INCOME,
  EXPENSE, Pocket Transfer, Wallet Transfer) can be tagged. Tag mutation
  never touches `transaction_entries` and has zero effect on any balance
  or report. See `docs/FINANCE.md` "Phase C" for the full contract.
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
- **A Refund/Reimbursement is not Income.** Money returned by a merchant
  (Refund) or covered by a third party for an Expense already paid
  (Reimbursement) is stored as `transaction_type = 'EXPENSE'` with a
  **positive** ledger entry and the original Expense's own `category_id`
  (Phase D, `0033_refunds_reimbursements.sql`) — never as `'INCOME'`, and
  never fabricated as a fake Income paired with the original Expense
  staying at its full amount. Expense 1,500 + Refund 500 reports as
  Income 0 / net Expense 1,000, not Income 500 / Expense 1,500. See
  `docs/FINANCE.md` "Phase D" for the full contract, including why this
  representation needed no new `transaction_type` enum value at all.
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

Every wallet has at least one Pocket, and **no Pocket is special.** There is
no "Main," no default, no `is_default` column at all (removed in
`0029_remove_pocket_default.sql` — an earlier version of this document
described a default-pocket invariant that has since been deliberately
removed as a domain decision, not merely renamed). A wallet is created
together with its first Pocket, atomically, via
`create_wallet_with_first_pocket` — the user names that first Pocket
themselves; it behaves identically to every Pocket added afterward. There
is no dedicated "reassign the default" concept to need an RPC for, because
there is nothing to reassign.

The "at least one Pocket" half of this now holds through the Phase A
lifecycle rules (`0030_wallet_pocket_lifecycle.sql`) rather than a
missing `DELETE` grant: a pocket can no longer be archived or hard-deleted
if it is the wallet's last active/remaining one, and the creation RPC
above never leaves a wallet with zero to begin with. See
`docs/FINANCE.md` §Phase A for the full lifecycle rule set (rename,
archive, restore, hard delete) for both Wallet and Pocket.

Wallet identity is frozen after creation: `scope`, `owner_user_id`,
`household_id`, and `created_by` cannot be changed by an `UPDATE` once the
row exists (enforced by a trigger, not just left to convention).
`currency` is **conditionally** immutable as of Phase A: mutable only
while the wallet has zero ledger history, frozen the moment it has any —
there is no FX/conversion feature, so changing a wallet's currency after
it already has history would make its past balances meaningless, but
there is no such risk before any history exists. See `docs/FINANCE.md`.

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

Edit and void shipped in Phase B (`0031_transaction_management.sql`), for
INCOME/EXPENSE only — Pocket Transfer and Wallet Transfer remain
immutable. `transactions.deleted_at` is the void marker, exactly as
originally shaped for this in Milestone 1: every balance/read query
already excluded soft-deleted transactions before Phase B existed, so
voiding one has zero financial effect the instant `deleted_at` is set —
no balance function needed to change. Correction goes through
`update_income_expense_transaction` / `void_transaction` /
`restore_transaction` (SECURITY DEFINER RPCs, the only way to touch these
columns — direct `UPDATE` on `transactions` stays revoked from
`authenticated`, see 0012), never a direct `DELETE FROM transactions` or
table-level `UPDATE`. Full accounting features (reversal entries with an
audit trail table, multi-step approval, etc.) remain explicitly deferred —
voiding is enough for now, not a full audit subsystem. See
`docs/FINANCE.md` "Phase B" for the exact edit/void/restore rules.

Phase D (`0033_refunds_reimbursements.sql`) extends these same three RPCs
rather than forking a parallel implementation: an EXPENSE cannot be
voided while it has an active linked Refund/Reimbursement (void those
first), an EXPENSE's amount cannot be edited below its current active
adjustment total, and a Refund/Reimbursement is itself immutable via
`update_income_expense_transaction` — void it and create a corrected one
instead. See `docs/FINANCE.md` "Phase D" for the full contract.

## Security (household & personal access)

- **Personal resource access rule:** `auth.uid() = owner_user_id`.
- **Household resource access rule:** `auth.uid()` is a row in
  `household_members` for that `household_id`.
- **Day-to-day household money management is a member-level privilege, not
  an owner/admin one.** Any active member of a household may create,
  rename, and archive that household's wallets, pockets, categories, tags,
  budgets, transaction templates, and recurring transactions, and create
  transactions against them. This is a deliberate product decision
  (shared finance is meant to be jointly managed), and it is what the RLS
  policies on `wallets`/`pockets`/`categories`/`transactions`/`tags`/
  `budgets`/`transaction_templates`/`recurring_transactions` actually
  implement — an earlier version
  of this document incorrectly implied these were owner/admin-gated,
  which they are not and are not meant to be. What every member *cannot*
  do is change identity/scope columns after creation (frozen by trigger —
  see "Wallet", "Category" above) or touch the ledger directly instead of
  through the RPCs.
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

## Bills

- Bill != Transaction and Bill != Recurring Transaction. Bill is payable
  obligation with due/payment state; Recurring is scheduled bookkeeping.
- Bill definition and occurrence create no ledger/Budget effect. Only
  explicit atomic payment creates one ordinary EXPENSE.
- DB stores OPEN/PAID/SKIPPED. UPCOMING/DUE/OVERDUE derive from canonical
  DATE against Asia/Bangkok today.
- Occurrence `expected_amount` is historical snapshot. Actual payment may
  differ; Expense edits/voids never rewrite Bill due date or expectation.
- Voided/refunded Bill payment leaves occurrence PAID. Financial correction
  follows existing transaction/refund rules; no automatic reopen.

## Installments

- Plan/unpaid installment creates no money. Each paid installment creates
  one ordinary Expense; never book full purchase plus installment Expenses.
- Expected installment snapshots sum exactly to plan total. V1 freezes
  schedule/total and requires exact expected payment, avoiding hidden
  re-amortization or floating-point remainder.
- Voiding paid Expense leaves installment PAID; no automatic reopen.

## Saving Goals

- Saving Goal != Wallet/Pocket. One Goal links to one Pocket but never changes
  Pocket accounting or creates Goal transactions/contributions.
- Progress equals unclamped ledger-derived Pocket balance. Negative and
  above-target values remain authoritative; only visual bars may clamp.
- Target changes/archive create no money. Currency derives from linked Wallet.

## Debt / Borrow / Lend

- Debt principal is explicit cash movement, never Income or Expense.
- Liability draw adds Wallet cash; repayment principal removes it. Interest is Expense.
- Receivable disbursement removes Wallet cash; principal receipt adds it. Interest is Income.
- Outstanding principal derives from immutable non-voided debt events. No mutable balance exists.
- Debt currency and Wallet currency must match. Archived debt remains readable and accepts no new events.

## Finance Reports

- Reports use active Income/Expense by `occurred_at`; refunds reduce Expense naturally.
- Transfer and Debt Principal are excluded. Currency totals always remain separate.

## Calendar Finance Items

- Calendar composes Finance due items at read time. It never duplicates them.
- Recurring/Bill/Installment tables remain lifecycle and accounting authority.
- Personal/Household visibility comes from each source table's existing RLS.

## Finance Attachments

- Attachment access follows transaction access. Bucket remains private.
- Stable paths contain transaction and attachment UUIDs. Signed URLs are temporary.
- Files are evidence only; upload/delete never changes ledger or transaction semantics.

## Finance Import

- CSV imports logical Income/Expense only, never raw ledger entries.
- Every row requires explicit Wallet/Pocket/Category UUIDs and canonical date/amount.
- Existing writer enforces scope, currency, RLS, and category invariants.
- Exact repeated canonical rows for one user are skipped by stable fingerprint.

## Finance Export

- Default CSV contains logical transactions, not arbitrary ledger rows.
- Voided rows are excluded; filters use inclusive local dates through exclusive bounds.
- Currency remains explicit per row. Export never combines unlike currencies.

## Net Worth

- Per currency: Wallet cash + receivable principal − liability principal.
- Archived sources with nonzero balances remain financial truth.
- No FX exists; unlike currencies never produce one net-worth figure.

## Insights

- Insights are deterministic summaries, not authoritative financial advice.
- Every result preserves currency and links to its underlying transaction/read model.
- Voided financial events do not contribute.

## Finance Hub

- Hub is presentation over authoritative read models; it owns no financial state.
- Compact Personal summaries link to full Personal/Household screens.
- Every amount remains grouped by currency. Quick actions reuse existing writers.
