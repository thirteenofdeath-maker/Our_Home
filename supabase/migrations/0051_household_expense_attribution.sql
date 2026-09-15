-- 0051_household_expense_attribution.sql
-- Phase U: Personal-Funded Household Expense.
--
-- Lets a member pay a HOUSEHOLD expense directly out of their own PERSONAL
-- wallet. The transaction stays PERSONAL end-to-end (its scope,
-- owner_user_id, and which wallet/pocket actually lost the cash never
-- change — see docs/DOMAIN_RULES.md "Personal data is private" and
-- "Wallet != Category"). What changes is which household the expense is
-- *attributed* to for household-level accounting: a household_category_id
-- lives in a new, RPC-write-only table (household_expense_attributions),
-- never on transactions.category_id itself (Option C from the architecture
-- audit — Option A fails the existing same-scope category check baked into
-- create/update_income_expense_transaction; Option B would create two
-- category fields that can drift). transactions.category_id is NULL for an
-- attributed expense.
--
-- Payer identity is transactions.owner_user_id — never a new payer_id
-- column, since Wallet != Category rules already have exactly one owner
-- concept for a PERSONAL row. household_expense_attributions.created_by
-- means "who recorded the attribution" (equal to the payer in V1, but a
-- semantically distinct fact, same as transactions.created_by vs
-- transactions.owner_user_id elsewhere in this schema).

-- ---------------------------------------------------------------------
-- household_expense_attributions
-- ---------------------------------------------------------------------

create table public.household_expense_attributions (
  transaction_id uuid primary key references public.transactions (id) on delete cascade,
  household_id uuid not null references public.households (id),
  household_category_id uuid not null references public.categories (id),
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.household_expense_attributions is
  'Marks a PERSONAL EXPENSE transaction as attributed to a HOUSEHOLD for accounting purposes (Phase U). The transaction itself never changes scope/owner/wallet — only its household reporting classification lives here. RPC-write-only: no direct INSERT/UPDATE/DELETE grant to authenticated. transaction_id/household_id/created_by are frozen after creation; only household_category_id may change, via update_attributed_household_expense.';
comment on column public.household_expense_attributions.household_category_id is
  'Must be an EXPENSE-typed, active category that is either a system category or belongs to this row''s own household_id — validated inside create_attributed_household_expense / update_attributed_household_expense, not by a trigger, since this is the sole write path (see migration header).';
comment on column public.household_expense_attributions.created_by is
  'Who recorded the attribution (equal to the underlying transaction''s owner_user_id in V1, but a distinct fact — same relationship as transactions.created_by vs transactions.owner_user_id).';

create index household_expense_attributions_household_id_idx on public.household_expense_attributions (household_id);
create index household_expense_attributions_category_id_idx on public.household_expense_attributions (household_category_id);

create trigger household_expense_attributions_set_updated_at
  before update on public.household_expense_attributions
  for each row execute function public.set_updated_at();

create trigger household_expense_attributions_prevent_identity_changes
  before update on public.household_expense_attributions
  for each row execute function public.prevent_immutable_column_changes(
    'transaction_id', 'household_id', 'created_by'
  );

alter table public.household_expense_attributions enable row level security;

-- Visible to the underlying transaction's own PERSONAL owner (who keeps
-- permanent visibility into their own attribution row even after leaving
-- the household — the same "personal data belongs to its owner forever"
-- rule as every other PERSONAL resource), or to any CURRENT member of the
-- attributed household (day-to-day household finance is member-level, see
-- docs/DOMAIN_RULES.md "Security").
create policy household_expense_attributions_select
  on public.household_expense_attributions for select
  using (
    exists (
      select 1 from public.transactions t
      where t.id = household_expense_attributions.transaction_id
        and t.owner_user_id = auth.uid()
    )
    or public.is_household_member(household_expense_attributions.household_id)
  );

-- No INSERT/UPDATE/DELETE grant to authenticated at all: every write goes
-- through create_attributed_household_expense / update_attributed_household_expense
-- (both SECURITY DEFINER), matching the transaction_tags/expense_adjustments
-- lockdown pattern already used throughout this schema.
grant select on public.household_expense_attributions to authenticated;

-- ---------------------------------------------------------------------
-- household_attributed_expense_effects: the one canonical shared view of
-- every ledger effect that should count toward a household's attributed
-- spend — the original attributed expense PLUS any refund/reimbursement
-- later posted against it (Phase D adjustments carry no attribution row
-- of their own; they must inherit the original's household_id/category
-- here so a refund correctly reduces household spend without a duplicate
-- attribution row).
--
-- Deliberately a PLAIN view with security_invoker = true (not a function,
-- not repeated CTEs, and not owner-privileged): queried from an INVOKER
-- context (get_finance_reports, get_budget_summary's helper, etc.) it
-- evaluates RLS as the CALLING user, so a non-owner, non-member caller
-- sees nothing (safe for personal-exclusion checks everywhere). Queried
-- from inside a SECURITY DEFINER function that has already performed its
-- own explicit membership check (get_household_expense_activity,
-- get_household_attributed_expense_rows below), it evaluates RLS as the
-- function's elevated role, which is what makes cross-member household
-- visibility possible at all.
-- ---------------------------------------------------------------------

create view public.household_attributed_expense_effects
with (security_invoker = true)
as
  with originals as (
    select
      t.id as transaction_id,
      hea.household_id,
      hea.household_category_id,
      w.currency,
      e.amount,
      t.occurred_at,
      t.deleted_at,
      t.owner_user_id as payer_user_id,
      hea.transaction_id as original_transaction_id
    from public.household_expense_attributions hea
    join public.transactions t on t.id = hea.transaction_id
    join public.transaction_entries e on e.transaction_id = t.id
    join public.wallets w on w.id = e.wallet_id
  ), adjustments as (
    select
      adj_t.id as transaction_id,
      hea.household_id,
      hea.household_category_id,
      w.currency,
      e.amount,
      adj_t.occurred_at,
      adj_t.deleted_at,
      orig_t.owner_user_id as payer_user_id,
      hea.transaction_id as original_transaction_id
    from public.expense_adjustments ea
    join public.household_expense_attributions hea on hea.transaction_id = ea.original_expense_transaction_id
    join public.transactions adj_t on adj_t.id = ea.transaction_id
    join public.transactions orig_t on orig_t.id = ea.original_expense_transaction_id
    join public.transaction_entries e on e.transaction_id = adj_t.id
    join public.wallets w on w.id = e.wallet_id
  )
  select * from originals
  union all
  select * from adjustments;

comment on view public.household_attributed_expense_effects is
  'Every ledger effect (original attributed expense + any refund/reimbursement against it) that should count toward a household''s attributed spend. amount follows the raw ledger sign convention (negative = expense, positive = refund/reimbursement) so sum(-amount) nets correctly, exactly like every other EXPENSE aggregate in this schema. security_invoker = true: RLS is evaluated as the querying role, not the view owner — see migration header for why this is load-bearing.';

grant select on public.household_attributed_expense_effects to authenticated;

-- ---------------------------------------------------------------------
-- get_household_attributed_expense_rows: narrowly-scoped SECURITY DEFINER
-- helper. Explicitly re-verifies the CALLER's CURRENT membership in
-- p_household_id (never the payer's), then returns the raw effect rows
-- for that household in a date range — used by get_budget_summary and
-- get_finance_reports (household branch) so a household's attributed
-- spend is visible to every current member, not only the payer (whose
-- own PERSONAL transaction row is otherwise invisible to everyone else
-- under ordinary RLS). A departed payer's historical attributed expense
-- still counts here for current members; a departed member calling this
-- for a household they left gets rejected outright.
-- ---------------------------------------------------------------------

create function public.get_household_attributed_expense_rows(
  p_household_id uuid,
  p_from timestamptz,
  p_to timestamptz
)
returns table (
  transaction_id uuid,
  household_category_id uuid,
  currency text,
  amount numeric,
  occurred_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  -- Null household_id (a PERSONAL-scope caller, e.g. get_finance_reports
  -- passing p_household_id = null) has nothing to check — return an empty
  -- set rather than raising, so callers that unconditionally invoke this
  -- helper for both scopes never need to special-case the null branch.
  if p_household_id is null then
    return;
  end if;

  if not public.is_household_member(p_household_id) then
    raise exception 'Household % not found or not authorized', p_household_id using errcode = '42501';
  end if;

  return query
    select v.transaction_id, v.household_category_id, v.currency, v.amount, v.occurred_at
    from public.household_attributed_expense_effects v
    where v.household_id = p_household_id
      and v.deleted_at is null
      and v.occurred_at >= p_from
      and v.occurred_at < p_to;
end;
$$;

comment on function public.get_household_attributed_expense_rows(uuid, timestamptz, timestamptz) is
  'SECURITY DEFINER: re-checks the CALLING user''s CURRENT household membership, then returns raw attributed-expense effect rows (originals + refunds/reimbursements) for that household/date range, bypassing the PERSONAL transaction RLS that would otherwise hide a fellow member''s payer transaction. Never trusts the payer''s own membership — only the caller''s, verified fresh on every call.';

revoke execute on function public.get_household_attributed_expense_rows(uuid, timestamptz, timestamptz) from public, anon;
grant execute on function public.get_household_attributed_expense_rows(uuid, timestamptz, timestamptz) to authenticated;

-- ---------------------------------------------------------------------
-- create_attributed_household_expense: the one creation path for a
-- personal-funded household expense. Always writes a PERSONAL EXPENSE
-- transaction (category_id NULL) plus its attribution row, atomically.
-- No p_tag_ids parameter: V1 hides the personal tag picker entirely for
-- this path (an attributed transaction's scope is PERSONAL, so
-- assign_transaction_tags would only ever offer the payer's own personal
-- tags, which would misleadingly suggest a personal-only classification
-- alongside a household attribution).
-- ---------------------------------------------------------------------

create function public.create_attributed_household_expense(
  p_household_id uuid,
  p_household_category_id uuid,
  p_wallet_id uuid,
  p_pocket_id uuid,
  p_amount numeric,
  p_title text default null,
  p_note text default null,
  p_occurred_at timestamptz default now()
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_wallet public.wallets%rowtype;
  v_pocket public.pockets%rowtype;
  v_category public.categories%rowtype;
  v_transaction_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be a positive number' using errcode = '22023';
  end if;

  if not public.is_household_member(p_household_id) then
    raise exception 'Household % not found or not authorized', p_household_id using errcode = '42501';
  end if;

  if not public.is_wallet_authorized(p_wallet_id) then
    raise exception 'Wallet % not found or not authorized', p_wallet_id using errcode = '42501';
  end if;

  select * into v_wallet from public.wallets where id = p_wallet_id;

  -- The funding source must be the payer's own PERSONAL wallet — a
  -- household wallet paying a household expense needs no attribution at
  -- all (create_income_expense_transaction already covers it directly).
  if v_wallet.scope <> 'PERSONAL' or v_wallet.owner_user_id <> auth.uid() then
    raise exception 'Wallet % is not a personal wallet owned by the caller', p_wallet_id using errcode = '23514';
  end if;

  if v_wallet.is_archived then
    raise exception 'Wallet % is archived and cannot receive new transactions', p_wallet_id using errcode = '23514';
  end if;

  select * into v_pocket from public.pockets where id = p_pocket_id;
  if not found then
    raise exception 'Pocket % not found', p_pocket_id using errcode = 'P0002';
  end if;
  if v_pocket.wallet_id <> p_wallet_id then
    raise exception 'Pocket % does not belong to wallet %', p_pocket_id, p_wallet_id using errcode = '23514';
  end if;
  if v_pocket.is_archived then
    raise exception 'Pocket % is archived and cannot receive new transactions', p_pocket_id using errcode = '23514';
  end if;

  select * into v_category from public.categories where id = p_household_category_id;
  if not found then
    raise exception 'Category % not found or not accessible', p_household_category_id using errcode = 'P0002';
  end if;
  if v_category.transaction_type <> 'EXPENSE' then
    raise exception 'Category % is not an EXPENSE category', p_household_category_id using errcode = '23514';
  end if;
  if v_category.archived_at is not null then
    raise exception 'Category % is archived and cannot be used for new transactions', p_household_category_id
      using errcode = '23514';
  end if;
  if not v_category.is_system and v_category.household_id is distinct from p_household_id then
    raise exception 'Category % does not belong to household %', p_household_category_id, p_household_id
      using errcode = '23514';
  end if;

  -- The transaction stays PERSONAL end to end: owner_user_id = auth.uid(),
  -- household_id NULL, category_id NULL (Option C — see migration header).
  insert into public.transactions (
    scope, owner_user_id, household_id, transaction_type, category_id,
    title, note, occurred_at, created_by
  )
  values (
    'PERSONAL', auth.uid(), null, 'EXPENSE', null,
    p_title, p_note, coalesce(p_occurred_at, now()), auth.uid()
  )
  returning id into v_transaction_id;

  insert into public.transaction_entries (transaction_id, wallet_id, pocket_id, amount)
  values (v_transaction_id, p_wallet_id, p_pocket_id, -p_amount);

  insert into public.household_expense_attributions (transaction_id, household_id, household_category_id, created_by)
  values (v_transaction_id, p_household_id, p_household_category_id, auth.uid());

  return v_transaction_id;
end;
$$;

comment on function public.create_attributed_household_expense(uuid, uuid, uuid, uuid, numeric, text, text, timestamptz) is
  'SECURITY DEFINER: atomically creates a PERSONAL EXPENSE transaction (category_id NULL) funded from the caller''s own personal wallet, attributed to a household via household_expense_attributions. Requires the caller be a current member of the household and the owner of the funding wallet.';

revoke execute on function public.create_attributed_household_expense(uuid, uuid, uuid, uuid, numeric, text, text, timestamptz) from public, anon;
grant execute on function public.create_attributed_household_expense(uuid, uuid, uuid, uuid, numeric, text, text, timestamptz) to authenticated;

-- ---------------------------------------------------------------------
-- update_attributed_household_expense: the one edit path for an
-- attributed expense. update_income_expense_transaction (redefined below)
-- rejects these transactions outright, so this RPC is the only way to
-- correct one — it can change the funding pocket, amount, household
-- category, title, note, and occurred_at, but never the wallet, the
-- household, or the PERSONAL scope/owner. Mirrors
-- update_income_expense_transaction's own validation and refund-floor
-- rules exactly, plus validates the new household_category_id the same
-- way create_attributed_household_expense does.
-- ---------------------------------------------------------------------

create function public.update_attributed_household_expense(
  p_transaction_id uuid,
  p_pocket_id uuid,
  p_household_category_id uuid,
  p_amount numeric,
  p_title text default null,
  p_note text default null,
  p_occurred_at timestamptz default now()
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_transaction public.transactions%rowtype;
  v_attribution public.household_expense_attributions%rowtype;
  v_entry public.transaction_entries%rowtype;
  v_pocket public.pockets%rowtype;
  v_category public.categories%rowtype;
  v_active_adjustment_total numeric(14, 2);
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be a positive number' using errcode = '22023';
  end if;

  if not public.is_transaction_authorized(p_transaction_id) then
    raise exception 'Transaction % not found or not authorized', p_transaction_id using errcode = '42501';
  end if;

  select * into v_transaction from public.transactions where id = p_transaction_id for update;

  if v_transaction.transaction_type <> 'EXPENSE' then
    raise exception 'Only an EXPENSE transaction can be an attributed household expense; % is a %',
      p_transaction_id, v_transaction.transaction_type
      using errcode = '22023';
  end if;

  if v_transaction.deleted_at is not null then
    raise exception 'Transaction % is voided and cannot be edited; restore it first', p_transaction_id
      using errcode = '22023';
  end if;

  if exists (select 1 from public.expense_adjustments where transaction_id = p_transaction_id) then
    raise exception 'A refund/reimbursement is immutable — void it and create a corrected one instead' using errcode = '22023';
  end if;

  select * into v_attribution from public.household_expense_attributions where transaction_id = p_transaction_id;
  if not found then
    raise exception 'Transaction % is not an attributed household expense; use update_income_expense_transaction instead', p_transaction_id
      using errcode = '22023';
  end if;

  select * into v_entry from public.transaction_entries where transaction_id = p_transaction_id;
  if not found then
    raise exception 'Transaction % has no ledger entry', p_transaction_id using errcode = 'P0002';
  end if;

  select * into v_pocket from public.pockets where id = p_pocket_id;
  if not found then
    raise exception 'Pocket % not found', p_pocket_id using errcode = 'P0002';
  end if;
  if v_pocket.wallet_id <> v_entry.wallet_id then
    raise exception 'Pocket % does not belong to this transaction''s wallet; moving a transaction between wallets is not supported', p_pocket_id
      using errcode = '23514';
  end if;
  if v_pocket.is_archived then
    raise exception 'Pocket % is archived and cannot receive transactions', p_pocket_id using errcode = '23514';
  end if;

  if p_household_category_id is distinct from v_attribution.household_category_id then
    select * into v_category from public.categories where id = p_household_category_id;
    if not found then
      raise exception 'Category % not found or not accessible', p_household_category_id using errcode = 'P0002';
    end if;
    if v_category.transaction_type <> 'EXPENSE' then
      raise exception 'Category % is not an EXPENSE category', p_household_category_id using errcode = '23514';
    end if;
    if v_category.archived_at is not null then
      raise exception 'Category % is archived and cannot be used for new transactions', p_household_category_id
        using errcode = '23514';
    end if;
    if not v_category.is_system and v_category.household_id is distinct from v_attribution.household_id then
      raise exception 'Category % does not belong to household %', p_household_category_id, v_attribution.household_id
        using errcode = '23514';
    end if;
  end if;

  v_active_adjustment_total := public.get_expense_adjustment_total(p_transaction_id);
  if v_active_adjustment_total > 0 and p_amount < v_active_adjustment_total then
    raise exception 'Amount cannot be reduced below % — that much has already been refunded/reimbursed against this expense',
      v_active_adjustment_total
      using errcode = '23514';
  end if;

  update public.transactions
  set title = p_title,
      note = p_note,
      occurred_at = coalesce(p_occurred_at, occurred_at)
  where id = p_transaction_id;

  update public.transaction_entries
  set pocket_id = p_pocket_id,
      amount = -p_amount
  where id = v_entry.id;

  update public.household_expense_attributions
  set household_category_id = p_household_category_id
  where transaction_id = p_transaction_id;

  return p_transaction_id;
end;
$$;

comment on function public.update_attributed_household_expense(uuid, uuid, uuid, numeric, text, text, timestamptz) is
  'SECURITY DEFINER: the only edit path for an attributed household expense (update_income_expense_transaction rejects these outright). Can change pocket/amount/household_category_id/title/note/occurred_at; wallet, household, and PERSONAL scope/owner stay frozen. Same refund-floor rule as update_income_expense_transaction.';

revoke execute on function public.update_attributed_household_expense(uuid, uuid, uuid, numeric, text, text, timestamptz) from public, anon;
grant execute on function public.update_attributed_household_expense(uuid, uuid, uuid, numeric, text, text, timestamptz) to authenticated;

-- ---------------------------------------------------------------------
-- get_household_expense_activity: the read model for a household's list
-- of personal-funded expenses attributed to it. SECURITY DEFINER,
-- narrowly scoped to this one read — re-verifies the CALLER's CURRENT
-- membership before returning anything, exactly like
-- get_household_attributed_expense_rows above (this function delegates to
-- it for the raw effect rows, then joins presentation fields).
-- ---------------------------------------------------------------------

create function public.get_household_expense_activity(
  p_household_id uuid,
  p_from timestamptz,
  p_to timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
stable
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if not public.is_household_member(p_household_id) then
    raise exception 'Household % not found or not authorized', p_household_id using errcode = '42501';
  end if;

  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'transaction_id', v.transaction_id,
        'original_transaction_id', v.original_transaction_id,
        'is_adjustment', v.transaction_id <> v.original_transaction_id,
        'category_id', v.household_category_id,
        'category_name', coalesce(c.name, 'ไม่ทราบหมวดหมู่'),
        'currency', v.currency,
        'amount', v.amount::text,
        'occurred_at', v.occurred_at,
        'payer_user_id', v.payer_user_id,
        'payer_display_name', coalesce(p.display_name, 'ไม่ทราบชื่อ')
      )
      order by v.occurred_at desc, v.transaction_id
    )
    from public.household_attributed_expense_effects v
    left join public.categories c on c.id = v.household_category_id
    left join public.profiles p on p.id = v.payer_user_id
    where v.household_id = p_household_id
      and v.deleted_at is null
      and v.occurred_at >= p_from
      and v.occurred_at < p_to
  ), '[]'::jsonb);
end;
$$;

comment on function public.get_household_expense_activity(uuid, timestamptz, timestamptz) is
  'SECURITY DEFINER: re-checks the CALLER''s CURRENT household membership, then lists every attributed-expense effect (originals + refunds/reimbursements) for that household/date range with payer and category labels. A departed payer''s historical activity remains visible to current members; a departed caller is rejected outright.';

revoke execute on function public.get_household_expense_activity(uuid, timestamptz, timestamptz) from public, anon;
grant execute on function public.get_household_expense_activity(uuid, timestamptz, timestamptz) to authenticated;

-- ---------------------------------------------------------------------
-- update_income_expense_transaction: CREATE OR REPLACE (same signature as
-- 0033 — no argument list change) adding one guard. This RPC is directly
-- client-callable, so the bypass risk must be closed here, not only by
-- routing the UI away from it: an attributed expense's category lives in
-- household_expense_attributions, not transactions.category_id, so this
-- generic editor must never touch it.
-- ---------------------------------------------------------------------

create or replace function public.update_income_expense_transaction(
  p_transaction_id uuid,
  p_pocket_id uuid,
  p_category_id uuid,
  p_amount numeric,
  p_title text default null,
  p_note text default null,
  p_occurred_at timestamptz default now(),
  p_tag_ids uuid[] default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_transaction public.transactions%rowtype;
  v_entry public.transaction_entries%rowtype;
  v_wallet public.wallets%rowtype;
  v_pocket public.pockets%rowtype;
  v_category public.categories%rowtype;
  v_signed_amount numeric(14, 2);
  v_active_adjustment_total numeric(14, 2);
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be a positive number' using errcode = '22023';
  end if;

  if not public.is_transaction_authorized(p_transaction_id) then
    raise exception 'Transaction % not found or not authorized', p_transaction_id using errcode = '42501';
  end if;

  select * into v_transaction from public.transactions where id = p_transaction_id for update;

  if v_transaction.transaction_type not in ('INCOME', 'EXPENSE') then
    raise exception 'Only INCOME or EXPENSE transactions can be edited this way; % is a %',
      p_transaction_id, v_transaction.transaction_type
      using errcode = '22023';
  end if;

  if v_transaction.deleted_at is not null then
    raise exception 'Transaction % is voided and cannot be edited; restore it first', p_transaction_id
      using errcode = '22023';
  end if;

  if exists (select 1 from public.expense_adjustments where transaction_id = p_transaction_id) then
    raise exception 'A refund/reimbursement is immutable — void it and create a corrected one instead' using errcode = '22023';
  end if;

  if exists (select 1 from public.household_expense_attributions where transaction_id = p_transaction_id) then
    raise exception 'Transaction % is an attributed household expense — use update_attributed_household_expense instead', p_transaction_id
      using errcode = '22023';
  end if;

  -- INCOME/EXPENSE always has exactly one ledger entry (0010); that entry's
  -- wallet_id is this transaction's wallet and is never itself editable.
  select * into v_entry from public.transaction_entries where transaction_id = p_transaction_id;
  if not found then
    raise exception 'Transaction % has no ledger entry', p_transaction_id using errcode = 'P0002';
  end if;

  select * into v_wallet from public.wallets where id = v_entry.wallet_id;

  select * into v_pocket from public.pockets where id = p_pocket_id;
  if not found then
    raise exception 'Pocket % not found', p_pocket_id using errcode = 'P0002';
  end if;
  if v_pocket.wallet_id <> v_entry.wallet_id then
    raise exception 'Pocket % does not belong to this transaction''s wallet; moving a transaction between wallets is not supported', p_pocket_id
      using errcode = '23514';
  end if;
  if v_pocket.is_archived then
    raise exception 'Pocket % is archived and cannot receive transactions', p_pocket_id using errcode = '23514';
  end if;

  if p_category_id is distinct from v_transaction.category_id then
    select * into v_category from public.categories where id = p_category_id;
    if not found then
      raise exception 'Category % not found or not accessible', p_category_id using errcode = 'P0002';
    end if;

    if v_category.transaction_type::text <> v_transaction.transaction_type::text then
      raise exception 'Category % is a % category and cannot be used for a % transaction',
        p_category_id, v_category.transaction_type, v_transaction.transaction_type
        using errcode = '23514';
    end if;

    if v_category.archived_at is not null then
      raise exception 'Category % is archived and cannot be used for new transactions', p_category_id
        using errcode = '23514';
    end if;

    if not v_category.is_system and (
      v_category.scope <> v_wallet.scope
      or v_category.owner_user_id is distinct from v_wallet.owner_user_id
      or v_category.household_id is distinct from v_wallet.household_id
    ) then
      raise exception 'Category % does not belong to the same owner/household as wallet %', p_category_id, v_wallet.id
        using errcode = '23514';
    end if;
  end if;

  v_active_adjustment_total := public.get_expense_adjustment_total(p_transaction_id);
  if v_active_adjustment_total > 0 and p_amount < v_active_adjustment_total then
    raise exception 'Amount cannot be reduced below % — that much has already been refunded/reimbursed against this expense',
      v_active_adjustment_total
      using errcode = '23514';
  end if;

  v_signed_amount := case when v_transaction.transaction_type = 'INCOME' then p_amount else -p_amount end;

  update public.transactions
  set category_id = p_category_id,
      title = p_title,
      note = p_note,
      occurred_at = coalesce(p_occurred_at, occurred_at)
  where id = p_transaction_id;

  update public.transaction_entries
  set pocket_id = p_pocket_id,
      amount = v_signed_amount
  where id = v_entry.id;

  if p_tag_ids is not null then
    perform public.assign_transaction_tags(p_transaction_id, p_tag_ids);
  end if;

  return p_transaction_id;
end;
$$;

comment on function public.update_income_expense_transaction(uuid, uuid, uuid, numeric, text, text, timestamptz, uuid[]) is
  'SECURITY DEFINER: atomically corrects an INCOME/EXPENSE transaction, rebuilds its single ledger entry, and (when p_tag_ids is not null) replaces its tag set. Refuses to edit a refund/reimbursement, refuses to reduce an EXPENSE below its active adjustment total (0033), and refuses to edit an attributed household expense at all (0051) — use update_attributed_household_expense for those. Wallet and transaction_type remain immutable.';

-- ---------------------------------------------------------------------
-- get_budget_summary: CREATE OR REPLACE (same signature). Fixes a
-- pre-existing bug (spent previously joined on category_id + currency
-- only, with no scope/owner/household match at all — a PERSONAL expense
-- against a system category could contaminate a HOUSEHOLD budget on the
-- same category/currency, and vice versa) AND adds attributed household
-- expense effects to HOUSEHOLD budgets via the narrowly-scoped
-- get_household_attributed_expense_rows helper (so the contribution is
-- visible to every current member, not only the payer). Currency never
-- crosses: an attributed effect only contributes when its own currency
-- (the funding wallet's currency) matches the budget's currency exactly —
-- no FX, matching every other cross-currency rule in this schema.
-- ---------------------------------------------------------------------

create or replace function public.get_budget_summary(p_period_month date, p_month_start timestamptz, p_month_end timestamptz)
returns jsonb
language sql
security invoker
set search_path = public
stable
as $$
  with active_budgets as (
    select
      b.id,
      b.scope,
      b.owner_user_id,
      b.household_id,
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
  ), ordinary_spent as (
    select
      ab.id as budget_id,
      coalesce(sum(-e.amount) filter (where t.transaction_type = 'EXPENSE'), 0) as amount
    from active_budgets ab
    join public.transactions t on t.category_id = ab.category_id
      and t.deleted_at is null
      and t.occurred_at >= p_month_start
      and t.occurred_at < p_month_end
      and t.scope = ab.scope
      and (
        (ab.scope = 'PERSONAL' and t.owner_user_id = ab.owner_user_id)
        or (ab.scope = 'HOUSEHOLD' and t.household_id = ab.household_id)
      )
    join public.transaction_entries e on e.transaction_id = t.id
    join public.wallets w on w.id = e.wallet_id and w.currency = ab.currency
    group by ab.id
  ), household_budgets as (
    select * from active_budgets where scope = 'HOUSEHOLD'
  ), attributed_spent as (
    -- Only invoked for HOUSEHOLD budgets: get_household_attributed_expense_rows
    -- requires a non-null household_id (it raises when the caller is not a
    -- member of it), so a PERSONAL budget's null household_id must never
    -- reach this call at all.
    select
      hb.id as budget_id,
      coalesce(sum(-r.amount), 0) as amount
    from household_budgets hb
    cross join lateral public.get_household_attributed_expense_rows(hb.household_id, p_month_start, p_month_end) r
    where r.household_category_id = hb.category_id
      and r.currency = hb.currency
    group by hb.id
  ), spent as (
    select
      ab.id as budget_id,
      coalesce(os.amount, 0) + coalesce(ats.amount, 0) as net_spent
    from active_budgets ab
    left join ordinary_spent os on os.budget_id = ab.id
    left join attributed_spent ats on ats.budget_id = ab.id
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
  'RLS-scoped: every Budget for one exact period_month, with live net_spent/remaining. Fixed (0051) to match on scope + owner/household, not just category_id + currency, closing a pre-existing PERSONAL/HOUSEHOLD budget-contamination bug on shared system categories. HOUSEHOLD budgets additionally include personal-funded attributed expenses (0051) via get_household_attributed_expense_rows, visible to every current member. net_spent is never clamped.';

-- ---------------------------------------------------------------------
-- get_finance_reports: CREATE OR REPLACE (same signature). PERSONAL calls
-- exclude any transaction that is an attributed original or a refund/
-- reimbursement against one (it has no personal category and is not the
-- payer's own spending classification any more). HOUSEHOLD calls
-- additionally union in every attributed effect for that household via
-- the same get_household_attributed_expense_rows helper used by budgets —
-- all attributed effects are EXPENSE-typed by construction (refunds are
-- already EXPENSE-typed rows per Phase D convention), so no new
-- transaction_type branching is needed.
-- ---------------------------------------------------------------------

create or replace function public.get_finance_reports(p_scope public.money_scope,p_household_id uuid,p_start timestamptz,p_end timestamptz)
returns jsonb language sql security invoker stable set search_path='' as $$
with base as(
 select t.id,t.transaction_type,t.category_id,t.occurred_at,w.currency,e.amount
 from public.transactions t join public.transaction_entries e on e.transaction_id=t.id join public.wallets w on w.id=e.wallet_id
 where t.deleted_at is null and t.transaction_type in('INCOME','EXPENSE') and t.occurred_at>=p_start and t.occurred_at<p_end
 and t.scope=p_scope and(p_scope='PERSONAL'or t.household_id=p_household_id)
 and not exists(select 1 from public.household_attributed_expense_effects v where v.transaction_id=t.id)
 union all
 select r.transaction_id,'EXPENSE'::public.transaction_type,r.household_category_id,r.occurred_at,r.currency,r.amount
 from public.get_household_attributed_expense_rows(p_household_id,p_start,p_end) r
 where p_scope='HOUSEHOLD'
),months as(
 select to_char(date_trunc('month',occurred_at at time zone 'Asia/Bangkok'),'YYYY-MM') as month_key,currency,
 coalesce(sum(amount) filter (where transaction_type='INCOME'),0)::text as income,
 coalesce(sum(-amount) filter (where transaction_type='EXPENSE'),0)::text as expense
 from base group by 1,currency order by 1,currency
),categories as(
 select b.transaction_type,b.category_id,coalesce(c.name,'ไม่ทราบหมวดหมู่') as name,b.currency,
 (case when b.transaction_type='EXPENSE'then sum(-b.amount)else sum(b.amount)end)::text as amount
 from base b left join public.categories c on c.id=b.category_id
 group by b.transaction_type,b.category_id,c.name,b.currency order by b.transaction_type,b.currency,sum(abs(b.amount))desc
)
select jsonb_build_object(
 'months',coalesce((select jsonb_agg(jsonb_build_object('month',month_key,'currency',currency,'income',income,'expense',expense) order by month_key,currency) from months),'[]'::jsonb),
 'categories',coalesce((select jsonb_agg(jsonb_build_object('type',transaction_type,'category_id',category_id,'name',name,'currency',currency,'amount',amount))from categories),'[]'::jsonb)
)
$$;

comment on function public.get_finance_reports(public.money_scope,uuid,timestamptz,timestamptz) is
  'RLS-scoped report. Fixed (0051): PERSONAL calls exclude attributed household expenses and their refunds/reimbursements (no longer the payer''s own spending classification); HOUSEHOLD calls include them via get_household_attributed_expense_rows, visible to every current member regardless of payer.';

-- ---------------------------------------------------------------------
-- get_finance_hub_summary: CREATE OR REPLACE (same signature). Only the
-- monthly income/expense and top-5 category totals (the payer's own
-- personal spending classification) exclude attributed expenses.
-- wallet_balances/currency_totals stay untouched — the cash genuinely
-- left the wallet, so the real balance must still reflect it.
-- ---------------------------------------------------------------------

create or replace function public.get_finance_hub_summary(p_month_start timestamptz, p_month_end timestamptz)
returns jsonb
language sql
security invoker
set search_path = ''
stable
as $$
  with wallet_balances as (
    select w.id, w.currency, coalesce(sum(e.amount) filter (where t.deleted_at is null), 0) as amount
    from public.wallets w
    left join public.transaction_entries e on e.wallet_id = w.id
    left join public.transactions t on t.id = e.transaction_id
    where not w.is_archived
    group by w.id, w.currency
  ), currency_totals as (
    select currency, sum(amount)::text as amount from wallet_balances group by currency order by currency
  ), monthly_entries as (
    select w.currency, t.transaction_type, e.amount
    from public.transactions t
    join public.transaction_entries e on e.transaction_id = t.id
    join public.wallets w on w.id = e.wallet_id
    where t.deleted_at is null
      and t.occurred_at >= p_month_start and t.occurred_at < p_month_end
      and t.transaction_type in ('INCOME', 'EXPENSE')
      and not exists (select 1 from public.household_attributed_expense_effects v where v.transaction_id = t.id)
  ), monthly as (
    select
      currency,
      coalesce(sum(amount) filter (where transaction_type = 'INCOME'), 0)::text as income,
      coalesce(sum(-amount) filter (where transaction_type = 'EXPENSE'), 0)::text as expense
    from monthly_entries
    group by currency
  ), category_entries as (
    select t.category_id, coalesce(c.name, 'ไม่ทราบหมวดหมู่') as name, w.currency, e.amount
    from public.transactions t
    join public.transaction_entries e on e.transaction_id = t.id
    join public.wallets w on w.id = e.wallet_id
    left join public.categories c on c.id = t.category_id
    where t.deleted_at is null and t.transaction_type = 'EXPENSE'
      and t.occurred_at >= p_month_start and t.occurred_at < p_month_end
      and not exists (select 1 from public.household_attributed_expense_effects v where v.transaction_id = t.id)
  ), category_totals as (
    select category_id, name, currency, sum(-amount)::text as amount
    from category_entries
    group by category_id, name, currency
    order by sum(-amount) desc, name
    limit 5
  )
  select jsonb_build_object(
    'wallet_balances', coalesce((select jsonb_agg(jsonb_build_object('wallet_id', id, 'currency', currency, 'amount', amount::text) order by id) from wallet_balances), '[]'::jsonb),
    'currency_totals', coalesce((select jsonb_agg(jsonb_build_object('currency', currency, 'amount', amount) order by currency) from currency_totals), '[]'::jsonb),
    'month_totals', coalesce((select jsonb_agg(jsonb_build_object('currency', currency, 'income', income, 'expense', expense) order by currency) from monthly), '[]'::jsonb),
    'category_totals', coalesce((select jsonb_agg(jsonb_build_object('category_id', category_id, 'name', name, 'currency', currency, 'amount', amount)) from category_totals), '[]'::jsonb)
  );
$$;

comment on function public.get_finance_hub_summary(timestamptz, timestamptz) is
  'RLS-scoped derived wallet balances plus current-period income/expense and top-5 expense-category totals. Fixed (0051): monthly/category totals exclude attributed household expenses and their refunds/reimbursements, since those no longer represent the payer''s own personal spending classification; wallet_balances/currency_totals are untouched (the cash genuinely left the wallet).';

-- ---------------------------------------------------------------------
-- get_finance_insights: CREATE OR REPLACE (same signature). Excludes
-- attributed household expenses and their refunds/reimbursements from the
-- expenses CTE, for the same reason as the hub summary above. This
-- function has no scope parameter at all (a pre-existing, documented
-- limitation independent of this feature — see docs/DATABASE.md) and is
-- not otherwise touched.
-- ---------------------------------------------------------------------

create or replace function public.get_finance_insights(p_current_start timestamptz,p_current_end timestamptz,p_previous_start timestamptz,p_today date)
returns table(insight_type text,currency text,current_amount numeric,comparison_amount numeric,reference_id uuid,label text)
language sql security invoker stable set search_path='' as $$
with expenses as(
 select t.id,t.title,w.currency,-sum(e.amount) as amount,t.occurred_at
 from public.transactions as t
 join public.transaction_entries as e on e.transaction_id=t.id
 join public.wallets as w on w.id=e.wallet_id
 where t.deleted_at is null and t.transaction_type='EXPENSE'
 and not exists(select 1 from public.household_attributed_expense_effects v where v.transaction_id=t.id)
 group by t.id,w.currency
),ranked as(
 select expenses.*,row_number() over(partition by expenses.currency order by expenses.amount desc,expenses.id) as rank_number
 from expenses where expenses.occurred_at>=p_current_start and expenses.occurred_at<p_current_end
),months as(
 select expenses.currency,
  coalesce(sum(expenses.amount) filter (where expenses.occurred_at>=p_current_start and expenses.occurred_at<p_current_end),0) as current_amount,
  coalesce(sum(expenses.amount) filter (where expenses.occurred_at>=p_previous_start and expenses.occurred_at<p_current_start),0) as previous_amount
 from expenses group by expenses.currency
),bills_due as(
 select b.currency,sum(o.expected_amount) as amount,(array_agg(o.id order by o.due_date,o.id))[1] as id
 from public.bill_occurrences as o join public.bills as b on b.id=o.bill_id
 where o.status='OPEN'and o.due_date>=p_today and o.due_date<p_today+30
 group by b.currency
),debts as(
 select d.currency,
  sum(case when ev.event_kind in('DRAW','DISBURSEMENT')then ev.principal_amount else -ev.principal_amount end)
   filter (where t.deleted_at is null and d.debt_type='LIABILITY') as amount,
  (array_agg(d.id order by d.id))[1] as id
 from public.debt_accounts as d
 left join public.debt_events as ev on ev.debt_account_id=d.id
 left join public.transactions as t on t.id=ev.principal_transaction_id
 group by d.currency
),insights(insight_type,currency,current_amount,comparison_amount,reference_id,label) as(
 select 'LARGEST_EXPENSE'::text,ranked.currency,ranked.amount,null::numeric,ranked.id,coalesce(ranked.title,'รายจ่าย')::text
 from ranked where ranked.rank_number=1
 union all
 select 'MONTH_COMPARISON'::text,months.currency,months.current_amount,months.previous_amount,null::uuid,'รายจ่ายเดือนนี้เทียบเดือนก่อน'::text
 from months
 union all
 select 'UPCOMING_BILLS'::text,bills_due.currency,bills_due.amount,null::numeric,bills_due.id,'บิล 30 วันข้างหน้า'::text
 from bills_due
 union all
 select 'LIABILITY_TOTAL'::text,debts.currency,coalesce(debts.amount,0),null::numeric,debts.id,'หนี้คงเหลือ'::text
 from debts
)
select i.insight_type,i.currency,i.current_amount,i.comparison_amount,i.reference_id,i.label
from insights as i
order by i.insight_type,i.currency
$$;

comment on function public.get_finance_insights(timestamptz,timestamptz,timestamptz,date) is
  'Deterministic, currency-grouped insight values. Fixed (0051): the expenses CTE excludes attributed household expenses and their refunds/reimbursements, for the same reason as get_finance_hub_summary.';

-- ---------------------------------------------------------------------
-- get_finance_export: CREATE OR REPLACE (same signature). No new
-- household-wide export mode — the payer's own export keeps its existing
-- visibility (their attributed expense still appears, since it is still
-- their own real transaction), but its category label now shows the
-- attributed household category instead of a blank/unknown category.
-- ---------------------------------------------------------------------

create or replace function public.get_finance_export(p_from timestamptz default null,p_to timestamptz default null,p_wallet_id uuid default null,p_pocket_id uuid default null,p_category_id uuid default null,p_type public.transaction_type default null,p_tag_id uuid default null)
returns table(id uuid,occurred_at timestamptz,transaction_type public.transaction_type,title text,note text,category text,wallets text,pockets text,currency text,amount numeric,tags text)
language sql security invoker stable set search_path='' as $$
 with entry_summary as(select t.id,string_agg(distinct w.name,' | ') as wallets,string_agg(distinct p.name,' | ') as pockets,min(w.currency) as currency,case when t.transaction_type='INCOME'then sum(e.amount)when t.transaction_type='EXPENSE'then sum(-e.amount)else max(abs(e.amount))end as amount from public.transactions as t join public.transaction_entries as e on e.transaction_id=t.id join public.wallets as w on w.id=e.wallet_id join public.pockets as p on p.id=e.pocket_id group by t.id)
 select t.id,t.occurred_at,t.transaction_type,t.title,t.note,
   coalesce(c.name, hc.name || ' (ครอบครัว: ' || h.name || ')'),
   s.wallets,s.pockets,s.currency,s.amount,(select string_agg(tag.name,' | 'order by tag.name)from public.transaction_tags tt join public.tags tag on tag.id=tt.tag_id where tt.transaction_id=t.id)
 from public.transactions as t join entry_summary as s on s.id=t.id
 left join public.categories as c on c.id=t.category_id
 left join public.household_expense_attributions as hea on hea.transaction_id=t.id
 left join public.categories as hc on hc.id=hea.household_category_id
 left join public.households as h on h.id=hea.household_id
 where t.deleted_at is null and(p_from is null or t.occurred_at>=p_from)and(p_to is null or t.occurred_at<p_to)and(p_category_id is null or t.category_id=p_category_id)and(p_type is null or t.transaction_type=p_type)
 and(p_wallet_id is null or exists(select 1 from public.transaction_entries x where x.transaction_id=t.id and x.wallet_id=p_wallet_id))
 and(p_pocket_id is null or exists(select 1 from public.transaction_entries x where x.transaction_id=t.id and x.pocket_id=p_pocket_id))
 and(p_tag_id is null or exists(select 1 from public.transaction_tags x where x.transaction_id=t.id and x.tag_id=p_tag_id))
 order by t.occurred_at,t.id
$$;

comment on function public.get_finance_export(timestamptz,timestamptz,uuid,uuid,uuid,public.transaction_type,uuid) is
  'RLS-scoped logical export. Fixed (0051): an attributed household expense''s category label now shows "<household category> (ครอบครัว: <household name>)" instead of a blank category. No new household-wide export mode — visibility is unchanged, only the label.';
