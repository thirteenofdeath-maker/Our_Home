# Finance — Our Home

Dedicated home for Money Tracker domain semantics as the feature set
grows beyond what `DOMAIN_RULES.md` (the Milestone 1 ledger contract)
comfortably holds on its own. `DOMAIN_RULES.md` remains authoritative for
the core ledger (Wallet/Pocket/Category/Transaction/Entries, signed
amounts, balance derivation); this file is additive, organized by the
phase that introduced each concept.

## Phase A — Wallet & Pocket lifecycle

Every Pocket is equal (see `DOMAIN_RULES.md` — there is no Main/default
pocket; removed entirely in `0029_remove_pocket_default.sql`). Phase A
(`0030_wallet_pocket_lifecycle.sql`) adds the full management lifecycle on
top of that flat model.

### Wallet

| Action | Rule |
|---|---|
| Rename / edit type / icon | Always allowed (ownership/membership via RLS, as always). |
| Change currency | Allowed **only** while the wallet has zero `transaction_entries`. The moment it has any history, currency is frozen — reinterpreting historical amounts under a different currency is never safe. Enforced by `wallets_before_update_currency_history_guard`. |
| Archive | Rejected unless the wallet's derived balance (`get_wallet_balance`) is exactly zero. There is no "safe hide a wallet with money in it" strategy in V1, so it is refused outright rather than half-solved. Enforced by `wallets_before_update_archive_zero_balance`. |
| Restore | Always allowed. |
| Hard delete | Rejected if the wallet has **any** transaction history (`transaction_entries` referencing it), regardless of archived state. History-free is the only condition — there is deliberately no "must already be archived" precondition, because that would conflict with `ON DELETE CASCADE` from wallets to pockets (see below). Enforced by `wallets_prevent_delete_if_used`. |

### Pocket

| Action | Rule |
|---|---|
| Rename / edit icon | Always allowed. |
| Archive | Rejected if this is the wallet's **last active** pocket — a wallet must always keep at least one usable pocket. Enforced by `pockets_require_active_sibling_to_archive`. No balance-zero requirement (archiving a pocket never changes the wallet's own total). |
| Restore | Always allowed. |
| Hard delete | Rejected if the pocket has any transaction history, **or** — only while the parent wallet still exists — if it is the wallet's last remaining pocket. That second condition is intentionally skipped when the wallet row is already gone (i.e. this delete is a cascade from deleting the wallet itself): otherwise deleting a wallet's second-to-last pocket mid-cascade would trip "must keep one pocket" against a wallet that is itself being removed, and abort the whole wallet deletion. Enforced by `pockets_prevent_delete_if_used`. |

### "A wallet always has at least one pocket" — how it actually holds

Not a CHECK constraint (a wallet cannot be created and given a pocket in
two separate statements without a race), and not a "fragile circular
trigger" (explicitly avoided per the product brief). Instead, three
simpler facts compose into the same guarantee:

1. `create_wallet_with_first_pocket` (0029) creates a wallet and its
   first pocket **atomically** — a wallet is never observable with zero
   pockets.
2. `pockets_require_active_sibling_to_archive` (above) refuses to archive
   the last active one.
3. `pockets_prevent_delete_if_used` (above) refuses to hard-delete the
   last one, except as part of deleting the whole wallet.

### Currency immutability vs. the earlier "fully immutable" design

Milestone 1's original hardening pass made `wallets.currency` fully
immutable unconditionally. Phase A **loosens** that — but only for
wallets with no history yet, which is exactly the case the original
concern (reinterpreting historical amounts) never applied to.
`0030_wallet_pocket_lifecycle.sql` re-creates
`wallets_prevent_identity_changes` without `currency` in its column list
and adds the new history-aware guard in its place; `scope`,
`owner_user_id`, `household_id`, and `created_by` remain unconditionally
frozen exactly as before.

## Phase B — Transaction management (edit / void / restore)

`0031_transaction_management.sql`. Scope: **INCOME and EXPENSE only**.
Pocket Transfer and Wallet Transfer stay fully immutable in this phase —
every RPC below explicitly rejects `transaction_type = 'TRANSFER'`.

### The void architecture already existed

Before writing any of this, the audit found that `transactions.deleted_at`
has been the void marker since `0008_transactions.sql` ("Set instead of
DELETE so financial history and audit trails survive corrections"), and
`get_pocket_balance`, `get_wallet_balance` (`0010`), and
`get_finance_hub_summary` (`0028`) already exclude any transaction with
`deleted_at is not null` from every balance and summary calculation.
Phase B does not touch any of those three functions — voiding a
transaction already has zero financial effect the moment `deleted_at` is
set. Phase B adds:

1. Two new columns, `voided_by` and `void_reason`, for audit context that
   didn't exist yet.
2. Three SECURITY DEFINER RPCs (`0012`'s pattern) that are the only way to
   actually set/clear `deleted_at` and correct a transaction's fields,
   since `0012_lockdown_transaction_writes.sql` revoked direct `UPDATE` on
   `transactions` entirely — there was nothing to grant it back to.

This is an **exclusion-based** void model (the spec's preferred choice),
not reversal entries: the original `transaction_entries` rows are never
touched by void or restore, only by edit (see below).

### Edit — `update_income_expense_transaction`

| Field | Editable? |
|---|---|
| amount, occurred_at, title, note | Yes |
| Pocket | Yes — but only to another pocket of the **same** wallet |
| Category | Yes — only re-validated (active + type-matching) when it actually **changes**; an unrelated edit never forces a historical, possibly-archived category off the transaction |
| Wallet | No — not a parameter at all |
| Transaction type (INCOME/EXPENSE) | No — not a parameter at all |

The wallet is derived from the transaction's existing single ledger entry
(`transaction_entries` has exactly one row for INCOME/EXPENSE) and is
never itself written — moving a transaction between wallets has broader
currency/account semantics and is explicitly out of scope; void + a fresh
transaction in the other wallet is the correction path for that case.
Editing rebuilds the entry in place (`pocket_id`, `amount`) with a plain
`UPDATE`, not a delete-and-reinsert — Postgres `numeric`, never JS
arithmetic. Rejected outright if the transaction is currently voided
(restore first).

### Void — `void_transaction(p_transaction_id, p_void_reason?)`

Sets `deleted_at = now()`, `voided_by = auth.uid()`, `void_reason`.
Rejects `TRANSFER`. Rejects a transaction that is already voided — voiding
twice raises an explicit error rather than silently succeeding. Ledger
entries are untouched; balances/summaries already exclude it.

### Restore — `restore_transaction(p_transaction_id)`

Clears `deleted_at`/`voided_by`/`void_reason`, reactivating the exact
original financial effect (the same untouched entries start counting
again). Before doing so it walks every `transaction_entries` row the
transaction has and requires each one's wallet **and** pocket to still
exist and not be archived — if either is archived, restore is rejected
with a clear error rather than silently rewriting the transaction onto a
different pocket. Rejects restoring a transaction that isn't voided
(restoring twice raises, it doesn't no-op).

### Permissions

Mirrors `is_wallet_authorized` (0012): PERSONAL owner, or **any** active
member of the transaction's household — not creator-only. This follows
directly from the existing rule in `DOMAIN_RULES.md` "Security" that
day-to-day household money management (create/rename/archive
wallets/pockets/categories, create transactions) is already a
member-level privilege, not owner/admin-gated; edit/void/restore extend
the same rule rather than inventing a stricter one. Enforced by
`is_transaction_authorized`, a new SECURITY DEFINER helper.

### Search (`/finance/transactions`)

`searchTransactions` (features/transactions/api.ts) filters entirely at
the query layer — date range, type (including splitting `TRANSFER` into
POCKET_TRANSFER vs WALLET_TRANSFER by comparing the two entries' wallet
ids after the DB query, the same way the existing wallet-history grouping
already does), wallet, pocket, category, status (ACTIVE / VOIDED / ALL),
and free text on title/note via `.or()` on the embedded `transactions`
resource. A pocket/wallet transfer's two ledger entries still collapse
into one logical search result row, same guarantee as wallet-scoped
history. Unlike wallet-scoped history and the Finance Hub's recent list
(both still active-only by design, unchanged in this phase), search is
the one place voided transactions are browsable — that's the point of the
status filter.

## Phase C — Transaction Tags

`0032_transaction_tags.sql`. A Tag is a reusable, cross-cutting label
(`#เชียงใหม่`, `#แฟน`) — **not** a Category. Category is accounting
classification (what a transaction was *for*, drives Finance Hub category
totals); Tag is organizational metadata with no accounting meaning at
all. A transaction always has exactly one Category (INCOME/EXPENSE) or
none (TRANSFER); it can carry any number of Tags, of any mix, and every
transaction type — INCOME, EXPENSE, Pocket Transfer, Wallet Transfer —
can be tagged. Tag mutation **never** touches `transaction_entries` and
has zero effect on any balance, summary, or report.

### Data model

`tags` (top-level, scoped like `categories`/`wallets`: PERSONAL →
`owner_user_id`, HOUSEHOLD → `household_id`) and `transaction_tags`
(pure join table, `primary key (transaction_id, tag_id)`).

### Duplicate normalization

`tags.normalized_name` is a DB-**generated** column
(`lower(btrim(name))`), not application-computed — a client forgetting to
normalize can never create a duplicate. Two partial unique indexes
(`(owner_user_id, normalized_name) where scope = 'PERSONAL'` and
`(household_id, normalized_name) where scope = 'HOUSEHOLD'`) make
`"Trip"`, `" trip "`, and `"TRIP"` collide within one scope, while a
PERSONAL `"Trip"` and a HOUSEHOLD `"Trip"` (or a *different* household's
`"Trip"`) remain distinct — scopes never share the uniqueness check.
Uniqueness applies to archived tags too: recreating an archived tag's
exact name would be confusing (restore it instead of creating a
lookalike).

### Tag lifecycle: direct table writes, not RPCs

Create/rename/archive/restore go through plain RLS-gated `INSERT`/`UPDATE`
on `tags` — the same pattern as `categories` (and Phase A's
wallet/pocket lifecycle), not dedicated RPC functions. This was a
deliberate choice: each of these is a simple single-row mutation with no
cross-table atomicity requirement, so a bespoke RPC would only duplicate
what RLS + the uniqueness index already guarantee. Hard delete is not
implemented for V1 (archive instead) — no DELETE grant/policy exists on
`tags` at all yet.

### Attaching tags is the one genuine RPC

The transaction<->tag *association* is different: it mediates access to
a financial transaction, must validate every tag atomically (all-or-
nothing — a request with one invalid tag id changes nothing), and the
join table itself has **no direct INSERT/DELETE grant** to
`authenticated` at all (mirrors the `transaction_entries` lockdown, 0012)
— only `SELECT` is open. All writes go through:

- **`set_transaction_tags(p_transaction_id, p_tag_ids)`** — the
  client-facing RPC. Follows Phase B's exact authorization rule
  (`is_transaction_authorized`: PERSONAL owner or any HOUSEHOLD member,
  not creator-only). Replaces the transaction's full tag set.
- **`assign_transaction_tags(...)`** — an internal helper, not granted to
  `authenticated` at all (only reachable from inside another
  SECURITY DEFINER function owned by the same role). Validates every tag
  — must exist, must not be archived, must be the *same*
  scope/owner/household as the transaction — before deleting the old set
  and inserting the new one. Any failure raises, aborting the whole
  call's transaction; there is no partial-apply outcome.

### Create flow: tags are atomic with the transaction, not a second write

`create_income_expense_transaction`, `create_pocket_transfer`, and
`create_wallet_transfer` (all redefined in 0032 — DROP + CREATE, not
`CREATE OR REPLACE`, since the argument list changes) each gained an
optional trailing `p_tag_ids` parameter. When supplied, they call
`assign_transaction_tags` internally, in the same function call — so a
create that raises on an invalid tag never leaves behind a transaction
that silently lost its requested tags. This was chosen over "create the
transaction, then attach tags in a second round trip" specifically
because that second shape has no way to guarantee the two operations
succeed or fail together from the client.

### Edit flow: same atomicity, extended into 0031's RPC

`update_income_expense_transaction` (also redefined in 0032) gained the
same optional `p_tag_ids`. `NULL` means "leave tags unchanged"; an empty
array `{}` means "clear every tag" — the edit form always sends its full
current tag selection (never omits the field), so in practice every
save from the UI is an explicit replace, but the RPC still supports a
future non-UI caller that only touches financial fields. One RPC call,
one transaction: never a state where the financial edit succeeds and a
separate tag mutation fails, or vice versa.

### Void / restore: tags are untouched

Voiding sets `transactions.deleted_at`; it does not delete or otherwise
touch `transaction_tags` rows, because tags are not financial state and a
transaction row is never deleted (only voided) in the first place — there
is nothing to cascade. A voided transaction keeps every tag it had, and
restoring it changes nothing about them either. Tag search's `VOIDED`
status filter can still find a voided, tagged transaction.

### Archived tags

Same principle as an archived historical Category (`DOMAIN_RULES.md`):
an archived tag remains visible on every transaction that already carries
it, remains findable via the tag search filter, but cannot be **newly**
attached to anything (`assign_transaction_tags` rejects it). Editing a
transaction's unrelated fields (amount, date, ...) without touching its
tag set never forces an already-archived tag off — same "only validated
when it actually changes" principle Phase B already established for
Category.

### History search: tag filter

`/finance/transactions` gained a single-tag filter (V1 — the product
brief explicitly allows single-tag as sufficient; multi-tag ANY/ALL
semantics are deferred). Implemented as a bounded pre-query: one lookup
of `transaction_tags` for the matching `transaction_id`s, then
`.in("transaction_id", ids)` narrows the existing entries query — not a
per-row filter, and not client-side filtering. Both of a tagged
transfer's ledger entries share `transaction_id`, so the existing
group-by-transaction-id step still collapses it to one logical result
row.

### Performance

`transaction_tags` has indexes on both `transaction_id` and `tag_id` (the
two directions it's ever queried from). Tag lookups for a list of
transactions (transaction detail, edit form, and anywhere a list of
transactions might want to show tags) go through
`listTagsForTransactions` — one batched `IN (...)` query per call site,
never one query per transaction.

## Phase D — Refunds + Reimbursements

`0033_refunds_reimbursements.sql`. **Refund is not Income. Reimbursement
is not ordinary Income.** Both create positive cash movement and reduce
net Expense reporting; neither is ever summed into the Income figure.

### Representation: no new transaction_type value

The audit before implementing this phase found that `get_wallet_balance`/
`get_pocket_balance` (0010) already sum every `transaction_entries` row
with **no type filter at all**, and `get_finance_hub_summary`'s (0028)
monthly/category CTEs already compute
`sum(-amount) filter (where transaction_type = 'EXPENSE')` grouped by
`category_id`. A refund/reimbursement stored as an ordinary
`transaction_type = 'EXPENSE'` row with a **positive** ledger entry and
the **original expense's own `category_id`** therefore already nets
correctly through every one of those existing queries, with zero changes
to either function:

```
Expense   -1500  (type=EXPENSE)
Refund     +500  (type=EXPENSE, positive)
─────────────────────────────────────────
sum(-amount) filter(EXPENSE) = -(-1500 + 500) = 1000  ✓ matches the spec exactly
Income total: untouched — refunds are never type='INCOME'
```

This is the same pattern already used for Pocket Transfer vs Wallet
Transfer: one underlying DB type (`'TRANSFER'`), split into UI-level
sub-kinds by a small amount of structure alongside it rather than a new
enum value. Here that structure is `expense_adjustments`
(`transaction_id` primary key, `original_expense_transaction_id`,
`adjustment_kind` — `'REFUND' | 'REIMBURSEMENT'`), a metadata/link table,
not a new column on `transactions` itself.

A deliberately **avoided** alternative: extending the `transaction_type`
enum with `ALTER TYPE ... ADD VALUE`. A brand-new enum value cannot
safely be used in the same transaction that adds it in every Postgres
version, and this migration (like every other one in this repo) cannot
be verified against a live database in this environment — reusing the
existing `'EXPENSE'` value sidesteps that risk entirely, on top of being
less code.

### Refund vs Reimbursement

Same mechanism, different real-world meaning — kept semantically
distinct everywhere client-visible (UI labels, `adjustment_kind` column,
type filter, `get_expense_refundable_summary`'s separate
`active_refund_total` / `active_reimbursement_total`) even though the
DB-level write path (`create_expense_adjustment_transaction`) and the
cap they share are identical:

| | คืนเงิน (Refund) | เบิกคืน (Reimbursement) |
|---|---|---|
| Meaning | Merchant/provider returns money for a reversed/returned purchase | A person/company/org covers an expense already paid |
| Ledger effect | Positive entry, same as reimbursement | Positive entry, same as refund |
| Counts as Income? | No | No |

### Category attribution

The adjustment's own `category_id` is **copied** from the original
expense at creation time — never client-supplied, never re-derived at
report time. This is what makes the existing `category_entries` CTE in
`get_finance_hub_summary` attribute a refund/reimbursement to the right
category with no query changes. An already-archived original category is
copied exactly like a plain edit would keep it (Phase B's
"archived-category-history" rule applies unchanged).

### Destination wallet/pocket — same scope, not necessarily the same wallet

The user picks where the money lands; it need not be the original
expense's own wallet or pocket, but it MUST share the original's exact
`scope`/`owner_user_id`/`household_id` (no scope laundering — Personal →
Household, or Household A → Household B, are both rejected regardless of
who's asking) and the destination wallet's `currency` MUST equal the
original expense's wallet currency exactly (no FX conversion, even if the
destination wallet's own natural currency differs — that wallet is simply
not a valid destination for this refund).

### Combined cap + concurrency

`active_refund_total + active_reimbursement_total` linked against one
original expense can never exceed that expense's current amount — refund
and reimbursement draw from the **same** cap, tracked together. Race
safety comes from a single row lock: `create_expense_adjustment_transaction`,
`update_income_expense_transaction` (editing the original's amount),
`void_transaction` (voiding the original), and `restore_transaction`
(restoring an adjustment) all do `select ... for update` on the
**original expense's own row** before computing or relying on the active
total, via the shared `get_expense_adjustment_total()` helper. Two
concurrent create-adjustment calls against the same original genuinely
serialize — the second cannot compute its "current active total" until
the first has committed (or rolled back), so two requests that would each
individually fit under the cap but together exceed it can never both
succeed.

### Void / Restore

Void and restore are the *same* Phase B RPCs (`void_transaction`,
`restore_transaction`), extended, not forked — because a refund is
already just a `transaction_type = 'EXPENSE'` row underneath. What's new:

- **Voiding the original expense is rejected** while it has any active
  (non-voided) linked adjustment — `ยกเลิกรายการนี้ไม่ได้ เนื่องจากมีรายการคืนเงิน/เบิกคืนที่ยังใช้งานอยู่`.
  Void the refund(s)/reimbursement(s) first.
- **Voiding a refund/reimbursement itself** is unrestricted (standard
  Phase B void) — it drops out of `get_expense_adjustment_total`
  immediately, so the original's "remaining refundable" figure updates
  with no other code involved.
- **Restoring a refund/reimbursement** additionally requires its original
  expense to still be active, and re-checks the combined cap
  (`active_total_excluding_self + this_amount <= original_amount`) —
  race-safe the same way, by locking the original's row first. Since the
  transaction being restored is by definition still voided at the moment
  of the check, `get_expense_adjustment_total` already excludes it from
  "active_total" with no separate "exclude self" step.
- Tag associations are untouched by either — same reasoning as Phase C
  (tags are not financial state, and the transaction row is never
  deleted, only voided).

### Original expense: edit restrictions

Editing an expense's **amount** downward is rejected once it would fall
below the current active adjustment total (`1500 → 1000` ✓, `1500 → 700`
✗ once 800 is already refunded/reimbursed). Editing title, note,
occurred_at, Pocket (within the same wallet), or Category never requires
touching this floor and is unaffected. Wallet and currency stay immutable
under the existing Phase B rule.

### Refund/reimbursement editing: immutable in V1

A refund/reimbursement cannot be edited via `update_income_expense_transaction`
at all once posted — that RPC rejects it outright if the transaction id
appears in `expense_adjustments`. The only permitted corrections are void
+ restore, or void + create a new corrected adjustment. This is a
deliberate V1 simplification: it keeps the refund-cap invariant's
reasoning to "sum of currently-active adjustment amounts," with no need
to also reason about "what if someone changes an adjustment's own amount
after the fact" — and it keeps a full audit trail (the wrong one stays
visible, voided, rather than being silently rewritten).

### Reporting: cash-basis, not retroactive

A refund/reimbursement's `occurred_at` (not the original expense's)
determines which month's report it affects — this repo's ledger has
always been cash-basis (Milestone 1), and Phase D does not introduce
accrual semantics. An August expense refunded in September leaves
August's own total exactly as it was; September's total moves by the
refund amount instead. This can legitimately make a month's (or a
category's) net Expense **negative** if a big enough refund lands with
little or no ordinary expense alongside it that period — this is correct
cash-basis behavior, not a bug, and is intentionally never clamped to
zero anywhere in `get_finance_hub_summary`.

### Read model

`get_expense_refundable_summary(transaction_id)` returns
`original_amount`, `active_refund_total`, `active_reimbursement_total`,
and `remaining_adjustable_amount`, every figure a decimal string — the
same figures the create RPC itself enforces, never client-subtracted.
Backs the Expense detail page's "คืน/เบิกคืนรวม ฿500 / เหลือคืนได้
฿1,000" and the create form's live cap display.

### History / search

A refund/reimbursement history row carries an optional `adjustment` field
(`{ kind, originalTitle }`, via a batched `listAdjustmentInfoForTransactions`
lookup — never one query per row) so it renders "คืนเงิน · <original
title>" instead of a generic "รายจ่าย" label, and is never colored/labeled
as income even though its amount is positive. The type filter gained
`REFUND`/`REIMBURSEMENT` alongside the existing options; selecting plain
`EXPENSE` now excludes refund/reimbursement rows (they have their own
options), mirroring how neither TRANSFER sub-kind shows under a bare
"TRANSFER" option either.

## Phase E — Budgets

`0034_budgets.sql`. **Budget != Pocket.** A Pocket is where money is
allocated/stored inside a Wallet — it is real, it holds a derived
balance, and every ledger entry belongs to exactly one. A Budget is pure
planning metadata: how much the user *intends* to spend in one EXPENSE
category, one currency, one calendar month. A Budget never moves money,
never reserves ledger money, never creates a `transaction_entries` row,
and never alters any Wallet/Pocket balance. **Budget != Saving Goal**
either (a later phase) — a Budget is a spending *ceiling* for a period
that resets every month; a Saving Goal is an accumulating *target* with
no period boundary. V1 ships **monthly category budgets** only.

### What a Budget stores vs. what is derived

`budgets` stores exactly: `scope`/`owner_user_id`/`household_id`,
`category_id`, `currency`, `period_month` (canonical first-of-month, e.g.
`2026-09-01`), `amount`, `archived_at`. It does **not** store spent,
remaining, or percentage — those are always computed live from the
ledger by `get_budget_summary`, the same "no cached/stored consumption"
contract every balance in this app already follows.

### Exact-category semantics (V1)

A Budget on a parent category counts only transactions whose
`category_id` is **exactly** that parent — a child category's spending
is never rolled up into it, and vice versa. This is deliberate: silently
summing a parent budget's spend across its children (or a child budget
picking up spend logged directly against the parent) would double-count
the moment both levels have their own budget, with no way for the UI to
warn about it. A future phase can add explicit subtree/roll-up budgets;
V1 does not guess at that behavior.

### Category rules

A Budget's `category_id` must be an **EXPENSE** category (INCOME
rejected at the DB level, `budgets_validate_category`) in the exact same
scope/owner/household as the Budget itself — no scope laundering
(Personal category → Household budget, or Household A → Household B, are
both rejected the same way Phase D rejects them for refunds). An already
**archived** category cannot be targeted by a **new** Budget, but an
**existing** Budget's category becoming archived later changes nothing —
the Budget stays fully readable and its spend stays fully calculable
(same "archived-category-history" principle as Phase B/D). This
INSERT-only validation is why `budgets_validate_category` fires on
`BEFORE INSERT` and deliberately not on `UPDATE`.

### Currency

Every Budget has exactly one currency, and it is never inferred — the
creator picks it explicitly (same as a Wallet). "อาหาร / Sep / THB" and
"อาหาร / Sep / USD" are two entirely distinct Budget rows if the same
category ever receives spending in both currencies (e.g. a household with
wallets in more than one currency); `get_budget_summary` only sums
`transaction_entries` from wallets whose `currency` matches the Budget's
own — never aggregated, never converted (no FX, same as every other
currency rule in this app).

### Uniqueness and identity

One row represents one month's plan for one
scope+category+currency+period — enforced by two partial unique indexes
(`... where scope = 'PERSONAL' and archived_at is null` /
`... where scope = 'HOUSEHOLD' and archived_at is null`). `amount` and
`archived_at` are the only mutable columns
(`budgets_prevent_identity_changes` freezes everything else, including
`category_id`/`currency`/`period_month`) — V1's simplification is that
changing *what* a Budget targets means archiving it and creating another,
never rewriting an existing row's identity. Restoring an archived Budget
into an identity a newer active row already occupies hits the same
unique index and is rejected, not silently merged.

### Spending calculation — nets Phase D automatically

`get_budget_summary`'s `net_spent` is `sum(-amount) filter (where
transaction_type = 'EXPENSE')` for the exact `category_id`, within the
month's Bangkok-anchored `[start, end)` bounds, excluding voided
transactions — the *exact same shape* as `get_finance_hub_summary`'s
(0028) own category CTE. Because Phase D refunds/reimbursements are
themselves stored as `transaction_type = 'EXPENSE'` rows with a
**positive** entry and the original expense's own `category_id` (see
"Phase D" above), they net into this sum with **zero special-case code**:
an ordinary expense adds to spend, a refund/reimbursement against that
same category subtracts from it, automatically, because they're the same
signed sum. `SUM(ABS(amount))` (or any logic that discards the sign)
would be a critical accounting bug here — it would make a refund look
like *additional* spending instead of a correction.

### Cash-basis, and legitimately negative net_spent

Same cash-basis contract as Phase D: a Budget's `net_spent` is attributed
to whichever month the *transaction's own* `occurred_at` falls in, never
retroactively rewriting an earlier month. An August expense refunded in
September leaves August's Budget consumption exactly as it was; September's
own Budget (for the same category) absorbs the refund instead — and if that
refund is larger than whatever else was spent in that category that month,
**`net_spent` goes negative**. This is correct, intentional cash-basis
behavior and is never clamped to zero, hidden, or otherwise "corrected" —
neither in the SQL nor in the UI's authoritative values. The **progress
bar's fill percentage** is the one place a clamp exists (`[0, 100]`, in
`budgetProgressPercent`), because a negative or >100% bar has no sensible
visual rendering — but the percentage TEXT, `net_spent`, and `remaining`
shown alongside it are always the real, unclamped figures.

### Derived UI states

`remaining = budget_amount - net_spent`, computed in SQL
(`get_budget_summary`) and never re-derived from a JS float client-side.
`UNDER` (< 80%), `NEAR_LIMIT` (80–99.99%), `OVER` (>= 100%) are pure
functions of the two decimal strings (`budgetStatus`,
`features/budgets/types.ts`) — UI-only classifications, never stored,
never part of the financial DB truth.

### CRUD strategy

Direct RLS-gated table writes for create/rename-by-recreation/edit-
amount/archive/restore — the same "simple single-row metadata, no
cross-table atomicity needed" reasoning already applied to Category and
Tag, not a bespoke RPC. The one piece of real business logic
(category/scope validation at creation) lives in the `BEFORE INSERT`
trigger, exactly mirroring `categories_validate_hierarchy`. Hard delete
is not implemented in V1 — archive/restore covers correction, and it
keeps a full history of what was ever planned.

### Read model — no N+1

`get_budget_summary(period_month, month_start, month_end)` returns every
Budget (active and archived) for one exact month in **one** query — the
spending JOIN/GROUP BY inside it computes every Budget's `net_spent` in
that same query, never one spending lookup per Budget. `month_start`/
`month_end` are pre-computed Bangkok-anchored bounds from the existing
`financeMonthRange()` (same contract `get_finance_hub_summary` already
uses) — passed in by the app rather than re-derived inside SQL, so there
is exactly one implementation of "what counts as this month in Bangkok"
in the whole codebase, not two that could drift apart.

### Finance Hub / Transaction detail

`/finance` shows a compact "งบประมาณเดือนนี้" section (top 3 active
Budgets with a mini progress bar each, linking to `/finance/budgets`) —
deliberately not a full management surface. Budget is **not** a
transaction type and never appears in transaction search/history; it is
planning metadata layered on top of the ledger, not part of it.

### Deferred (not built in Phase E)

"คัดลอกงบจากเดือนก่อน" (copy last month's Budget definitions into the
current month) was explicitly optional in the product brief, with
instructions to defer it if it would materially expand the phase. It is
deferred — flagged as backlog, not implemented — since the rest of Phase
E already covers the required CRUD/read-model/reporting surface in full.

## Phase F — Transaction Templates

`0035_transaction_templates.sql`. **A Template is not a transaction.** It
stores reusable defaults for creating a *future* transaction — nothing
else. Creating, editing, archiving, or restoring a Template produces
**zero** ledger effect: no `transactions` row, no `transaction_entries`
row, no Wallet/Pocket balance change, no Budget spend change, no Finance
Hub total change. The real transaction is created only when a user opens
the Template, reviews/edits the prefilled form, and presses Save — at
which point the **existing** `create_income_expense_transaction` RPC
(0012, extended by 0032 for tags) runs exactly as it would for a
manually-typed entry. V1 supports INCOME/EXPENSE templates only — no
Pocket/Wallet Transfer, Refund, Reimbursement, Bill, or Installment
templates.

### What reuses existing architecture vs. what is new

Nothing about how a transaction gets WRITTEN changes in this phase.
Reused unchanged: `create_income_expense_transaction`, the
`createIncomeExpenseAction` Server Action, Category/Wallet/Pocket
validation, Tag atomic attachment, Budget's live derivation, Refund/
Reimbursement's own rules, and `returnTo` handling. What's new is
strictly upstream of that writer: a `transaction_templates` table (the
saved defaults) + a `transaction_template_tags` join table, and a small
amount of prefill plumbing in `TransactionForm` (new optional
`default*`/`staleNotices` props) and the `/wallets/[walletId]/
transactions/new` page (loads and validates a `?templateId=`).

### Template model

`transaction_templates`: `scope`/`owner_user_id`/`household_id` (same
pattern as every other Money entity), `transaction_type` (INCOME or
EXPENSE only — frozen after creation, `transaction_templates_type_chk`),
a required `name`, and five **entirely optional** defaults: `wallet_id`,
`pocket_id`, `category_id`, `amount`, `title`, `note`. `occurred_at` is
never stored on a Template at all — see "Date behavior" below.
Uniqueness: a normalized name is unique per scope among ACTIVE templates
only (cheap, useful, not overcomplicated — same partial-unique-index
shape as Tags).

### Scope model — no laundering

A Template belongs to exactly one scope, and every reference it stores
(Wallet, Pocket, Category, Tags) must share that exact scope/owner/
household — enforced by `transaction_templates_validate_references`
(a `BEFORE INSERT OR UPDATE OF wallet_id, pocket_id, category_id, ...`
trigger). Personal → Household, Household A → Household B, and
INCOME-category-on-an-EXPENSE-template are all rejected the same way
every other Money entity in this app rejects them.

### Stored defaults, and what happens when they go stale

Every one of the five optional defaults may go stale over time
(referenced Wallet/Pocket archived, Category archived, a saved Tag
archived) — a Template is explicitly allowed to keep pointing at a stale
reference and remains **fully readable/editable** regardless (same
"archived-history" principle already established for Category/Budget).
What differs is *assignment* vs. *staleness*:

- **Newly assigning** an archived or scope-incompatible Wallet/Pocket/
  Category to a Template (at create OR edit time) is rejected outright
  by the same validation trigger — a Template is never saved pointing at
  something already known to be unusable.
- **Becoming archived later** (after the Template already points at it)
  is never retroactively enforced — the trigger only fires when
  `wallet_id`/`pocket_id`/`category_id` (or an identity column) is part
  of the actual write, so an amount/title/note-only edit never disturbs
  an already-saved, now-stale reference.
- **At USE time**, a stale reference is never silently substituted or
  dropped. The create-transaction page surfaces a clear notice (e.g.
  "Pocket ที่บันทึกไว้ถูก Archive แล้ว กรุณาเลือก Pocket ใหม่ก่อนบันทึก")
  and simply leaves that field unprefilled, requiring the user to pick
  an active replacement before Save — never a silent redirect to some
  other Pocket the user didn't choose.
- A stale **Wallet** default is handled one level up, before the
  transaction form even loads — see "Use Template" below.

### Tag handling

Reuses Phase C Tags exactly, but through its own association RPC,
`set_template_tags` — not `set_transaction_tags`, since a Template isn't
a transaction. One function is enough here (unlike Phase C's
`assign_transaction_tags` / `set_transaction_tags` split): a Template has
no equivalent of "created atomically from inside three different
create_* RPCs" to share validation logic with, so
`set_template_tags` folds authorization + validation + replace into one
SECURITY DEFINER function. Deliberately a **lower atomicity bar** than
Phase C's transactions: Template creation is a plain `INSERT`, and tags
are attached in a separate step immediately after — if that second step
fails, the Template still exists, just without its tags. This is
acceptable because a Template carries **zero accounting stakes**; a
create-succeeded-but-tags-failed gap here is a minor UX rough edge (reopen
the Template, fix its tags) never a correctness bug, unlike the same gap
would be for a real transaction. An archived tag can never be **newly**
attached to a Template (same rule as transactions); at USE time, only the
Template's currently-**active** tags are copied into the new
transaction's prefill — an archived saved tag is shown on the Template
itself (struck through, for context) but is never attached to the actual
transaction that gets created.

### "Use Template" — routes into the existing form, never a second writer

Preferred flow: `/finance/templates/[templateId]` → **[ใช้ Template]** →
`/wallets/[walletId]/transactions/new?type=<TYPE>&templateId=<id>` (the
**existing** create route) → user reviews/edits → Save → the existing
writer runs. `templateId` is the only thing that travels through the
URL; the server loads and re-validates the Template itself (type match,
scope match against the destination Wallet, archived state) rather than
trusting any prefill values encoded in the query string.

If the Template's saved Wallet is missing or archived, there is nothing
to route directly to — `/finance/templates/[templateId]/use` is an
intermediate page that lists the Template's other **active**, scope-
matching Wallets and lets the user pick one before landing on the same
existing create route. This is the one small new page in this phase;
`TransactionForm` itself gained no new Wallet-picking capability, keeping
Phase B's "Wallet is fixed by route" contract intact.

### Date behavior

A Template never stores `occurred_at`. `TransactionForm`'s date field
already always defaults to **today** (Asia/Bangkok) regardless of
Template presence — Phase F changes nothing here; a Template created in
September and used in October defaults to October, never September,
simply because the date field was never wired to read from the Template
in the first place.

### Quick save from an existing transaction

The Income/Expense detail page gained **[สร้าง Template จากรายการนี้]**,
which opens `/finance/templates/new?fromTransactionId=<id>` pre-filled
from that transaction's allowed defaults only —
type/wallet/pocket/category/amount/title/note/**active** tags. Never
copied: `occurred_at`, `created_at`, void state, or any Refund/
Reimbursement relationship — none of those are Template concepts, and
copying them would either be meaningless (a Template has no "when") or
actively misleading (a Template is never itself a Refund/Reimbursement,
even if the SOURCE transaction happened to be one — copying its
category/amount as a plain Expense default is fine; copying "this was a
refund" is not, since Templates don't support that type in V1).

### Performance

Both the list (`/finance/templates`) and detail views fetch a Template's
tags through one batched query (`transaction_template_tags` joined to
`tags`, keyed by however many template ids are in play) — never one tag
lookup per Template, same discipline as every other batched read model in
this app (`listTagsForTransactions`, `get_budget_summary`).

## Phase G — Recurring Transactions

`0036_recurring_transactions.sql`. **A Recurring rule is not a
transaction, and neither is an occurrence generated from it.** Creating,
editing, pausing, resuming, archiving, or restoring a rule produces
**zero** ledger effect. Generating an occurrence (a specific due date)
produces zero ledger effect either — V1 is **SAFE CONFIRM-BEFORE-POST**:
```
Recurring Rule -> Upcoming/Due Occurrence -> user opens it -> reviews/edits -> [บันทึกรายการ] -> existing Income/Expense writer -> real transaction + ledger
```
There is no scheduled/cron posting in V1 — an occurrence never becomes a
transaction on its own. V1 supports INCOME/EXPENSE recurrences only — no
Transfer/Refund/Reimbursement recurrences, and Bills/Installments are a
separate, later phase (not built here; do not conflate the two — a
Recurring rule is used **manually**, on demand, while a Bill is a
different, not-yet-built concept).

### Audit: nothing pre-existing to reuse for scheduling

No `recurring`/`recurrence`/`schedule`/`cron`/`RRULE`/"due occurrence"
code exists anywhere in this repository prior to this migration —
Calendar's own foundation migration (0027) explicitly says "no
recurrence" in its header comment. This phase introduces the whole
concept from scratch, reusing only what already existed for *transaction
writing* (Phase B's `create_income_expense_transaction`) and *dates*
(the Bangkok-anchored `Date.UTC` arithmetic pattern already used by
Calendar's `monthDays`/`shiftMonth` and Finance's `financeMonthRange`).

### What reuses existing architecture vs. what is new

Nothing about how a transaction gets WRITTEN changes in this phase, same
as Phase F. Reused unchanged: `create_income_expense_transaction`,
Category/Wallet/Pocket validation, Tag attachment shape, Budget's live
derivation, and void/restore. What's new: a `recurring_transactions`
table (the schedule + defaults), a `recurring_occurrences` table (one row
per generated due date, entirely separate from `transactions`), a
`recurring_transaction_tags` join table, a handful of small RPCs for
occurrence generation/posting/skipping, and the reuse of
`TransactionForm`'s existing `default*`/`staleNotices` prefill props
(extended with one new `postOccurrence` prop) — no second
transaction-writing implementation.

### Rule model

`recurring_transactions`: `scope`/`owner_user_id`/`household_id`/
`transaction_type` (INCOME or EXPENSE only, frozen after creation) follow
the same shape as every other Money entity. `wallet_id`/`pocket_id`/
`category_id` are **optional** — a generic rule ("ค่าน้ำ", no fixed
Wallet) can exist, with the user choosing which Wallet actually paid it
at posting time (see "Optional references" below). Unlike a Template,
**`amount` is mandatory and must be `> 0`** — a Recurring rule exists
specifically to say "this much money is expected on this schedule," which
the Finance Hub's upcoming list needs a concrete figure for.

Schedule columns: `frequency` (`WEEKLY` | `MONTHLY` | `YEARLY` — no
arbitrary RRULE complexity, no `DAILY` in V1), `interval_count` (`>= 1`),
`start_date`, `end_date` (optional), and a generated `anchor_day`
(`extract(day from start_date)`, recomputed automatically whenever
`start_date` changes — see "Month-end anchoring" below).

### Optional references

`wallet_id`/`pocket_id`/`category_id` may all be null on the rule itself.
Example: "ค่าน้ำ", amount 500, Category = Utilities, no Wallet. Every due
occurrence for that rule then requires the user to pick which Wallet
actually paid it, right there on the posting form — this is useful
(bills that get paid from different accounts month to month) and is why
`TransactionForm`'s "Wallet fixed by route" contract still holds: when a
rule/occurrence has no usable Wallet, the occurrence detail page's
**[บันทึกรายการ]** link routes to `/finance/recurring/occurrences/
[occurrenceId]/use` (an intermediate Wallet-picker, mirroring Template's
own `/use` fallback) instead of straight to `/wallets/[walletId]/
transactions/new`.

### Occurrence model — a durable record, not just a computed date

`recurring_occurrences`: one row per generated due date,
`unique(recurring_transaction_id, due_date)`, `status` one of `UPCOMING`
/ `POSTED` / `SKIPPED`. Deliberately NOT just "compute next due date on
the fly forever" — a durable row is what lets the app show history (what
was due, what was posted, what was skipped) and is what
`post_recurring_occurrence`'s row lock (see "Atomic posting" below) has
to actually lock. `recurring_occurrences` carries **no direct
INSERT/UPDATE/DELETE grant to `authenticated`** — the same lockdown
pattern already used for `transaction_tags`/`transaction_template_tags`
— every write goes through one of three SECURITY DEFINER RPCs:
`materialize_recurring_occurrences`, `post_recurring_occurrence`,
`skip_recurring_occurrence`.

### Generation strategy — lazy, idempotent, bounded

`generate_recurring_occurrences_for_rule` (an internal helper, not
client-callable) materializes missing `UPCOMING` rows for one rule up to
a **90-day horizon**. Ordinary materialization continues after the
furthest existing occurrence. Reactivation and schedule rebuild instead
restart from `start_date`, advance on the rule's own anchor/cadence to
today, then insert future dates. This prevents old schedule history from
shifting a newly edited cadence. Idempotent by construction: the unique
constraint plus `ON CONFLICT DO NOTHING` make a repeated call for the
same rule and date range a no-op — including a date that already has a
**SKIPPED** row, which is exactly what keeps a skipped due date from
ever reappearing.

`materialize_recurring_occurrences(scope, householdId?)` is the one
client-facing RPC that runs this for every active (not paused, not
archived) rule the caller can see in one scope, in one round trip. It is
called once before every recurring-data read — the list page, a rule's
detail page, and the Finance Hub's compact section — so a rule created
last week and never opened since still shows a fully caught-up occurrence
history the moment anyone looks.

### Month-end anchoring — the exact drift-avoidance contract

`recurring_next_due_date(prev, start, frequency, interval_count,
anchor_day)` is a small deterministic SQL function, unit-verified against
these exact sequences (live-gated tests, "Recurring month-end anchoring"):

- **MONTHLY**, start 31 Jan: `31 Jan -> 28/29 Feb -> 31 Mar -> 30 Apr`.
  The clamp target is **always `anchor_day` (31, from `start_date`)**,
  never the previous occurrence's own (possibly already-clamped) day —
  this is what prevents `31 -> 28 -> 28` drift. Each step advances the
  previous occurrence's month by `interval_count` and clamps the day to
  `LEAST(anchor_day, days in that target month)`.
- **YEARLY**, start 29 Feb (leap year): `29 Feb 2024 -> 28 Feb 2025 ->
  28 Feb 2026 -> 28 Feb 2027 -> 29 Feb 2028`. The target month never
  changes (always `start_date`'s month); only the year advances by
  `interval_count`, with the same clamp-against-the-original-anchor rule.
- **WEEKLY** needs no clamping at all — `prev + interval_count * 7 days`
  preserves the day-of-week by construction.

### Date contract

`due_date`/`start_date`/`end_date` are canonical `DATE` columns — never
`timestamptz`. "Today," for the purposes of deciding the 90-day horizon
and the reactivation fast-forward (below), is computed once per RPC call
as `(now() at time zone 'Asia/Bangkok')::date`, matching this app's
existing Bangkok-anchored finance/calendar date contract
(`docs/DOMAIN_RULES.md`) — never `new Date().toISOString().slice(0,10)`.

### Pause and Archive — same behavior, different intent

Both **stop future generation** for that rule and leave everything else
alone: existing already-materialized `UPCOMING` occurrences for that
rule remain individually postable/skippable on the rule's own detail
page (a plain client UPDATE — `paused_at`/`archived_at` are not
identity-frozen columns, so no RPC is needed for either). They differ
only in the GLOBAL "upcoming" feed (Finance Hub's compact section, and
the Recurring list page's top-level "upcoming" tab): that feed shows only
occurrences belonging to rules that are currently active. A paused or
archived rule's own outstanding occurrences stay fully visible and
actionable on its own detail page — the intent is "stop nagging me about
this everywhere," not "hide the money I already scheduled."

### Reactivating a dormant rule — never backfilling the gap

Resuming (clearing `paused_at`) or restoring (clearing `archived_at`)
fires an `AFTER UPDATE` trigger that regenerates occurrences with a
**fast-forward** flag: the very first candidate due date is advanced,
in cadence steps, past anything before "today," without ever
materializing (or otherwise recording) the skipped-over dates. A rule
paused in January and resumed in September does not flood the occurrence
history with eight months of "overdue" rows — it picks back up at the
next due date on or after today. This is the one place ordinary
generation and reactivation genuinely differ; every other read
(materialize on page load) always shows real overdue occurrences as
`UPCOMING`, since a rule that was simply never paused has nothing to
fast-forward past.

### Editing the schedule — rebuilds only future UPCOMING occurrences

Editing `frequency`/`interval_count`/`start_date`/`end_date` (a plain
client UPDATE — a `WHEN` clause on the trigger ensures it only fires when
one of those values actually changed) fires an `AFTER UPDATE` trigger
that: keeps every `POSTED` and `SKIPPED` occurrence exactly as it is,
deletes only the still-`UPCOMING` ones, and regenerates fresh `UPCOMING`
occurrences from the edited rule's `start_date`/anchor, fast-forwarded to
today. Existing `POSTED`/`SKIPPED` dates remain authoritative and win any
same-date conflict; they never become an anchor for the new cadence.
Editing the *defaults*
(name/wallet/pocket/category/amount/title/note) touches none of this —
the `WHEN` clause simply never fires.

Both the schedule-rebuild trigger and the reactivation trigger are
SECURITY DEFINER, so they can write the locked-down
`recurring_occurrences` table on behalf of a client's ordinary,
lower-privileged `UPDATE` on `recurring_transactions` — no bespoke "edit"
RPC was needed for any of create/edit-defaults/edit-schedule/pause/
resume/archive/restore; every one of them stays a plain RLS-gated table
write, matching Category/Tag/Budget/Template precedent even though two of
these edits have a real side effect on a second table.

### Tag handling

Reuses Phase C Tags, through `set_recurring_transaction_tags` — its own
RPC, mirroring `set_template_tags` exactly, including the same
**deliberately lower atomicity bar** (a plain `INSERT` for the rule, tags
attached in a separate subsequent call) justified the same way: a
Recurring rule carries no accounting stakes of its own. Only the rule's
currently-**active** tags are copied when posting an occurrence; an
archived saved tag stays visible on the rule (struck through) but is
never attached to the transaction that actually gets created. Tag churn
on the rule *after* an occurrence has already been posted never touches
that already-created transaction's own tags — the copy happens once, at
post time, exactly like Template's copy-not-link relationship.

### Posting an occurrence — atomic, and reusing the existing writer

**[บันทึกรายการ]** on an occurrence's detail page routes into the
**existing** `/wallets/[walletId]/transactions/new` page via
`?occurrenceId=` (mirroring `?templateId=` exactly) — no second
transaction-writing implementation. The one genuine difference from
Template: `post_recurring_occurrence(occurrence_id, wallet_id, pocket_id,
category_id, amount, title?, note?, occurred_at?, tag_ids?)` — a
dedicated SECURITY DEFINER RPC, not a plain call to
`create_income_expense_transaction` directly from the client — because
posting must be atomic with the occurrence's `UPCOMING -> POSTED`
transition:

1. `SELECT ... FOR UPDATE` locks the occurrence row.
2. Rejects anything not currently `UPCOMING` (already posted, or
   skipped).
3. Calls the **existing** `create_income_expense_transaction` (0032) —
   a nested call from within this function still authorizes against the
   real calling user (`auth.uid()` reads the JWT claim, unaffected by the
   SECURITY DEFINER role switch), so Wallet/Category validation is
   exactly what a manual entry gets, no logic duplicated.
4. Marks the occurrence `POSTED`, with `posted_transaction_id` and
   `posted_at`, in the same function call — same implicit transaction as
   step 3, so a failure in either half rolls back both together. A
   failed post (invalid Category, archived Wallet, etc.) always leaves
   the occurrence exactly `UPCOMING`, never in some half-finished state.

**Double-post protection**: two concurrent posts on the same occurrence
serialize on the row lock from step 1 — whichever commits first flips the
status to `POSTED`; the second one, once it acquires the lock, sees that
and is rejected before touching the ledger at all. A partial unique index
on `posted_transaction_id` (where not null) is an additional, cheap
defense-in-depth guard on top of the lock, not the actual mechanism.

### Date behavior — unlike a Template, an occurrence has a real date

`occurred_at` on the created transaction defaults to the occurrence's own
`due_date` (not "today," unlike every other entry point into
`TransactionForm`) — the whole point of an occurrence is that it was
*due* on a specific day. The user may still change it before Save, same
as any other transaction's date field.

### Void interaction — never a silent repost

If a transaction created from an occurrence is later voided (Phase B),
the occurrence stays exactly `POSTED` — it never silently reverts to
`UPCOMING`, and `materialize_recurring_occurrences` never regenerates
that same `due_date` (the unique constraint blocks it outright). The read
model can show "POSTED · VOIDED" by joining to the linked transaction's
own `deleted_at`; a user who wants to make it right creates a fresh,
separate correction — this app never auto-reposts money because a
transaction was voided.

### Finance Hub / occurrence detail

The Hub's compact **"รายการประจำที่กำลังจะถึง"** section shows up to 3
upcoming (Personal-scope) occurrences with a **[ดูทั้งหมด]** link to
`/finance/recurring`; Household-scope upcoming items are visible in full
on that same page (a Household toggle, same as Templates/Budgets), not
duplicated onto the Hub. An occurrence's own detail page
(`/finance/recurring/occurrences/[occurrenceId]`) is where
**[บันทึกรายการ]** and **[ข้ามรายการนี้]** actually live — the rule's own
detail page shows the rule's saved defaults/schedule plus its occurrence
history, but posting/skipping a specific due date always happens one
level down, on that occurrence.

### Deferred (not built in Phase G)

"Create recurring from a Template" was considered and deliberately not
built — a Recurring rule needs stable, independently-owned scheduled
defaults; pointing it at a Template that could itself change or be
archived later would introduce a second moving part with no clear
benefit. Bills/Installments (a materially different domain — amounts
that must eventually be fully paid off, not merely recurring) remain
entirely out of scope, as does any scheduled/cron-based automatic
posting.

### Performance

`materialize_recurring_occurrences` is one RPC call per scope per page
load, internally looping over however many rules exist in that scope
server-side — never one generation call per rule from the client. Reading
a rule/occurrence list batches its tags through one query keyed by
however many rule ids are in play (`listTagsForRules`), same discipline
as every other batched read model in this app.

## Phase H — Bills / Due Dates

`0037_bills.sql` models payable obligations separately from Recurring
rules and transactions. Definitions, OPEN occurrences, derived urgency,
and SKIP have zero accounting effect. Explicit `pay_bill_occurrence`
locks one OPEN row, validates scope/currency, calls the existing EXPENSE
writer, and marks PAID atomically.

ONE_TIME/WEEKLY/MONTHLY/YEARLY schedules reuse Phase G date math and its
month-end/leap-day anchors. Materialization is idempotent and bounded to
Bangkok today + 90 days. Each occurrence snapshots `expected_amount`;
actual payment amount/date may differ. Amount/schedule edits preserve
PAID, SKIPPED, and past/today OPEN history while rebuilding future OPEN.

Postgres stores OPEN/PAID/SKIPPED. UI derives UPCOMING/DUE/OVERDUE from
Bangkok today. Pause/archive stop generation but existing OPEN rows stay
payable. Resume/restore restart current/future cadence. Voiding payment
leaves PAID and surfaces PAYMENT VOIDED. Saved references remain readable
when stale, but payment requires active same-scope Category/Wallet/Pocket,
active Tags, and Wallet currency matching Bill currency. No Calendar row
is created.

## Phase I — Installments

`0038_installments.sql` stores a plan plus stable numbered occurrences.
Creation generates every expected installment without ledger effect.
PostgreSQL distributes decimal cents: equal truncated installments first,
then final installment absorbs exact remainder, so snapshots sum exactly
to plan total. Month dates reuse Phase G anchor-safe calculation.

V1 freezes total/count/start/interval after creation and requires actual
payment equal expected installment amount. This deliberately avoids an
undefined re-amortization model. Each payment row-locks OPEN occurrence,
validates scope/currency, creates one ordinary EXPENSE, and marks PAID
atomically. Voiding payment does not reopen installment.

## Phase J — Saving Goals (Linked Pocket)

`0039_saving_goals.sql` links one Goal to one normal Pocket and permits at
most one active Goal per Pocket. Goal stores target metadata, never progress
or contribution rows. Progress is the unclamped authoritative Pocket ledger
balance. SQL derives remaining, percentage, and completion for presentation.
Currency comes from linked Wallet. Goal changes never move money; archived
sources remain readable and must be active before Goal restoration.

## Phase L — Analytics / Reports

`0042_finance_reports.sql` aggregates Income, net Expense, and exact Category
totals by Bangkok occurrence month. Reports support 3/6/12-month windows and
Personal/Household scope. PostgreSQL performs numeric aggregation. Void,
Transfer, and Debt Principal rows never enter reports. Currency remains separate.

## Phase M — Finance and Calendar Composition

`0043_calendar_finance_composition.sql` exposes due Recurring, Bill, and
Installment occurrences through one RLS-scoped read. Calendar renders these
source links beside native events. No Finance item is copied into
`calendar_events`; Finance tables retain lifecycle and accounting authority.

## Phase N — Attachments / Receipts

`0044_finance_attachments.sql` adds metadata and private `finance-attachments`
Storage. Paths bind each object to its transaction UUID. Table and object RLS
reuse transaction authorization. JPEG/PNG/WebP/PDF files allow up to 15 MiB.
Readers receive one-hour signed URLs; no public URL or service-role bypass exists.

## Phase O — CSV Import

`0045_finance_csv_import.sql` imports validated logical Income/Expense rows through
the existing authoritative writer. UI requires explicit column mapping and shows
a preview before confirmation. One RPC makes batches up to 500 rows atomic.
Per-user canonical fingerprints skip exact repeated rows; arbitrary ledger entries,
invalid dates/amounts/types, and unauthorized UUID references are rejected.

## Phase P — Export

`0046_finance_export.sql` returns one logical row per active transaction under
RLS. CSV filters cover date range, Wallet, Pocket, Category, semantic type, and
Tag. Transfer/Principal remain explicit types. Entry aggregation happens before
Tag aggregation to prevent multiplication. CSV preserves currency and decimal
strings. XLSX is deferred because current runtime has no suitable dependency.

## Phase Q — Net Worth

`0047_net_worth.sql` derives per-currency net worth as Wallet cash plus
receivable principal minus liability principal. Both cash and principal use
non-voided authoritative ledger/event rows. Archived sources remain included
while balances exist. No FX conversion or cross-currency total exists.

## Phase R — Deterministic Insights

`0048_finance_insights.sql` emits traceable rules: largest current-month
Expense, prior-month comparison, Bills due within 30 days, and liability total.
Each result retains currency, amount, and source ID or source route. Rules use
authoritative RLS-scoped values and never generate financial advice.

## Phase S — Global Quick Add

Authenticated layout shows one mobile floating `+` action. It opens Income,
Expense, and Transfer choices for first active Wallet and reuses existing route,
Server Action, and RPC writers unchanged. Users without Wallets go to Wallet
creation. No database migration is needed.

## Phase T — Final Finance Hub

`0049_finance_hub_final.sql` composes Net Worth, six-month Personal trend, and
next three Installment occurrences in one RLS-scoped call. `/finance` now leads
with current period, balances, Income/Expense, quick actions, and compact Net
Worth/trend. Progressive sections cover Wallets, recent history, Categories,
Budgets, upcoming obligations, Goals, Debt, then complete Finance Tools.

## Phase K — Cash-linked Debt Events

`0040` adds `DEBT_PRINCIPAL`; `0041` adds debt accounts and immutable events.
Borrowed principal increases Wallet cash but is not Income. Liability principal
repayment decreases cash but is not Expense. Lending does the inverse for a
receivable. Only interest uses ordinary Expense/Income writers. Outstanding
principal is derived from non-voided debt events; no cached balance exists.

Opening and additional principal, repayment/receipt, and optional interest are
atomic RPC operations. Payment locks the debt account and rejects overpayment.
Voiding either half of a compound principal-plus-interest payment synchronizes
the other half. Archive blocks new events but preserves debt and ledger history.
