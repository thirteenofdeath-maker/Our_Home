-- 0034_budgets.sql
-- Phase E: Monthly Category Budgets. Planning metadata only — a Budget
-- NEVER moves money, reserves ledger money, creates transaction_entries,
-- or alters a Wallet/Pocket balance. It stores only what was PLANNED
-- (`amount`); how much was actually spent is always DERIVED, live, from
-- the existing ledger — the same "no cached/stored consumption" contract
-- already used for every balance in this app.

create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  scope public.money_scope not null,
  owner_user_id uuid references public.profiles (id),
  household_id uuid references public.households (id),
  category_id uuid not null references public.categories (id),
  currency text not null,
  -- Canonical first-of-month, e.g. 2026-09-01. Never a range — one row is
  -- exactly one calendar month's plan for one category/currency.
  period_month date not null,
  amount numeric(14, 2) not null,
  archived_at timestamptz,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint budgets_scope_ownership_chk check (
    (scope = 'PERSONAL' and owner_user_id is not null and household_id is null)
    or
    (scope = 'HOUSEHOLD' and household_id is not null and owner_user_id is null)
  ),
  constraint budgets_amount_positive_chk check (amount > 0),
  constraint budgets_period_month_canonical_chk check (period_month = date_trunc('month', period_month)::date)
);

comment on table public.budgets is
  'How much the user PLANS to spend in one EXPENSE category, one currency, one calendar month. Never stores spent/remaining/percentage — those are always derived live from transactions (see get_budget_summary). Exact-category semantics in V1: a budget on a parent category does not include its children''s spending, and vice versa.';
comment on column public.budgets.category_id is
  'Must be an EXPENSE category (checked by budgets_validate_category) in the SAME scope/owner/household as this budget — never an INCOME category, never a different owner/household''s category (no scope laundering).';
comment on column public.budgets.period_month is
  'Canonical first-of-month (e.g. 2026-09-01), computed and passed by the application from the same Asia/Bangkok month contract already used by Finance Hub (financeMonthRange) — never derived from a bare UTC date, which can shift a day at the timezone boundary.';
comment on column public.budgets.archived_at is
  'NULL = active. A Budget is never hard-deleted (no DELETE grant/policy exists) — archive instead, same convention as Category/Tag.';

create index budgets_owner_user_id_idx on public.budgets (owner_user_id) where owner_user_id is not null;
create index budgets_household_id_idx on public.budgets (household_id) where household_id is not null;
create index budgets_category_id_idx on public.budgets (category_id);
create index budgets_period_month_idx on public.budgets (period_month);

-- Prevents duplicate ACTIVE budget definitions for the same identity
-- (scope + owner/household + category + currency + month). An archived
-- row does not block a new active one for the same identity — but see
-- restore_budget's own conflict below, which the unique index also
-- protects: restoring into an identity a newer active row already
-- occupies is rejected by this same constraint.
create unique index budgets_personal_unique_idx on public.budgets (owner_user_id, category_id, currency, period_month)
  where scope = 'PERSONAL' and archived_at is null;
create unique index budgets_household_unique_idx on public.budgets (household_id, category_id, currency, period_month)
  where scope = 'HOUSEHOLD' and archived_at is null;

create trigger budgets_set_updated_at
  before update on public.budgets
  for each row execute function public.set_updated_at();

-- Identity is frozen after creation, same pattern as wallets/pockets/
-- categories/tags: to change category/currency/month, archive this
-- Budget and create another (V1 simplicity — see docs/FINANCE.md Phase
-- E). Only `amount` and `archived_at` remain mutable.
create trigger budgets_prevent_identity_changes
  before update on public.budgets
  for each row execute function public.prevent_immutable_column_changes(
    'scope', 'owner_user_id', 'household_id', 'created_by', 'category_id', 'currency', 'period_month'
  );

-- Cross-table validation (category must exist, be EXPENSE-typed, not
-- archived, and share this budget's scope/owner/household) can only run
-- at creation time — an EXISTING budget must stay valid even if its
-- category is archived afterward (docs/FINANCE.md Phase E "Category
-- archive"), so this fires on INSERT only, never on UPDATE.
create function public.budgets_validate_category()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_category public.categories%rowtype;
begin
  select * into v_category from public.categories where id = new.category_id;
  if not found then
    raise exception 'Category % not found or not accessible', new.category_id using errcode = '23503';
  end if;

  if v_category.transaction_type <> 'EXPENSE' then
    raise exception 'Budgets can only target an EXPENSE category (got %)', v_category.transaction_type
      using errcode = '23514';
  end if;

  if v_category.archived_at is not null then
    raise exception 'Category % is archived and cannot be used for a new Budget', new.category_id
      using errcode = '23514';
  end if;

  if not v_category.is_system and (
    v_category.scope <> new.scope
    or v_category.owner_user_id is distinct from new.owner_user_id
    or v_category.household_id is distinct from new.household_id
  ) then
    raise exception 'Category % does not belong to the same owner/household as this Budget', new.category_id
      using errcode = '23514';
  end if;

  return new;
end;
$$;

comment on function public.budgets_validate_category() is
  'INSERT-only guard: rejects a new Budget targeting an INCOME category, an archived category, or a category outside this Budget''s own scope/owner/household. Deliberately not re-run on UPDATE — an existing Budget must remain valid even after its category is later archived.';

create trigger budgets_before_insert_validate_category
  before insert on public.budgets
  for each row execute function public.budgets_validate_category();

alter table public.budgets enable row level security;

-- Same PERSONAL-owner / HOUSEHOLD-member policy as wallets/categories/
-- tags — day-to-day household finance (including budget planning) is a
-- member-level privilege, not owner/admin-gated (docs/DOMAIN_RULES.md
-- "Security"); no reason to invent a stricter rule for Budget alone.
create policy budgets_select
  on public.budgets for select
  using (
    (scope = 'PERSONAL' and owner_user_id = auth.uid())
    or
    (scope = 'HOUSEHOLD' and public.is_household_member(household_id))
  );

create policy budgets_insert
  on public.budgets for insert
  with check (
    created_by = auth.uid()
    and (
      (scope = 'PERSONAL' and owner_user_id = auth.uid())
      or
      (scope = 'HOUSEHOLD' and public.is_household_member(household_id))
    )
  );

create policy budgets_update
  on public.budgets for update
  using (
    (scope = 'PERSONAL' and owner_user_id = auth.uid())
    or
    (scope = 'HOUSEHOLD' and public.is_household_member(household_id))
  )
  with check (
    (scope = 'PERSONAL' and owner_user_id = auth.uid())
    or
    (scope = 'HOUSEHOLD' and public.is_household_member(household_id))
  );

-- No delete policy/grant: hard delete is not part of V1 (archive instead).

grant select, insert, update on public.budgets to authenticated;

-- ---------------------------------------------------------------------
-- get_budget_summary: the one batched read model — every budget for a
-- given month, each with its live-derived net_spent/remaining, in ONE
-- query (never one spending query per budget). p_month_start/p_month_end
-- are pre-computed Bangkok-anchored bounds from the app's existing
-- financeMonthRange() (see docs/FINANCE.md Phase E "Month/timezone") —
-- this function does no timezone math of its own, deliberately, to avoid
-- a second, divergent implementation of the Bangkok-month contract
-- already established by get_finance_hub_summary (0028).
--
-- net_spent nets ordinary EXPENSE against REFUND/REIMBURSEMENT entries
-- for the exact category_id (Phase D stores both as transaction_type =
-- 'EXPENSE' with a positive entry and the original's own category_id —
-- see docs/FINANCE.md Phase D), so `sum(-amount) filter (EXPENSE)` is
-- already the correct net figure with no special-case logic, exactly
-- mirroring 0028's own category_entries CTE. INCOME and TRANSFER are
-- excluded structurally (a Budget's category is always EXPENSE-typed,
-- and category_id is immutable/type-matched at every transaction-write
-- path, so no non-EXPENSE transaction can ever reference it) — the
-- explicit filter below is defense-in-depth, matching 0028's own style.
-- net_spent is intentionally NEVER clamped — a cash-basis month can
-- legitimately spend less than it's refunded, i.e. go negative.
-- ---------------------------------------------------------------------

create function public.get_budget_summary(p_period_month date, p_month_start timestamptz, p_month_end timestamptz)
returns jsonb
language sql
security invoker
set search_path = public
stable
as $$
  with active_budgets as (
    select
      b.id,
      b.category_id,
      coalesce(c.name, 'ไม่ทราบหมวดหมู่') as category_name,
      (c.archived_at is not null) as category_archived,
      b.currency,
      b.period_month,
      b.amount,
      b.archived_at
    from public.budgets b
    left join public.categories c on c.id = b.category_id
    where b.period_month = p_period_month
  ), spent as (
    select
      ab.id as budget_id,
      coalesce(sum(-e.amount) filter (where t.transaction_type = 'EXPENSE'), 0) as net_spent
    from active_budgets ab
    join public.transactions t on t.category_id = ab.category_id
      and t.deleted_at is null
      and t.occurred_at >= p_month_start
      and t.occurred_at < p_month_end
    join public.transaction_entries e on e.transaction_id = t.id
    join public.wallets w on w.id = e.wallet_id and w.currency = ab.currency
    group by ab.id
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'budget_id', ab.id,
        'category_id', ab.category_id,
        'category_name', ab.category_name,
        'category_archived', ab.category_archived,
        'currency', ab.currency,
        'period_month', ab.period_month,
        'budget_amount', ab.amount::text,
        'net_spent', coalesce(s.net_spent, 0)::text,
        'remaining', (ab.amount - coalesce(s.net_spent, 0))::text,
        'archived_at', ab.archived_at
      )
      order by ab.category_name
    ),
    '[]'::jsonb
  )
  from active_budgets ab
  left join spent s on s.budget_id = ab.id;
$$;

comment on function public.get_budget_summary(date, timestamptz, timestamptz) is
  'RLS-scoped: every Budget (active and archived) for one exact period_month, with live net_spent/remaining. One query, no per-budget spending lookup. net_spent is never clamped — legitimately negative on cash-basis months dominated by refunds.';

revoke execute on function public.get_budget_summary(date, timestamptz, timestamptz) from public, anon;
grant execute on function public.get_budget_summary(date, timestamptz, timestamptz) to authenticated;
