# Our Home — Finance Roadmap

> This file is the authoritative handoff document for Finance development agents.
> Do not rely on prior chat context when this document is available.

## Current status

| Phase | Feature | Status | Migration |
|---|---|---|---|
| A | Wallet + Pocket Management | STATIC_VERIFIED | 0030 |
| B | Transaction Management | STATIC_VERIFIED | 0031 |
| C | Transaction Tags | STATIC_VERIFIED | 0032 |
| D | Refunds + Reimbursements | STATIC_VERIFIED | 0033 |
| E | Budgets | STATIC_VERIFIED | 0034 |
| F | Transaction Templates | STATIC_VERIFIED | 0035 |
| G | Recurring Transactions | STATIC_VERIFIED | 0036 |
| H | Bills / Due Dates | READY | next additive migration |
| I | Installments | NOT_STARTED | TBD |
| J | Saving Goals | NOT_STARTED | TBD |
| K | Debt / Borrow / Lend | NOT_STARTED | TBD |
| L | Analytics / Reports | NOT_STARTED | TBD |
| M | Finance ↔ Calendar Integration | NOT_STARTED | TBD |
| N | Attachments / Receipts | NOT_STARTED | TBD |
| O | Import | NOT_STARTED | TBD |
| P | Export | NOT_STARTED | TBD |
| Q | Net Worth | NOT_STARTED | TBD |
| R | Insights | NOT_STARTED | TBD |
| S | Fast Bookkeeping / Global Quick Add | NOT_STARTED | TBD |
| T | Finance Hub Final Integration | NOT_STARTED | TBD |

Current completed migration head: `0036_recurring_transactions.sql`.

`STATIC_VERIFIED` means typecheck/lint/tests/build/diff passed. It does **not** mean live database verification has passed.

---

## Agent execution protocol

When continuing Finance work:

1. Read this file first.
2. Run `git status`, `git diff --stat`, `git diff`, and `git diff --check`.
3. Start from the first phase that is not `STATIC_VERIFIED`.
4. Audit existing code before implementing.
5. Never redo a completed phase unless a regression is proven.
6. Never edit a migration that has already been completed/applied. Add the next migration.
7. After every phase run:
   - `npm.cmd run typecheck`
   - `npm.cmd run lint`
   - `npm.cmd run test`
   - `npm.cmd run build`
   - `git diff --check`
8. If a gate fails, fix it before continuing.
9. A successful static gate may advance to the next phase without asking the user.
10. Stop and ask only for a genuinely unresolved accounting/security/destructive-data decision.
11. Never claim `LIVE VERIFIED` without live/manual verification.

---

# Finance domain invariants

These rules are non-negotiable.

## Core entities

- Wallet = real financial account/source of money.
- Pocket = allocation inside a Wallet.
- Category = accounting/spending purpose.
- Tag = cross-cutting organizational metadata.
- Budget = spending plan.
- Saving Goal = target/planning concept.
- Transaction = logical financial event.
- `transaction_entries` = signed ledger source of truth.

Never merge these concepts:

- Wallet ≠ Pocket
- Pocket ≠ Budget
- Pocket ≠ Saving Goal
- Category ≠ Tag
- Template ≠ Recurring Transaction
- Recurring Transaction ≠ Bill
- Bill ≠ Transaction
- Debt ≠ Expense
- Loan principal ≠ Income
- Principal repayment ≠ Expense
- Refund ≠ Income
- Reimbursement ≠ Income

## Pocket rule

There is **no Main/default Pocket**.

All Pockets are equal.

Do not reintroduce:

- `Main Pocket`
- `is_default`
- default-Pocket database semantics
- UI badges implying one Pocket is special

## Ledger

Balances are always derived from ledger entries.

Never add mutable stored Wallet/Pocket balance columns.

- Income → positive entry
- Expense → negative entry
- Pocket transfer → source negative + destination positive; Wallet total unchanged
- Wallet transfer → source negative + destination positive; combined net worth unchanged
- Transfers never count as Income/Expense

Money authority:

- PostgreSQL `numeric`
- application boundary = decimal strings
- no JavaScript floating-point arithmetic as financial truth

## Multi-currency

Never add unlike currencies.

No implicit FX conversion.

THB, USD, etc. must remain separate until an explicit FX model is implemented.

## Void

Phase B uses `transactions.deleted_at` as the void marker.

Original `transaction_entries` remain stored.

Authoritative balance/report queries exclude voided transactions.

## Refund/Reimbursement

Phase D representation:

- base `transaction_type = 'EXPENSE'`
- positive ledger entry
- metadata in `expense_adjustments`
- linked to original Expense

Therefore code must **not** assume every `EXPENSE` row is an ordinary spending event when semantic type matters.

Refund/Reimbursement:

- increase cash
- reduce net Expense
- never count as Income
- use cash-basis month (`occurred_at` of adjustment)
- inherit reporting category from original Expense

## Scope/security

Finance follows Personal/Household scope.

- PERSONAL → owner
- HOUSEHOLD → active household-member policy already established
- outsiders denied
- no cross-household reference laundering
- no service-role bypass in UI/server application code

Financial state mutations should stay DB/RPC-authoritative when atomicity or cross-table invariants matter.

---

# Completed phase summaries

## Phase A — Wallet + Pocket Management
Status: `STATIC_VERIFIED`

Implemented:

- create/view/rename/archive/restore/delete-safe Wallet lifecycle
- create/rename/archive/restore/delete-safe Pocket lifecycle
- Wallet currency mutable only before financial history exists
- non-zero Wallet cannot be archived
- used Wallet/Pocket cannot be hard-deleted
- last usable Pocket protected
- no Main/default Pocket semantics

Migration: `0030_wallet_pocket_lifecycle.sql`

## Phase B — Transaction Management
Status: `STATIC_VERIFIED`

Implemented:

- Income/Expense detail
- edit amount/date/Pocket/Category/title/note
- Wallet/type immutable in normal edit
- void/restore
- search/filter
- transfer history remains logically grouped
- voided transactions remain readable but contribute zero active financial effect

Migration: `0031_transaction_management.sql`

## Phase C — Transaction Tags
Status: `STATIC_VERIFIED`

Implemented:

- PERSONAL/HOUSEHOLD Tags
- create/rename/archive/restore
- normalized duplicate protection
- many-to-many transaction tags
- tags on Income/Expense/Transfers
- atomic tag assignment
- tag filter in transaction history
- archived historical tag associations preserved

Migration: `0032_transaction_tags.sql`

## Phase D — Refunds + Reimbursements
Status: `STATIC_VERIFIED`

Implemented:

- partial/full Refund
- Reimbursement as distinct semantic kind
- positive ledger entries that reduce Expense rather than create Income
- original Expense relationship via `expense_adjustments`
- race-safe combined adjustment cap
- refund/reimbursement void/restore
- original Expense edit/void guards
- cash-basis month/category reporting

Migration: `0033_refunds_reimbursements.sql`

## Phase E — Budgets
Status: `STATIC_VERIFIED`

Implemented:

- monthly exact-category budgets
- Personal/Household scope
- currency isolation
- create/edit amount/archive/restore
- derived spent/remaining/progress
- Refund/Reimbursement naturally reduce spending using signed semantics
- negative monthly net-spend allowed
- Finance Hub budget summary

Budget ≠ Pocket.

Migration: `0034_budgets.sql`

## Phase F — Transaction Templates
Status: `STATIC_VERIFIED`

Implemented:

- reusable Income/Expense defaults
- amount/Wallet/Pocket/Category/title/note/tags
- template CRUD/archive/restore
- stale-reference handling
- use Template → existing TransactionForm/writer
- occurred date determined at use time
- Template itself has zero accounting effect

Template ≠ Recurring Transaction.

Migration: `0035_transaction_templates.sql`

## Phase G — Recurring Transactions
Status: `STATIC_VERIFIED`

Implemented:

- recurring Income/Expense rules
- WEEKLY/MONTHLY/YEARLY intervals
- stable occurrences: UPCOMING/POSTED/SKIPPED
- bounded +90-day generation
- idempotent occurrence materialization
- month-end anchor preservation
- leap-day yearly semantics
- pause/resume/archive/restore
- atomic confirm-before-post
- concurrency-safe double-post protection
- posted transaction relationship
- linked transaction may later be VOIDED without reopening occurrence
- Finance Hub upcoming recurring section

Critical recurrence behavior:

- `31 Jan → Feb last day → 31 Mar → 30 Apr`
- `29 Feb 2024 → 28 Feb 2025 → 28 Feb 2026 → 28 Feb 2027 → 29 Feb 2028`

Rule/occurrence/skip have zero accounting effect. Only POST creates a normal Income/Expense transaction.

Migration: `0036_recurring_transactions.sql`

---

# Remaining roadmap

## Phase H — Bills / Due Dates
Status: `READY`

### Goal

Track financial obligations with due dates and payment state.

Bill ≠ Recurring Transaction.

A Bill is an obligation; it does not become an Expense until paid.

### Required model

Use a Bill definition plus stable Bill occurrences.

Support:

- ONE_TIME
- WEEKLY
- MONTHLY
- YEARLY

Bill definition should contain:

- scope / owner / household
- name
- amount
- currency
- Expense Category
- optional Wallet/Pocket defaults
- optional title/note/tags
- recurrence schedule
- pause/archive state

Occurrence should contain at least:

- bill_id
- due_date `DATE`
- expected_amount snapshot
- base lifecycle state
- paid_transaction_id
- paid_at / skipped_at

Recommended stored lifecycle:

- OPEN
- PAID
- SKIPPED

Derive UI state:

- OPEN + future due date → UPCOMING
- OPEN + today → DUE
- OPEN + past → OVERDUE

Do not persist DUE/OVERDUE unless a strong reason appears.

### Accounting

Before payment:

- no transaction
- no ledger entry
- no balance change
- no Budget effect

Payment:

- user explicitly confirms
- creates one normal Expense
- amount may differ from expected amount
- payment currency must equal Bill currency
- occurrence becomes PAID atomically
- `paid_transaction_id` preserves provenance

Payment must be concurrency-safe: two tabs can create only one Expense.

If paid Expense is later voided:

- Bill occurrence remains PAID
- UI may show `PAID · PAYMENT VOIDED`
- do not automatically reopen

### Scheduling

Reuse Phase G recurrence semantics.

Preserve month-end anchors and leap-day behavior.

Use `DATE`, not midnight `timestamptz`.

Generation must be bounded/idempotent.

### Bill controls

- create
- edit
- pause/resume
- archive/restore
- skip occurrence
- pay occurrence

Historical PAID/SKIPPED occurrences must not be rewritten by future schedule edits.

### Finance integration

Add:

- Bills tool under Finance
- compact overdue/due/upcoming section on `/finance`

Do not add a bottom-nav Bill item.

Do not duplicate Bill occurrences into Calendar yet.

### Acceptance criteria

Must test:

- one-time + recurring generation
- UPCOMING/DUE/OVERDUE derivation
- Bangkok boundary
- expected amount snapshots
- actual payment amount
- no accounting effect before payment
- atomic payment
- concurrent double-pay protection
- scope/currency validation
- stale references
- skip semantics
- paid-then-voided behavior
- Budget effect only after payment
- Refund works normally against paid Bill Expense

Likely migration: `0037_bills.sql`.

---

## Phase I — Installments
Status: `NOT_STARTED`

### Goal

Track purchase/payment plans split across scheduled installments.

Installment plan ≠ Expense transaction.

### Model

Installment plan should contain:

- scope
- name/description
- total amount
- currency
- installment count
- start/due schedule
- Expense Category
- optional Wallet/Pocket defaults
- title/note/tags
- lifecycle state

Stable installment occurrences should contain:

- sequence number
- due date
- expected amount
- status
- paid transaction link

### Accounting

Do **not** create one full Expense and then additional installment Expenses.

V1 rule:

- plan creation = zero ledger effect
- unpaid installment = zero ledger effect
- each paid installment = one normal Expense

### Decimal distribution

Distribution must use PostgreSQL numeric/decimal-safe logic.

If total does not divide evenly:

- earlier installments use consistent rounded amount
- final installment absorbs exact remainder
- sum of all installments must equal plan total exactly

Example:

`1000 / 3` must not become an accumulated floating-point error.

### Payment

Payment must be atomic and double-pay-safe, mirroring Bills.

Actual amount semantics must be explicit. Preferred V1: expected schedule amount is the default, while a user-entered actual payment is allowed only if remaining-plan accounting stays coherent.

### Calendar readiness

Expose due date/status cleanly for Phase M.

### Acceptance criteria

Test:

- schedule generation
- exact installment total distribution
- final rounding adjustment
- payment atomicity
- double-pay race
- no ledger before payment
- Budget effect once per paid installment
- voided paid transaction does not silently reopen occurrence
- stale references
- multi-currency isolation

---

## Phase J — Saving Goals
Status: `NOT_STARTED`

### Goal

Track savings targets without creating fake money or double-counting assets.

Saving Goal ≠ Wallet/Pocket.

### Required design decision before implementation

Choose one authoritative progress model and document it.

Preferred options:

1. **Linked Pocket model** — Goal progress derives from balance of one or more explicitly linked Pockets.
2. **Contribution/allocation model** — explicit Goal contribution records reference real money movements without inventing assets.

Do not store an arbitrary mutable `current_amount` that can diverge from real money.

If both models are materially viable in the existing architecture, STOP and ask the user before implementation.

### Required fields

- scope
- name
- target amount
- currency
- optional target date
- progress source
- lifecycle/completed state

### Acceptance criteria

- no fake ledger entries merely for creating Goal
- no double-counting Wallet assets
- currency-safe progress
- archive/restore/history
- Household scope security
- Finance Hub summary

---

## Phase K — Debt / Borrow / Lend
Status: `NOT_STARTED`

### Goal

Track liabilities and receivables with correct principal/interest semantics.

### Core semantics

Receiving borrowed principal ≠ ordinary Income.

Repaying principal ≠ ordinary Expense.

Interest and fees = Expense.

Example repayment:

- payment 5,000
- principal 4,500
- interest 500

Only interest/fees belong in Expense reporting; principal reduces liability.

### Entities

Support:

- Liability
- Receivable
- opening principal
- current outstanding principal derived from events
- currency
- counterparty/name
- interest/APR metadata where useful
- due/schedule metadata
- payment history
- paid-off/archive state

### Required design decision

Do not pretend to implement full double-entry accounting unless needed.

If there are two materially different viable models for how loan principal should interact with Wallet cash-flow vs Income/Expense reports, STOP and ask before implementation.

### Acceptance criteria

- principal flows do not pollute Income/Expense reports
- interest/fees do
- outstanding balance remains exact
- payments atomic
- no currency mixing
- liability vs receivable semantics distinct
- Bill/Installment overlap explicitly handled

---

## Phase L — Analytics / Reports
Status: `NOT_STARTED`

### Goal

Provide useful financial analysis from authoritative read models.

### Reports

1. Income vs Expense trend
   - 3M
   - 6M default
   - 12M

2. Expense by Category

3. Income by Category

4. Month comparison

5. Cash-flow summary where semantics are correct

### Rules

- use `occurred_at`
- transfers excluded from Income/Expense
- Refund/Reimbursement reduce Expense
- voided transactions excluded
- exact-category V1 unless explicit roll-up exists
- unlike currencies never combined
- no JS float aggregation
- prefer SQL/RPC/read-model aggregation
- avoid N+1

Charts must be presentation over authoritative numeric results, not financial computation sources.

---

## Phase M — Finance ↔ Calendar Integration
Status: `NOT_STARTED`

### Goal

Surface finance due/scheduled items inside the existing Calendar without duplicating source-of-truth records.

Calendar is already a separate verified domain.

### Sources

Calendar should be able to surface:

- Recurring occurrences
- Bills
- Installment due dates
- optionally finance daily totals

### Rule

Do not copy every finance item into `calendar_events` merely for display.

Prefer a composed read model/source integration so each domain retains its own source of truth.

Personal/Household visibility must remain correct.

---

## Phase N — Attachments / Receipts
Status: `NOT_STARTED`

### Goal

Attach private receipt/invoice evidence to financial transactions.

### Storage

Use a dedicated private Finance bucket.

Support at least:

- JPEG
- PNG
- WebP
- PDF if clean

Security:

- transaction-authorized viewers only
- signed URLs at read time
- stable private paths
- no public bucket
- no service-role UI bypass

### Image compression backlog

Implement client-side resize/compression here for:

- Finance images
- Member avatar
- Pet photo

Preserve aspect ratio.

Existing upload cap for Member/Pet remains 15 MiB input unless intentionally changed.

---

## Phase O — Import
Status: `NOT_STARTED`

### Goal

Safely import historical transaction data.

Start with CSV.

Flow:

1. upload
2. parse
3. preview
4. map columns
5. validate
6. show errors
7. confirm
8. import

Support mappings for:

- date
- amount
- type
- Wallet
- Pocket
- Category
- title
- note
- tags if practical

Do not silently guess destructive mappings.

Provide duplicate-detection strategy.

Invalid date/number/currency values must not be silently accepted.

Import logical transactions, not raw ledger entries from arbitrary files.

---

## Phase P — Export
Status: `NOT_STARTED`

### Goal

Export user-visible financial history.

Support at least:

- CSV
- XLSX if clean in current runtime

Filters:

- date range
- Wallet
- Pocket
- Category
- transaction semantic type
- Tags

Default export = logical transactions.

Raw ledger export may be a separate advanced option.

Respect Personal/Household access.

---

## Phase Q — Net Worth
Status: `NOT_STARTED`

### Prerequisite

Do not implement until Debt model exists.

### Formula

Net worth per currency:

Assets − Liabilities

Assets initially include real Wallet balances and later explicit asset accounts if introduced.

Liabilities come from Phase K.

Never combine currencies without explicit FX.

Example:

THB:

- Assets 120,000
- Liabilities 70,000
- Net 50,000

USD displayed separately.

---

## Phase R — Insights
Status: `NOT_STARTED`

### Goal

Provide deterministic, traceable insights.

Examples:

- Food spending +18% vs previous month
- Budget 90% consumed with 8 days remaining
- largest Expense
- average daily Expense
- subscription/recurring total
- upcoming Bills
- debt reduction trend

Start with deterministic rules.

Do not present AI-generated financial advice as authoritative.

Every insight should be traceable to underlying values/read models.

---

## Phase S — Fast Bookkeeping / Global Quick Add
Status: `NOT_STARTED`

### Goal

Enable transaction capture from anywhere in the app.

Global action:

`+`

opens:

- + รายรับ
- - รายจ่าย
- ↔ โอนเงิน

Possible later additions:

- Refund
- Bill payment

Must reuse existing writers/actions/RPCs.

Do not create parallel transaction implementations.

Mobile-first and PWA-friendly.

---

## Phase T — Finance Hub Final Integration
Status: `NOT_STARTED`

### Goal

Make `/finance` the daily financial home without turning it into an excessively long page.

### Target structure

- current month
- per-currency total balance / Net Worth summary when available
- Income / Expense
- global quick actions
- Budget status
- 3M/6M/12M trend
- Wallets / Pockets
- recent transactions
- upcoming Recurring/Bills/Installments
- expense-category summary
- Saving Goals
- Debt overview
- Finance Tools

Finance Tools should include:

- Wallets
- Pockets
- Categories
- Tags
- Budgets
- Templates
- Recurring
- Bills
- Installments
- Saving Goals
- Debt
- Reports
- Import
- Export

Wallet/Category/etc. remain Finance sub-tools, not competing bottom-navigation destinations.

Use progressive disclosure/cards/navigation so `/finance` remains readable on mobile.

---

# Final regression checklist

These invariants must remain permanently tested as the roadmap advances:

- Income creation
- Expense creation
- Pocket Transfer
- Wallet Transfer
- Wallet/Pocket lifecycle
- no Main/default Pocket
- Transaction Edit/Void/Restore
- logical transfer grouping
- Tags
- Refund/Reimbursement
- Budget signed-spend semantics
- Templates have zero accounting effect
- Recurring rule/occurrence/skip have zero accounting effect
- Recurring post creates exactly one financial transaction
- Bill unpaid state has zero accounting effect
- Bill payment creates exactly one Expense
- Installment unpaid state has zero accounting effect
- Debt principal does not pollute Income/Expense
- multi-currency separation
- archived historical context preservation
- Household security/RLS
- Member/Profile/Household/Pets/Calendar regressions

---

# Live verification policy

Static verification may advance development, but each migration/feature remains live-pending until tested against the real Supabase project.

When a live verification batch is eventually run:

1. apply all pending migrations in order
2. verify migration history before editing any existing migration
3. test financial invariants with real UI flows
4. test Household second-member behavior
5. test outsider denial where practical
6. test concurrency-sensitive paths such as Recurring/Bill double-post
7. verify Bangkok date boundaries
8. verify multi-currency separation
9. only then change phase/product status to `LIVE_VERIFIED`
