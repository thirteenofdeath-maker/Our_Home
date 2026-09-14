# Database — Our Home (Milestone 1)

Source of truth: `supabase/migrations/*.sql`. This document explains the
schema; it does not replace reading the migrations for exact SQL.

## ER diagram

```mermaid
erDiagram
    PROFILES ||--o{ HOUSEHOLD_MEMBERS : "has"
    HOUSEHOLDS ||--o{ HOUSEHOLD_MEMBERS : "has"
    PROFILES ||--o{ HOUSEHOLDS : "creates"
    PROFILES ||--o{ WALLETS : "owns (personal)"
    HOUSEHOLDS ||--o{ WALLETS : "owns (household)"
    WALLETS ||--o{ POCKETS : "contains"
    PROFILES ||--o{ CATEGORIES : "owns (personal)"
    HOUSEHOLDS ||--o{ CATEGORIES : "owns (household)"
    CATEGORIES ||--o{ CATEGORIES : "parent_id (subcategory)"
    PROFILES ||--o{ TRANSACTIONS : "owns (personal)"
    HOUSEHOLDS ||--o{ TRANSACTIONS : "owns (household)"
    CATEGORIES ||--o{ TRANSACTIONS : "categorizes"
    TRANSACTIONS ||--|{ TRANSACTION_ENTRIES : "has 1 (income/expense) or 2 (transfer)"
    WALLETS ||--o{ TRANSACTION_ENTRIES : "money moves in/out of"
    POCKETS ||--o{ TRANSACTION_ENTRIES : "money moves in/out of"
    PROFILES ||--o{ TAGS : "owns (personal)"
    HOUSEHOLDS ||--o{ TAGS : "owns (household)"
    TRANSACTIONS ||--o{ TRANSACTION_TAGS : "labeled by"
    TAGS ||--o{ TRANSACTION_TAGS : "labels"
    TRANSACTIONS ||--o| EXPENSE_ADJUSTMENTS : "is a refund/reimbursement"
    TRANSACTIONS ||--o{ EXPENSE_ADJUSTMENTS : "is refunded/reimbursed by"
    PROFILES ||--o{ BUDGETS : "plans (personal)"
    HOUSEHOLDS ||--o{ BUDGETS : "plans (household)"
    CATEGORIES ||--o{ BUDGETS : "targets (EXPENSE only)"
    PROFILES ||--o{ TRANSACTION_TEMPLATES : "owns (personal)"
    HOUSEHOLDS ||--o{ TRANSACTION_TEMPLATES : "owns (household)"
    WALLETS ||--o{ TRANSACTION_TEMPLATES : "optional default"
    POCKETS ||--o{ TRANSACTION_TEMPLATES : "optional default"
    CATEGORIES ||--o{ TRANSACTION_TEMPLATES : "optional default (type-matched)"
    TRANSACTION_TEMPLATES ||--o{ TRANSACTION_TEMPLATE_TAGS : "defaults"
    TAGS ||--o{ TRANSACTION_TEMPLATE_TAGS : "defaults for"
    PROFILES ||--o{ RECURRING_TRANSACTIONS : "owns (personal)"
    HOUSEHOLDS ||--o{ RECURRING_TRANSACTIONS : "owns (household)"
    WALLETS ||--o{ RECURRING_TRANSACTIONS : "optional default"
    POCKETS ||--o{ RECURRING_TRANSACTIONS : "optional default"
    CATEGORIES ||--o{ RECURRING_TRANSACTIONS : "optional default (type-matched)"
    RECURRING_TRANSACTIONS ||--o{ RECURRING_OCCURRENCES : "generates"
    RECURRING_TRANSACTIONS ||--o{ RECURRING_TRANSACTION_TAGS : "defaults"
    TAGS ||--o{ RECURRING_TRANSACTION_TAGS : "defaults for"
    RECURRING_OCCURRENCES ||--o| TRANSACTIONS : "posted_transaction_id (once POSTED)"

    PROFILES {
        uuid id PK "= auth.users.id"
        text display_name
        text email "denormalized, for household invite lookup only"
        text avatar_url
        timestamptz created_at
        timestamptz updated_at
    }

    HOUSEHOLDS {
        uuid id PK
        text name
        uuid created_by FK
        timestamptz created_at
        timestamptz updated_at
    }

    HOUSEHOLD_MEMBERS {
        uuid id PK
        uuid household_id FK
        uuid user_id FK
        household_role role "owner | admin | member"
        timestamptz created_at
    }

    WALLETS {
        uuid id PK
        money_scope scope "PERSONAL | HOUSEHOLD"
        uuid owner_user_id FK "required iff PERSONAL"
        uuid household_id FK "required iff HOUSEHOLD"
        text name
        wallet_type wallet_type
        text currency "ISO 4217, e.g. THB"
        text icon
        boolean is_archived
        uuid created_by FK
        timestamptz created_at
        timestamptz updated_at
    }

    POCKETS {
        uuid id PK
        uuid wallet_id FK "immutable after creation"
        text name
        text icon
        int sort_order
        boolean is_archived
        timestamptz created_at
        timestamptz updated_at
    }

    CATEGORIES {
        uuid id PK
        money_scope scope "PERSONAL | HOUSEHOLD"
        uuid owner_user_id FK
        uuid household_id FK
        text name
        category_transaction_type transaction_type "INCOME | EXPENSE"
        uuid parent_id FK "self-reference, nullable"
        text icon
        int sort_order
        boolean is_system
        timestamptz archived_at "NULL = active"
        uuid created_by FK
        timestamptz created_at
        timestamptz updated_at
    }

    TRANSACTIONS {
        uuid id PK
        money_scope scope "PERSONAL | HOUSEHOLD"
        uuid owner_user_id FK
        uuid household_id FK
        transaction_type transaction_type "INCOME | EXPENSE | TRANSFER"
        uuid category_id FK "NULL for TRANSFER"
        text title
        text note
        timestamptz occurred_at
        uuid created_by FK
        timestamptz created_at
        timestamptz updated_at
        timestamptz deleted_at "NULL = active; void marker"
        uuid voided_by FK "set together with deleted_at (0031)"
        text void_reason "optional, set together with deleted_at (0031)"
    }

    TRANSACTION_ENTRIES {
        uuid id PK
        uuid transaction_id FK
        uuid wallet_id FK
        uuid pocket_id FK
        numeric amount "numeric(14,2), signed, <> 0"
        timestamptz created_at
    }

    TAGS {
        uuid id PK
        money_scope scope "PERSONAL | HOUSEHOLD"
        uuid owner_user_id FK "required iff PERSONAL"
        uuid household_id FK "required iff HOUSEHOLD"
        text name
        text normalized_name "generated: lower(btrim(name)); backs per-scope uniqueness"
        timestamptz archived_at "NULL = active/attachable"
        uuid created_by FK
        timestamptz created_at
        timestamptz updated_at
    }

    TRANSACTION_TAGS {
        uuid transaction_id FK "PK part 1"
        uuid tag_id FK "PK part 2"
        timestamptz created_at
    }

    EXPENSE_ADJUSTMENTS {
        uuid transaction_id PK_FK "the refund/reimbursement's own transaction; ON DELETE CASCADE"
        uuid original_expense_transaction_id FK "the EXPENSE being refunded/reimbursed"
        expense_adjustment_kind adjustment_kind "REFUND | REIMBURSEMENT"
        timestamptz created_at
    }

    BUDGETS {
        uuid id PK
        money_scope scope "PERSONAL | HOUSEHOLD"
        uuid owner_user_id FK "required iff PERSONAL"
        uuid household_id FK "required iff HOUSEHOLD"
        uuid category_id FK "must be an EXPENSE category, same scope/owner/household"
        text currency "ISO 4217, e.g. THB — never aggregated across currencies"
        date period_month "canonical first-of-month, e.g. 2026-09-01"
        numeric amount "> 0; the PLAN, never spent/remaining"
        timestamptz archived_at "NULL = active"
        uuid created_by FK
        timestamptz created_at
        timestamptz updated_at
    }

    TRANSACTION_TEMPLATES {
        uuid id PK
        money_scope scope "PERSONAL | HOUSEHOLD"
        uuid owner_user_id FK "required iff PERSONAL"
        uuid household_id FK "required iff HOUSEHOLD"
        transaction_type transaction_type "INCOME | EXPENSE only — frozen"
        text name
        text normalized_name "generated: lower(btrim(name)); backs per-scope uniqueness"
        uuid wallet_id FK "optional default"
        uuid pocket_id FK "optional default; requires wallet_id"
        uuid category_id FK "optional default; must match transaction_type"
        numeric amount "optional default; NULL means no default, not zero"
        text title "optional default"
        text note "optional default"
        timestamptz archived_at "NULL = active/usable"
        uuid created_by FK
        timestamptz created_at
        timestamptz updated_at
    }

    TRANSACTION_TEMPLATE_TAGS {
        uuid template_id FK "PK part 1"
        uuid tag_id FK "PK part 2"
        timestamptz created_at
    }

    RECURRING_TRANSACTIONS {
        uuid id PK
        money_scope scope "PERSONAL | HOUSEHOLD"
        uuid owner_user_id FK "required iff PERSONAL"
        uuid household_id FK "required iff HOUSEHOLD"
        transaction_type transaction_type "INCOME | EXPENSE only — frozen"
        text name
        uuid wallet_id FK "optional default"
        uuid pocket_id FK "optional default; requires wallet_id"
        uuid category_id FK "optional default; must match transaction_type"
        numeric amount "mandatory, > 0 — unlike a Template's optional amount"
        text title "optional default"
        text note "optional default"
        text frequency "WEEKLY | MONTHLY | YEARLY"
        int interval_count ">= 1"
        date start_date "canonical DATE, first occurrence"
        date end_date "optional; >= start_date"
        int anchor_day "generated: extract(day from start_date)"
        timestamptz paused_at "NULL = generating normally"
        timestamptz archived_at "NULL = active"
        uuid created_by FK
        timestamptz created_at
        timestamptz updated_at
    }

    RECURRING_OCCURRENCES {
        uuid id PK
        uuid recurring_transaction_id FK
        date due_date "canonical DATE; unique per rule"
        text status "UPCOMING | POSTED | SKIPPED"
        uuid posted_transaction_id FK "set only when POSTED"
        timestamptz posted_at
        timestamptz skipped_at
        timestamptz created_at
    }

    RECURRING_TRANSACTION_TAGS {
        uuid recurring_transaction_id FK "PK part 1"
        uuid tag_id FK "PK part 2"
        timestamptz created_at
    }
```

## Enums

- `money_scope`: `PERSONAL`, `HOUSEHOLD`.
- `household_role`: `owner`, `admin`, `member`.
- `wallet_type`: `BANK`, `CASH`, `CREDIT_CARD`, `E_WALLET`, `OTHER`.
- `transaction_type`: `INCOME`, `EXPENSE`, `TRANSFER` (transactions table).
  **Not** extended for refunds/reimbursements (0033) — deliberately, see
  `docs/FINANCE.md` "Phase D — Representation".
- `category_transaction_type`: `INCOME`, `EXPENSE` (categories table — a
  category can never be a "transfer" category, so this is a distinct,
  narrower enum rather than reusing `transaction_type`).
- `expense_adjustment_kind`: `REFUND`, `REIMBURSEMENT` (`expense_adjustments`
  table, 0033) — a brand-new enum type, not an extension of an existing
  one, so it carries none of `ALTER TYPE ... ADD VALUE`'s same-transaction
  usage restrictions.

## Key constraints (see migrations for exact SQL)

- `wallets`/`categories`/`transactions` all carry the same
  personal-vs-household `CHECK`:
  `(scope = 'PERSONAL' AND owner_user_id IS NOT NULL AND household_id IS NULL)
  OR (scope = 'HOUSEHOLD' AND household_id IS NOT NULL AND owner_user_id IS NULL)`.
- `pockets`: no `is_default` column, no default-pocket concept at all —
  removed in `0029_remove_pocket_default.sql` (the partial unique index
  and the `pockets_protect_default` trigger from `0017` were dropped along
  with it). Every pocket is equal. "At least one pocket per wallet" holds
  through three composed facts (not a CHECK, not a circular trigger — see
  `docs/FINANCE.md` "Phase A"): `create_wallet_with_first_pocket` (0029)
  creates a wallet and its first, ordinary, user-named pocket atomically;
  `pockets_require_active_sibling_to_archive` (0030) refuses to archive
  the last active one; `pockets_prevent_delete_if_used` (0030) refuses to
  hard-delete the last one except as part of deleting the whole wallet.
  `pockets` gained a real `DELETE` grant in 0030 (Phase A) — it did not
  have one before that (0011).
- `household_members`: unique `(household_id, user_id)` — a user cannot be a
  member of the same household twice. A trigger
  (`household_members_protect_owner`, `0016_household_invite_and_owner_integrity.sql`)
  refuses to delete or demote the last `owner` row of a household.
- `categories`: trigger-enforced — no self-parenting, no cycles, parent and
  child `transaction_type` must match, and (added in
  `0018_category_hierarchy_ownership.sql`) parent and child must share the
  same `scope` and `owner_user_id`/`household_id` (and both be `is_system`
  or both not) — a personal category cannot nest under a household one, a
  household category cannot nest under another household's, etc.
- `transaction_entries.amount`: `CHECK (amount <> 0)` — a zero-amount entry
  is never meaningful.
- `transaction_entries`: trigger-enforced — the referenced `pocket_id` must
  belong to the referenced `wallet_id` (0008), and (added in
  `0013_ledger_relationship_validation.sql`) the referenced `wallet_id`
  must be compatible with the parent transaction's scope/owner/household.
- `transactions`: `CHECK` — `TRANSFER` rows always have `category_id IS
  NULL`; `INCOME`/`EXPENSE` rows are expected (application-validated, not
  DB-forced) to carry a category.
- **Identity/scope columns are immutable after creation**
  (`0014_immutable_identity_fields.sql`, extended by
  `0019_category_transaction_type_immutable.sql` and
  `0021_household_created_by_immutable.sql`): `wallets.scope`,
  `.owner_user_id`, `.household_id`, `.created_by`, `.currency`;
  `pockets.wallet_id`; `categories.scope`, `.owner_user_id`,
  `.household_id`, `.created_by`, `.is_system`, `.transaction_type`;
  `households.created_by`. `transactions` has no
  `prevent_immutable_column_changes` trigger of its own — not because it
  needs none (Phase B's edit RPC must still keep `transaction_type` and
  the wallet identity frozen), but because direct `UPDATE` on
  `transactions` is revoked entirely (see "Transaction write security"
  below); the RPC's own explicit column list is what actually protects
  those fields, the same way the `create_*` RPCs never accepted them as
  parameters in the first place.
- `create_wallet_transfer` rejects a transfer between wallets with
  different `currency` values — a plain transfer has no exchange-rate
  semantics; cross-currency movement is a future feature, not part of
  Milestone 1.
- **Archived wallets/pockets reject new ledger activity**
  (`0020_reject_archived_wallets_and_pockets.sql`): all three `create_*`
  RPCs check `is_archived` on every wallet and pocket they touch, mirroring
  the existing archived-category check. This is a write-time gate only —
  archiving never modifies or hides existing `transaction_entries` rows or
  the balances derived from them.
- **`tags.normalized_name`** (`0032`) is `generated always as
  (lower(btrim(name))) stored` — never application-computed, so a client
  cannot bypass duplicate detection by skipping normalization. Two partial
  unique indexes enforce it per scope: `(owner_user_id, normalized_name)
  where scope = 'PERSONAL'` and `(household_id, normalized_name) where
  scope = 'HOUSEHOLD'`. A PERSONAL tag and a HOUSEHOLD tag (or two
  different households' tags) with the same name are distinct rows —
  the uniqueness check never crosses scopes.
- **`transaction_tags`** (`0032`) has no `CHECK`/trigger of its own beyond
  its composite primary key (`transaction_id, tag_id` — a transaction
  cannot carry the same tag twice); every actual business rule (tag not
  archived, tag scope matches the transaction) is enforced procedurally
  inside `assign_transaction_tags`, not at the constraint level, because
  it depends on comparing two other tables' rows rather than a fact about
  this row alone.
- **`expense_adjustments`** (`0033`) has `transaction_id` as its own
  primary key (one adjustment marker per transaction — a transaction is
  never more than one kind of thing) and `ON DELETE CASCADE` from
  `transactions`. There is no `CHECK` enforcing "the referenced original
  is an EXPENSE" or the refund-cap invariant at the constraint level —
  both require comparing against other rows (the original's own type,
  its current amount, the sum of every other active adjustment against
  it) and a race-safe `SELECT ... FOR UPDATE` lock, so they live entirely
  inside `create_expense_adjustment_transaction` and the refund-aware
  extensions to `update_income_expense_transaction` / `void_transaction` /
  `restore_transaction` (see "Functions" below and `docs/FINANCE.md`
  Phase D "Combined cap + concurrency").
- **`budgets`** (`0034`): `budgets_amount_positive_chk` (`amount > 0`) and
  `budgets_period_month_canonical_chk` (`period_month` must equal its own
  truncation to month-start — always day 1, e.g. `2026-09-01`, never a
  mid-month date) are plain `CHECK` constraints. Two partial unique
  indexes (`(owner_user_id, category_id, currency, period_month) where
  scope = 'PERSONAL' and archived_at is null`, and the `household_id`
  equivalent for `HOUSEHOLD`) prevent a duplicate ACTIVE Budget for the
  same identity — an archived row never blocks a new active one, but
  restoring an archived row into an identity a newer active row already
  occupies hits the same index and is rejected. Identity
  (`scope`/`owner_user_id`/`household_id`/`created_by`/`category_id`/
  `currency`/`period_month`) is frozen after creation by
  `prevent_immutable_column_changes` — only `amount` and `archived_at`
  are mutable. Category validity (EXPENSE-typed, not archived, same
  scope/owner/household) is enforced procedurally by
  `budgets_validate_category`, a `BEFORE INSERT`-only trigger — it does
  NOT re-run on `UPDATE`, so an existing Budget survives its category
  being archived afterward.
- **`transaction_templates`** (`0035`): `transaction_templates_type_chk`
  (INCOME or EXPENSE only), `transaction_templates_amount_positive_chk`
  (`amount is null or amount > 0` — NULL is a valid "no default", zero/
  negative are not), and `transaction_templates_pocket_requires_wallet_chk`
  (`pocket_id is null or wallet_id is not null`) are plain `CHECK`
  constraints. Two partial unique indexes prevent a duplicate ACTIVE name
  per scope (same shape as Tags' uniqueness). Identity
  (`scope`/`owner_user_id`/`household_id`/`created_by`/`transaction_type`)
  is frozen by `prevent_immutable_column_changes` — `name`, `wallet_id`,
  `pocket_id`, `category_id`, `amount`, `title`, `note` all remain
  editable (unlike Budget, a Template's whole point is that its defaults
  change over time). Reference validity (Wallet/Pocket/Category must be
  active and scope-compatible; Pocket must belong to Wallet; Category
  must match `transaction_type`) is enforced procedurally by
  `transaction_templates_validate_references`, firing on `INSERT` and on
  `UPDATE OF wallet_id, pocket_id, category_id` (plus the identity
  columns) — an amount/title/note-only edit never re-validates an
  already-saved, possibly-since-archived reference.
- **`recurring_transactions`** (`0036`): `recurring_transactions_type_chk`
  (INCOME or EXPENSE only), `recurring_transactions_amount_positive_chk`
  (`amount > 0` — mandatory, unlike a Template's nullable amount),
  `recurring_transactions_pocket_requires_wallet_chk`,
  `recurring_transactions_frequency_chk` (`WEEKLY`/`MONTHLY`/`YEARLY`
  only), `recurring_transactions_interval_positive_chk`
  (`interval_count >= 1`), and `recurring_transactions_end_after_start_chk`
  (`end_date is null or end_date >= start_date`) are plain `CHECK`
  constraints. `anchor_day` is `generated always as (extract(day from
  start_date)::int) stored` — never client-supplied, so it can never go
  stale relative to `start_date` or be sent inconsistently. Identity
  (`scope`/`owner_user_id`/`household_id`/`created_by`/`transaction_type`)
  is frozen by `prevent_immutable_column_changes`; unlike Budget, the
  *schedule* columns (`frequency`/`interval_count`/`start_date`/
  `end_date`) and `paused_at`/`archived_at` all remain freely editable —
  their side effects on `recurring_occurrences` are handled by two
  `AFTER UPDATE` triggers (see "Functions" below), not by freezing them.
  Reference validity (Wallet/Pocket/Category) is enforced procedurally by
  `recurring_transactions_validate_references`, mirroring
  `transaction_templates_validate_references` exactly.
- **`recurring_occurrences`** (`0036`): `recurring_occurrences_status_chk`
  restricts `status` to `UPCOMING`/`POSTED`/`SKIPPED`;
  `recurring_occurrences_status_consistency_chk` keeps
  `posted_transaction_id`/`posted_at`/`skipped_at` in lockstep with
  `status` (each status implies an exact combination of which of those
  three are null). `unique(recurring_transaction_id, due_date)` is what
  makes occurrence generation idempotent — a repeated generation call for
  a date that already exists (in ANY status, including `SKIPPED`) is a
  no-op via `ON CONFLICT DO NOTHING`. A partial unique index on
  `posted_transaction_id` (where not null) is additional defense-in-depth
  against ever double-linking one transaction to two occurrences, on top
  of the `SELECT ... FOR UPDATE` row lock that is the actual double-post
  guard (see `post_recurring_occurrence` below and `docs/FINANCE.md`
  Phase G "Atomic posting").

## Functions

| Function | Security | Purpose |
|---|---|---|
| `handle_new_user()` | DEFINER (trigger on `auth.users`) | Creates the matching `profiles` row on signup, email lowercased, with a synthetic-but-unique fallback email/display name if `auth.users.email` is null (0022). |
| `handle_user_email_change()` | DEFINER (trigger on `auth.users`) | Keeps `profiles.email` in sync if the user later changes their auth email. |
| `set_updated_at()` | INVOKER (trigger) | Generic `updated_at = now()` on update, attached to every table that has the column. |
| `create_wallet_with_first_pocket(...)` | INVOKER | Atomically inserts a wallet and its first, ordinary, user-named pocket (0029). Replaces the removed auto-"Main" trigger; authorization comes entirely from the existing `wallets_insert`/`pockets_insert` RLS policies. |
| `wallets_prevent_currency_change_with_history()` | INVOKER (trigger on `wallets`) | Rejects a currency change once the wallet has any `transaction_entries` (0030). |
| `wallets_require_zero_balance_to_archive()` | INVOKER (trigger on `wallets`) | Rejects archiving unless `get_wallet_balance()` is exactly zero (0030). |
| `wallets_prevent_delete_if_used()` | INVOKER (trigger on `wallets`) | Rejects hard delete if the wallet has any transaction history (0030). |
| `pockets_require_active_sibling_to_archive()` | INVOKER (trigger on `pockets`) | Rejects archiving a wallet's last active pocket (0030). |
| `pockets_prevent_delete_if_used()` | INVOKER (trigger on `pockets`) | Rejects hard delete if the pocket has history, or (only while the wallet still exists) if it is the wallet's last pocket (0030) — see `docs/FINANCE.md`. |
| `categories_validate_hierarchy()` | INVOKER (trigger on `categories`) | Rejects self-parenting, cycles, transaction-type mismatches, and scope/ownership mismatches with the parent. |
| `transaction_entries_validate_pocket()` | INVOKER (trigger on `transaction_entries`) | Rejects an entry whose pocket does not belong to its wallet. |
| `transaction_entries_validate_wallet_scope()` | INVOKER (trigger on `transaction_entries`) | Rejects an entry whose wallet is incompatible with its parent transaction's scope/owner/household. |
| `prevent_immutable_column_changes()` | INVOKER (trigger, parameterized) | Generic guard used on `wallets`/`pockets`/`categories`/`households` to freeze identity columns after creation. |
| `household_members_protect_owner()` | INVOKER (trigger on `household_members`) | Refuses to delete or demote a household's last `owner`. |
| `is_household_member(household_id)` | DEFINER | RLS helper — avoids recursive RLS on `household_members`. |
| `has_household_role(household_id, roles[])` | DEFINER | RLS helper for role-gated operations. |
| `is_wallet_authorized(wallet_id)` | DEFINER | Authorization check used by every ledger-write RPC below (PERSONAL owner or HOUSEHOLD member). |
| `get_pocket_balance(pocket_id)` | INVOKER | `SUM(transaction_entries.amount)` for one pocket, RLS-respecting. |
| `get_wallet_balance(wallet_id)` | INVOKER | `SUM(transaction_entries.amount)` for one wallet, RLS-respecting. |
| `get_finance_hub_summary(month_start, month_end)` | INVOKER | Batched Finance Hub read model (0028): wallet balances, currency totals, month income/expense, and top-5 expense categories, ALL grouped by currency (never summed across currencies). One round trip, RLS-scoped, no stored balances. **Unmodified by Phase D (0033)** — a refund/reimbursement is a `transaction_type = 'EXPENSE'` row with a positive entry and the original's `category_id`, so it already nets correctly through this function's existing `sum(-amount) filter (EXPENSE)` and category grouping (see `docs/FINANCE.md` Phase D). |
| `create_income_expense_transaction(...)` | **DEFINER** | Checks `is_wallet_authorized()` and wallet/pocket/category archived status, then atomically inserts a transaction header + its single entry + (0032) an optional tag set via `assign_transaction_tags`. Redefined (DROP + CREATE) in 0032 to add the trailing `p_tag_ids` parameter. |
| `create_pocket_transfer(...)` | **DEFINER** | Checks `is_wallet_authorized()` and wallet/pocket archived status, then atomically inserts a TRANSFER header + two entries in the same wallet + (0032) an optional tag set. Redefined in 0032. |
| `create_wallet_transfer(...)` | **DEFINER** | Checks `is_wallet_authorized()`, archived status, and currency match for both wallets/pockets, then atomically inserts a TRANSFER header + two entries across two wallets + (0032) an optional tag set. Redefined in 0032. |
| `add_household_member(household_id, email, role)` | **DEFINER** | Explicitly checks the caller is owner/admin, enforces the invite-role rules (see `DOMAIN_RULES.md §Security`), looks up `profiles` by email with RLS bypassed on purpose, and inserts the membership row. |
| `is_transaction_authorized(transaction_id)` | DEFINER | Authorization check for edit/void/restore/tag-attach/refund-create (0031, reused by 0032 and 0033) — PERSONAL owner or HOUSEHOLD member, mirroring `is_wallet_authorized`. |
| `update_income_expense_transaction(...)` | **DEFINER** | Checks `is_transaction_authorized()`, rejects TRANSFER/voided, validates the new pocket (same wallet, active) and category (only when it changes), then atomically corrects the transaction row, rebuilds its single ledger entry, and (0032) optionally replaces its tag set. Signature last changed in 0032 (`p_tag_ids`); **0033 redefines the same signature via `CREATE OR REPLACE`** to additionally reject editing a refund/reimbursement outright and to reject reducing an EXPENSE's amount below its active adjustment total (locks the row `FOR UPDATE` first). |
| `void_transaction(transaction_id, void_reason?)` | **DEFINER** | Checks `is_transaction_authorized()`, rejects TRANSFER and an already-voided transaction, then sets `deleted_at`/`voided_by`/`void_reason` (0031). Ledger entries and `transaction_tags` are both untouched. **0033 redefines the same signature** to additionally lock the row `FOR UPDATE` and reject voiding an EXPENSE that still has an active linked refund/reimbursement. |
| `restore_transaction(transaction_id)` | **DEFINER** | Checks `is_transaction_authorized()`, rejects a transaction that isn't voided, requires every wallet/pocket the transaction's entries touch to still be active, then clears `deleted_at`/`voided_by`/`void_reason` (0031). Tag associations are untouched. **0033 redefines the same signature** to additionally re-validate (when restoring a refund/reimbursement) that its original expense is still active and that restoring it would not exceed the combined cap — locks the original's row `FOR UPDATE` first. |
| `assign_transaction_tags(transaction_id, tag_ids[])` | INVOKER, **not granted to `authenticated`** | Internal helper (0032): validates every tag id (exists, not archived, same scope/owner/household as the transaction) before deleting the transaction's old tag set and inserting the new one — all-or-nothing. Only reachable from inside another SECURITY DEFINER function owned by the same role; a direct client RPC call is rejected outright. |
| `set_transaction_tags(transaction_id, tag_ids[])` | **DEFINER** | The one client-facing tag-association RPC (0032). Checks `is_transaction_authorized()`, then delegates to `assign_transaction_tags`. Replaces a transaction's full tag set; zero effect on any balance. |
| `get_expense_adjustment_total(original_expense_transaction_id)` | INVOKER | Phase D (0033): `SUM` of active (non-voided) refund/reimbursement ledger entries linked against one original expense. Always live — never cached — so it stays correct across edits to the original's own amount. Shared by the create RPC's cap check, the edit RPC's amount floor, void's block-if-active check, and restore's cap re-check. |
| `get_expense_refundable_summary(transaction_id)` | INVOKER | Phase D (0033) read model: `original_amount`, `active_refund_total`, `active_reimbursement_total`, `remaining_adjustable_amount`, all as decimal strings. Backs the Expense detail page and the create-adjustment form's live cap display. |
| `create_expense_adjustment_transaction(...)` | **DEFINER** | Phase D (0033), the one authoritative mutation for both REFUND and REIMBURSEMENT. Checks `is_transaction_authorized()` on the original, locks its row `FOR UPDATE`, validates it's an active EXPENSE and not itself an adjustment, checks destination wallet/pocket authorization + scope match + active status + currency match, race-safely enforces the combined cap, then inserts the transaction (category_id copied from the original) + its single positive entry + the `expense_adjustments` link + an optional tag set. |
| `budgets_validate_category()` | INVOKER (trigger on `budgets`, `BEFORE INSERT` only) | Phase E (0034): rejects a new Budget targeting an INCOME category, an archived category, or a category outside the Budget's own scope/owner/household. Deliberately not re-run on `UPDATE`. |
| `get_budget_summary(period_month, month_start, month_end)` | INVOKER | Phase E (0034) read model: every Budget (active and archived) for one exact month, each with a live-derived `net_spent`/`remaining` computed in the SAME query — never one spending lookup per Budget. `net_spent` already nets Phase D refunds/reimbursements with zero special-case logic (same signed-sum shape as `get_finance_hub_summary`'s category CTE) and is never clamped — legitimately negative on a cash-basis month dominated by refunds. |
| `transaction_templates_validate_references()` | INVOKER (trigger on `transaction_templates`, `BEFORE INSERT OR UPDATE OF wallet_id, pocket_id, category_id, ...`) | Phase F (0035): rejects newly assigning an archived or scope-incompatible Wallet/Pocket/Category, a Pocket not belonging to the given Wallet, or a Category whose `transaction_type` doesn't match. Never re-validates a reference an unrelated edit didn't touch. |
| `set_template_tags(template_id, tag_ids[])` | **DEFINER** | Phase F (0035), the one tag-association RPC for Templates. Inlines its own authorization check (no separate `is_template_authorized` helper needed — unlike Phase C/D's transaction-authorization helpers, nothing else needs to reuse this check) and validates every tag (exists, not archived, same scope/owner/household) before replacing the Template's tag set. Zero financial effect. |
| `recurring_transactions_validate_references()` | INVOKER (trigger on `recurring_transactions`, `BEFORE INSERT OR UPDATE OF wallet_id, pocket_id, category_id, ...`) | Phase G (0036): mirrors `transaction_templates_validate_references` exactly — rejects newly assigning an archived or scope-incompatible Wallet/Pocket/Category, a Pocket not belonging to the given Wallet, or a Category whose `transaction_type` doesn't match. |
| `recurring_next_due_date(prev, start, frequency, interval_count, anchor_day)` | INVOKER, pure | Phase G (0036): the deterministic month-end/leap-year-safe schedule step. Always clamps against the ORIGINAL `anchor_day` (from `start`), never the previous occurrence's own already-clamped day — see `docs/FINANCE.md` Phase G "Month-end anchoring" for the exact worked examples this is tested against. |
| `generate_recurring_occurrences_for_rule(rule, today, horizon, fast_forward)` | INVOKER, **not granted to `authenticated`** | Phase G (0036): the one shared occurrence-generation loop for a single rule. Bounded (never past `horizon` or the rule's own `end_date`) and idempotent (`ON CONFLICT DO NOTHING` on `unique(recurring_transaction_id, due_date)`). `fast_forward` restarts from the rule's own `start_date`/anchor and advances past dates before "today" without materializing them; reactivation and schedule rebuild use this so dormant gaps or old schedule history cannot shift the active cadence. Only reachable from within another SECURITY DEFINER function owned by the same role. |
| `materialize_recurring_occurrences(scope, household_id?)` | **DEFINER** | Phase G (0036), the one client-facing generation RPC: loops over every active (not paused, not archived) rule the caller can see in one scope and generates its missing occurrences up to a 90-day horizon. Called once before every recurring-data read — never once per rule from the client. |
| `recurring_transactions_rebuild_occurrences()` | **DEFINER** (trigger on `recurring_transactions`, `AFTER UPDATE OF frequency, interval_count, start_date, end_date`, guarded by a `WHEN` clause so it only fires when a value actually changed) | Phase G (0036): deletes only still-`UPCOMING` rows, then regenerates from the edited rule's own start/anchor fast-forwarded to today — `POSTED` and `SKIPPED` history is never touched or used to shift the new cadence. Runs with elevated privilege so a plain, lower-privileged client `UPDATE` can still trigger this locked-down occurrence write. |
| `recurring_transactions_reactivate_occurrences()` | **DEFINER** (trigger on `recurring_transactions`, `AFTER UPDATE OF paused_at, archived_at`, guarded by a `WHEN` clause matching only a dormant-to-active transition) | Phase G (0036): regenerates occurrences with `fast_forward = true` on Resume/Restore, so waking a rule that was dormant for months doesn't backfill the whole gap as "overdue" — see `docs/FINANCE.md` Phase G "Reactivating a dormant rule". |
| `post_recurring_occurrence(occurrence_id, wallet_id, pocket_id, category_id, amount, title?, note?, occurred_at?, tag_ids?)` | **DEFINER** | Phase G (0036), THE atomic posting operation. Locks the occurrence row `FOR UPDATE`, rejects anything not `UPCOMING`, delegates the actual ledger write to the **existing** `create_income_expense_transaction` (0032) — a nested call still authorizes against the real calling user via `auth.uid()`, unaffected by the SECURITY DEFINER role switch — then marks the occurrence `POSTED` with `posted_transaction_id`/`posted_at`, all inside one implicit transaction. Two concurrent posts on the same occurrence serialize on the row lock; only one ever succeeds. |
| `skip_recurring_occurrence(occurrence_id)` | **DEFINER** | Phase G (0036): locks the occurrence row `FOR UPDATE`, rejects anything not `UPCOMING`, marks it `SKIPPED`. No ledger effect; the `unique(recurring_transaction_id, due_date)` constraint means this exact due date is never regenerated afterward. |
| `set_recurring_transaction_tags(recurring_id, tag_ids[])` | **DEFINER** | Phase G (0036), mirrors `set_template_tags` exactly for Recurring rules' default tags. Zero financial effect on its own — tags are only copied onto the real transaction at posting time (`post_recurring_occurrence`). |

### Transaction write security

`transactions` and `transaction_entries` grant `SELECT` only to
`authenticated` — `INSERT` is revoked from both, and `UPDATE` on
`transactions` is revoked entirely (migration
`0012_lockdown_transaction_writes.sql`) and stays that way even after
Phase B (0031) added edit/void/restore: those go through SECURITY
DEFINER RPCs, not a re-granted table `UPDATE`. The only way to write the
ledger is through the RPCs above. This is deliberate: TypeScript types
and Server Action validation are not a security boundary, since a client
can call PostgREST directly with its own access token, bypassing the
Next.js app entirely. Locking the tables down at the grant level closes
that regardless of what the frontend does or doesn't check.

The `create_*`, `update_income_expense_transaction`, `void_transaction`,
`restore_transaction`, `is_transaction_authorized`,
`create_expense_adjustment_transaction`, and `add_household_member`
functions are all `SECURITY DEFINER`, not `SECURITY INVOKER` like earlier
in Milestone 1 — see `ARCHITECTURE.md §3` for why that flip was necessary
once direct table writes were revoked, and how each function replaces
RLS with an explicit, hand-written authorization check instead.
`expense_adjustments` (0033) is locked down the identical way: no direct
`INSERT`/`UPDATE`/`DELETE` grant to `authenticated` at all — only
`create_expense_adjustment_transaction` writes it, and only `SELECT`
is open.

## Row Level Security summary

Full policies are in `supabase/migrations/0009_rls_money.sql` (wallets,
pockets, categories, transactions, transaction_entries) and
`0002_profiles.sql` / `0004_household_members.sql` (profiles, households,
household_members), as amended by the hardening migrations `0012`–`0018`.
In short:

- `profiles`: a user can select their own row, or a fellow household
  member's; can update only `display_name`/`avatar_url` on their own row
  (column-level grant — `email` is not client-writable at all).
- `households`: selectable by members; updatable by `owner`/`admin`.
- `household_members`: selectable by members of that household.
  Insert/update/delete are revoked from `authenticated` entirely — the
  only way to add a member is `add_household_member()` (see above); there
  is no way to change a role or remove a member yet (Milestone 1 has no UI
  for either, so nothing is left open "just in case").
- `wallets`, `categories`: selectable/writable by any active member for
  `HOUSEHOLD` scope, or the owner for `PERSONAL` scope — see
  `DOMAIN_RULES.md §Security` for why this is intentionally broader than
  the owner/admin gate on household structure itself. Identity/scope
  columns are frozen after creation regardless (see "Key constraints").
  `wallets` also grants `DELETE` as of 0030 (Phase A) — gated by the same
  ownership/membership rule as everything else, and separately rejected
  by trigger unless the wallet is history-free (see `docs/FINANCE.md`).
- `transactions`, `transaction_entries`: `SELECT` only; all writes go
  through the RPCs (see "Transaction write security"), including edit/
  void/restore (0031, Phase B) — there is still no client-facing `UPDATE`
  grant on either table.
- `pockets`: access follows the parent wallet (no separate scope columns);
  every pocket is ordinary — no default-pocket protection exists to list.
  Also grants `DELETE` as of 0030, rejected by trigger unless history-free
  and (while the wallet still exists) not the wallet's last pocket.
- `tags` (0032): same `wallets`/`categories`-style policy — selectable/
  writable by any active member for `HOUSEHOLD` scope, or the owner for
  `PERSONAL` scope. No `DELETE` grant/policy — hard delete is not
  implemented for V1, archive instead.
- `transaction_tags` (0032): `SELECT` only, gated by the same
  authorization as its parent transaction. **No `INSERT`/`UPDATE`/`DELETE`
  grant to `authenticated` at all** — every write goes through
  `set_transaction_tags` (SECURITY DEFINER), the same lockdown pattern as
  `transaction_entries`, because the association still mediates access to
  a financial transaction even though it carries no financial value
  itself.
- `expense_adjustments` (0033): `SELECT` only, gated by the same
  authorization as the adjustment's own transaction row. **No
  `INSERT`/`UPDATE`/`DELETE` grant to `authenticated` at all** — the only
  writer is `create_expense_adjustment_transaction` (SECURITY DEFINER);
  same reasoning as `transaction_tags`.
- `budgets` (0034): same `wallets`/`categories`/`tags`-style policy —
  selectable/writable by any active member for `HOUSEHOLD` scope, or the
  owner for `PERSONAL` scope (day-to-day household finance, including
  budget planning, is a member-level privilege — see
  `DOMAIN_RULES.md §Security`). `INSERT`/`UPDATE` are direct RLS-gated
  table writes (no RPC — see `docs/FINANCE.md` Phase E "CRUD strategy").
  No `DELETE` grant/policy — hard delete is not implemented for V1,
  archive instead.
- `transaction_templates` (0035): same member-level policy as `budgets`/
  `tags`/`categories`. `INSERT`/`UPDATE` are direct RLS-gated table
  writes (no RPC — a Template is single-entity metadata with no
  cross-table atomicity requirement beyond what
  `transaction_templates_validate_references` already covers). No
  `DELETE` grant/policy — archive instead.
- `transaction_template_tags` (0035): `SELECT` only, gated by the same
  authorization as its parent Template. **No `INSERT`/`UPDATE`/`DELETE`
  grant to `authenticated` at all** — every write goes through
  `set_template_tags` (SECURITY DEFINER), the same lockdown pattern as
  `transaction_tags`/`expense_adjustments`, kept consistent even though a
  Template carries no financial stakes of its own.
- `recurring_transactions` (0036): same member-level policy as
  `budgets`/`transaction_templates`. `INSERT`/`UPDATE` are direct
  RLS-gated table writes (no RPC — see `docs/FINANCE.md` Phase G "Editing
  the schedule" for why even the schedule-rebuild/reactivation side
  effects didn't need one). No `DELETE` grant/policy — archive instead.
- `recurring_occurrences` (0036): `SELECT` only, gated by the same
  authorization as its parent rule. **No `INSERT`/`UPDATE`/`DELETE` grant
  to `authenticated` at all** — every write goes through
  `materialize_recurring_occurrences`/`post_recurring_occurrence`/
  `skip_recurring_occurrence` (all SECURITY DEFINER), the strictest
  lockdown in this app: occurrence rows must only ever be produced by the
  deterministic generation algorithm and only ever transition status
  through a vetted RPC.
- `recurring_transaction_tags` (0036): `SELECT` only, gated by the same
  authorization as its parent rule. **No `INSERT`/`UPDATE`/`DELETE` grant
  to `authenticated` at all** — every write goes through
  `set_recurring_transaction_tags` (SECURITY DEFINER), same lockdown
  pattern as `transaction_template_tags`.

## Regenerating TypeScript types

`src/types/database.ts` is hand-written to match these migrations because no
live Supabase project is linked in this environment. Once one exists:

```bash
npx supabase gen types typescript --project-id <project-ref> --schema public > src/types/database.ts
```

and remove the "hand-authored" note at the top of that file.

## Phase H tables and functions

- `bills`: scoped obligation definition; fixed currency; required active
  EXPENSE Category; optional Wallet/Pocket defaults; one-time or recurring
  schedule; pause/archive lifecycle.
- `bill_occurrences`: unique `(bill_id,due_date)` amount snapshots with
  stable OPEN/PAID/SKIPPED state. Direct writes revoked.
- `bill_tags`: protected default-tag join; direct writes revoked.
- `materialize_bill_occurrences`: authorized, idempotent generation through
  Bangkok today + 90 days.
- `pay_bill_occurrence`: row-lock, currency/scope validation, existing
  EXPENSE writer, PAID transition—all one DB transaction.
- `skip_bill_occurrence` and `set_bill_tags`: vetted SECURITY DEFINER writes.

## Phase I tables and functions

- `installment_plans`: scoped fixed total/count/month cadence and payment defaults.
- `installment_occurrences`: numbered exact amount snapshots and OPEN/PAID state.
- `generate_installment_occurrences`: numeric cents distribution; final row absorbs remainder.
- `pay_installment_occurrence`: lock, validate, create ordinary Expense, mark PAID atomically.

## Phase J tables and functions

- `saving_goals`: target metadata linked to one Pocket; partial unique index
  limits one active Goal per Pocket. No stored progress/currency duplicate.
- `get_saving_goal_progress`: RLS-safe batched read deriving raw Pocket
  balance plus presentation values from authoritative ledger functions.

## Phase K tables and functions

- `debt_accounts`: scoped liability/receivable metadata; immutable identity and currency.
- `debt_events`: immutable principal event links to explicit `DEBT_PRINCIPAL` transactions.
- `debt_outstanding` / `get_debt_summary`: exact PostgreSQL numeric derived reads.
- `create_debt_account`, `record_additional_debt_principal`, and
  `record_debt_payment`: authorized, row-locked, atomic cash-linked writers.
- `sync_debt_event_void_state`: keeps compound principal and interest void state aligned.

## Phase L functions

- `get_finance_reports`: one RLS-scoped report query using PostgreSQL numeric,
  `occurred_at`, Bangkok calendar months, and currency grouping.

## Phase M functions

- `get_calendar_finance_items`: composes bounded Recurring, Bill, and
  Installment due dates under source-table RLS; writes no Calendar rows.

## Phase N storage

- `transaction_attachments`: immutable file metadata authorized by transaction.
- `finance-attachments`: private 15 MiB bucket; JPEG/PNG/WebP/PDF only.
- Object paths are `{transactionId}/{attachmentId}.{ext}` and use signed reads.

## Phase O import

- `finance_import_fingerprints`: per-user duplicate keys linked to imported transactions.
- `import_finance_transactions`: atomic, bounded JSON batch using existing Income/Expense writer.

## Phase P export

- `get_finance_export`: RLS-scoped logical rows with date/entity/type/Tag filters.
- Entry values aggregate before Tag joins; multi-tag rows cannot inflate amounts.

## Phase Q functions

- `get_net_worth`: RLS-scoped Wallet assets, receivables, liabilities, and net
  value grouped by currency. No cached totals.

## Phase R functions

- `get_finance_insights`: deterministic, currency-grouped values with source IDs.

## Phase T functions

- `get_finance_hub_final`: batched Net Worth, six-month trend, and three upcoming
  Personal Installments. Reuses Phase L/Q read models under RLS.
