-- 0052_transfer_fee_and_interest.sql
-- Phase V: Transfer fee and interest. A transfer's PRINCIPAL stays a
-- TRANSFER (never income/expense, unaffected by this migration's own
-- balanced two-entry insert). An optional FEE and/or optional INTEREST
-- are each a genuinely separate, ordinary EXPENSE transaction funded from
-- the SAME source wallet/pocket as the principal, linked back to the
-- transfer via a new 1:1-extension link table — the same "side table
-- classifies/audits a real ledger posting, never a second balance" shape
-- already proven three times in this schema (expense_adjustments,
-- household_expense_attributions, and now this).
--
-- This migration also restores a real, confirmed regression: 0032's
-- `drop function` + `create function` rewrite of
-- create_income_expense_transaction / create_pocket_transfer /
-- create_wallet_transfer (done to add p_tag_ids) silently dropped the
-- wallet/pocket `is_archived` checks that 0020 had added. Verified
-- directly (`grep -c is_archived 0032_transaction_tags.sql` → exactly one
-- hit, inside update_income_expense_transaction) — none of the three
-- creation RPCs have rejected an archived wallet/pocket since 0032. This
-- migration re-adds those checks on top of 0032's bodies (tags, category
-- checks, and every other post-0020 behavior preserved verbatim), not by
-- reverting to the old 0020 bodies wholesale.

-- ---------------------------------------------------------------------
-- transfer_ledger_links
-- ---------------------------------------------------------------------

create table public.transfer_ledger_links (
  charge_transaction_id uuid primary key references public.transactions (id) on delete cascade,
  transfer_transaction_id uuid not null references public.transactions (id) on delete cascade,
  kind text not null check (kind in ('FEE', 'INTEREST')),
  created_at timestamptz not null default now(),
  constraint transfer_ledger_links_distinct_chk check (charge_transaction_id <> transfer_transaction_id)
);

comment on table public.transfer_ledger_links is
  'Marks an EXPENSE transaction (charge_transaction_id) as the FEE or INTEREST charged alongside one TRANSFER (transfer_transaction_id) — the transfer''s own two entries stay principal-only and net-worth-neutral; the fee/interest is a real, separate EXPENSE, this table only classifies/audits which transfer it belongs to. RPC-write-only (create_wallet_transfer / create_pocket_transfer); no direct INSERT/UPDATE/DELETE grant. Immutable after creation — there is no legitimate reason to ever change which transfer a charge belongs to.';
comment on column public.transfer_ledger_links.kind is
  'FEE or INTEREST. At most one of each per transfer_transaction_id (transfer_ledger_links_one_per_kind_idx) — a transfer never carries two fees or two interest charges in this version.';

-- "child transaction may be linked to only one transfer" — the PK on
-- charge_transaction_id already guarantees this (one row per charge,
-- period).
create index transfer_ledger_links_transfer_idx on public.transfer_ledger_links (transfer_transaction_id);

-- "one transfer may have at most one FEE and one INTEREST child".
create unique index transfer_ledger_links_one_per_kind_idx on public.transfer_ledger_links (transfer_transaction_id, kind);

-- Cross-table invariants (linked parent must be a TRANSFER, linked child
-- must be an EXPENSE, both must share scope/owner/household/currency)
-- cannot be plain CHECK constraints — they need to read other rows — so
-- they live in a BEFORE INSERT trigger, the same pattern already used by
-- categories_validate_hierarchy / budgets_validate_category /
-- installment_plans_validate.
create function public.transfer_ledger_links_validate()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_transfer public.transactions%rowtype;
  v_charge public.transactions%rowtype;
  v_transfer_currency text;
  v_charge_currency text;
begin
  select * into v_transfer from public.transactions where id = new.transfer_transaction_id;
  if not found or v_transfer.transaction_type <> 'TRANSFER' then
    raise exception 'transfer_transaction_id % must reference a TRANSFER transaction', new.transfer_transaction_id
      using errcode = '23514';
  end if;

  select * into v_charge from public.transactions where id = new.charge_transaction_id;
  if not found or v_charge.transaction_type <> 'EXPENSE' then
    raise exception 'charge_transaction_id % must reference an EXPENSE transaction', new.charge_transaction_id
      using errcode = '23514';
  end if;

  if v_charge.scope <> v_transfer.scope
    or v_charge.owner_user_id is distinct from v_transfer.owner_user_id
    or v_charge.household_id is distinct from v_transfer.household_id
  then
    raise exception 'Charge % does not share scope/owner/household with transfer %', new.charge_transaction_id, new.transfer_transaction_id
      using errcode = '23514';
  end if;

  select w.currency into v_transfer_currency
  from public.transaction_entries e join public.wallets w on w.id = e.wallet_id
  where e.transaction_id = new.transfer_transaction_id limit 1;

  select w.currency into v_charge_currency
  from public.transaction_entries e join public.wallets w on w.id = e.wallet_id
  where e.transaction_id = new.charge_transaction_id limit 1;

  if v_charge_currency is distinct from v_transfer_currency then
    raise exception 'Charge % currency (%) does not match transfer % currency (%); no FX conversion',
      new.charge_transaction_id, v_charge_currency, new.transfer_transaction_id, v_transfer_currency
      using errcode = '23514';
  end if;

  return new;
end;
$$;

comment on function public.transfer_ledger_links_validate() is
  'BEFORE INSERT guard: rejects a link whose parent is not a TRANSFER, whose child is not an EXPENSE, whose scope/owner/household does not match, or whose currency does not match (no FX). No UPDATE trigger needed — links carry no grant beyond INSERT (via the two transfer RPCs) and SELECT, so there is nothing else to validate.';

create trigger transfer_ledger_links_before_insert
  before insert on public.transfer_ledger_links
  for each row execute function public.transfer_ledger_links_validate();

alter table public.transfer_ledger_links enable row level security;

-- SELECT visibility follows authorization to the underlying TRANSFER —
-- by construction (the trigger above) a linked charge always shares the
-- exact same scope/owner/household as its transfer, so checking the
-- transfer side is equivalent to checking the charge side; checking the
-- transfer keeps this policy a single, simple EXISTS rather than an OR
-- across two joins.
create policy transfer_ledger_links_select
  on public.transfer_ledger_links for select
  using (
    exists (
      select 1 from public.transactions t
      where t.id = transfer_ledger_links.transfer_transaction_id
        and (
          (t.scope = 'PERSONAL' and t.owner_user_id = auth.uid())
          or
          (t.scope = 'HOUSEHOLD' and public.is_household_member(t.household_id))
        )
    )
  );

-- No INSERT/UPDATE/DELETE grant to authenticated at all — every write goes
-- through create_wallet_transfer / create_pocket_transfer (both SECURITY
-- DEFINER), matching the expense_adjustments / household_expense_attributions
-- lockdown pattern exactly.
grant select on public.transfer_ledger_links to authenticated;

-- ---------------------------------------------------------------------
-- validate_optional_charge_amount: shared shape-only validation (amount/
-- category presence and positivity) reused by both transfer RPCs for
-- both fee and interest — four call sites, one implementation. Deliberately
-- does NOT touch wallets/categories itself: the actual category-type/
-- scope/archived/currency checks are inherited for free by delegating the
-- real charge creation to the existing create_income_expense_transaction
-- (below, once its own archived checks are restored), never duplicated
-- here.
-- ---------------------------------------------------------------------

create function public.validate_optional_charge_amount(p_amount numeric, p_category_id uuid, p_label text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (p_amount is null) <> (p_category_id is null) then
    raise exception '%category requires both an amount and a category, or neither', p_label using errcode = '22023';
  end if;
  if p_amount is not null and p_amount <= 0 then
    raise exception '%amount must be a positive number', p_label using errcode = '22023';
  end if;
end;
$$;

comment on function public.validate_optional_charge_amount(numeric, uuid, text) is
  'Shape-only check for an optional transfer fee/interest charge: null+null (no charge) or both present and positive — never one without the other. Category type/scope/archived/currency validity is left entirely to create_income_expense_transaction, which the caller invokes afterward — never duplicated here.';

revoke execute on function public.validate_optional_charge_amount(numeric, uuid, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- create_income_expense_transaction: CREATE OR REPLACE, same signature as
-- 0032 (no argument change) — restores the wallet/pocket `is_archived`
-- checks 0020 added and 0032 silently dropped. Category checks, sign
-- convention, and p_tag_ids handling are otherwise byte-identical to 0032.
-- ---------------------------------------------------------------------

create or replace function public.create_income_expense_transaction(
  p_transaction_type public.transaction_type,
  p_wallet_id uuid,
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
  v_wallet public.wallets%rowtype;
  v_pocket public.pockets%rowtype;
  v_category public.categories%rowtype;
  v_signed_amount numeric(14, 2);
  v_transaction_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if p_transaction_type not in ('INCOME', 'EXPENSE') then
    raise exception 'create_income_expense_transaction only accepts INCOME or EXPENSE, got %', p_transaction_type
      using errcode = '22023';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be a positive number' using errcode = '22023';
  end if;

  if not public.is_wallet_authorized(p_wallet_id) then
    raise exception 'Wallet % not found or not authorized', p_wallet_id using errcode = '42501';
  end if;

  select * into v_wallet from public.wallets where id = p_wallet_id;

  if v_wallet.is_archived then
    raise exception 'Wallet % is archived and cannot receive new transactions', p_wallet_id using errcode = '23514';
  end if;

  select * into v_pocket from public.pockets where id = p_pocket_id;
  if not found then
    raise exception 'Pocket % not found', p_pocket_id using errcode = 'P0002';
  end if;
  if v_pocket.is_archived then
    raise exception 'Pocket % is archived and cannot receive new transactions', p_pocket_id using errcode = '23514';
  end if;

  select * into v_category from public.categories where id = p_category_id;
  if not found then
    raise exception 'Category % not found or not accessible', p_category_id using errcode = 'P0002';
  end if;

  if v_category.transaction_type::text <> p_transaction_type::text then
    raise exception 'Category % is a % category and cannot be used for a % transaction',
      p_category_id, v_category.transaction_type, p_transaction_type
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
    raise exception 'Category % does not belong to the same owner/household as wallet %', p_category_id, p_wallet_id
      using errcode = '23514';
  end if;

  v_signed_amount := case when p_transaction_type = 'INCOME' then p_amount else -p_amount end;

  insert into public.transactions (
    scope, owner_user_id, household_id, transaction_type, category_id,
    title, note, occurred_at, created_by
  )
  values (
    v_wallet.scope, v_wallet.owner_user_id, v_wallet.household_id, p_transaction_type, p_category_id,
    p_title, p_note, coalesce(p_occurred_at, now()), auth.uid()
  )
  returning id into v_transaction_id;

  insert into public.transaction_entries (transaction_id, wallet_id, pocket_id, amount)
  values (v_transaction_id, p_wallet_id, p_pocket_id, v_signed_amount);

  if p_tag_ids is not null and array_length(p_tag_ids, 1) > 0 then
    perform public.assign_transaction_tags(v_transaction_id, p_tag_ids);
  end if;

  return v_transaction_id;
end;
$$;

comment on function public.create_income_expense_transaction(public.transaction_type, uuid, uuid, uuid, numeric, text, text, timestamptz, uuid[]) is
  'SECURITY DEFINER: explicitly checks is_wallet_authorized() plus wallet/pocket archived status (restored 0052 — see migration header) before writing. Scope/owner/household are derived from the wallet, not client-supplied. p_tag_ids (0032) is optional and atomic with the create.';

-- ---------------------------------------------------------------------
-- create_pocket_transfer: DROP + CREATE (argument list changes) — restores
-- archived checks (0020, dropped by 0032) and adds optional fee/interest,
-- charged to the SAME source wallet/pocket the principal leaves from.
-- Existing callers that omit the four new parameters get byte-identical
-- behavior to 0032's version.
-- ---------------------------------------------------------------------

drop function public.create_pocket_transfer(uuid, uuid, uuid, numeric, text, text, timestamptz, uuid[]);

create function public.create_pocket_transfer(
  p_wallet_id uuid,
  p_from_pocket_id uuid,
  p_to_pocket_id uuid,
  p_amount numeric,
  p_title text default null,
  p_note text default null,
  p_occurred_at timestamptz default now(),
  p_tag_ids uuid[] default null,
  p_fee_amount numeric default null,
  p_fee_category_id uuid default null,
  p_interest_amount numeric default null,
  p_interest_category_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_wallet public.wallets%rowtype;
  v_from_pocket public.pockets%rowtype;
  v_to_pocket public.pockets%rowtype;
  v_transaction_id uuid;
  v_fee_transaction_id uuid;
  v_interest_transaction_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be a positive number' using errcode = '22023';
  end if;

  if p_from_pocket_id = p_to_pocket_id then
    raise exception 'Source and destination pocket must be different' using errcode = '22023';
  end if;

  perform public.validate_optional_charge_amount(p_fee_amount, p_fee_category_id, 'Fee ');
  perform public.validate_optional_charge_amount(p_interest_amount, p_interest_category_id, 'Interest ');

  if not public.is_wallet_authorized(p_wallet_id) then
    raise exception 'Wallet % not found or not authorized', p_wallet_id using errcode = '42501';
  end if;

  select * into v_wallet from public.wallets where id = p_wallet_id;

  if v_wallet.is_archived then
    raise exception 'Wallet % is archived and cannot receive new transactions', p_wallet_id using errcode = '23514';
  end if;

  select * into v_from_pocket from public.pockets where id = p_from_pocket_id;
  if not found then
    raise exception 'Pocket % not found', p_from_pocket_id using errcode = 'P0002';
  end if;
  if v_from_pocket.is_archived then
    raise exception 'Pocket % is archived and cannot be used in a new transfer', p_from_pocket_id using errcode = '23514';
  end if;

  select * into v_to_pocket from public.pockets where id = p_to_pocket_id;
  if not found then
    raise exception 'Pocket % not found', p_to_pocket_id using errcode = 'P0002';
  end if;
  if v_to_pocket.is_archived then
    raise exception 'Pocket % is archived and cannot be used in a new transfer', p_to_pocket_id using errcode = '23514';
  end if;

  insert into public.transactions (
    scope, owner_user_id, household_id, transaction_type, category_id,
    title, note, occurred_at, created_by
  )
  values (
    v_wallet.scope, v_wallet.owner_user_id, v_wallet.household_id, 'TRANSFER', null,
    p_title, p_note, coalesce(p_occurred_at, now()), auth.uid()
  )
  returning id into v_transaction_id;

  -- transaction_entries_validate_pocket (0008) verifies both pockets
  -- actually belong to p_wallet_id and raises a clear error if not.
  insert into public.transaction_entries (transaction_id, wallet_id, pocket_id, amount)
  values
    (v_transaction_id, p_wallet_id, p_from_pocket_id, -p_amount),
    (v_transaction_id, p_wallet_id, p_to_pocket_id, p_amount);

  if p_tag_ids is not null and array_length(p_tag_ids, 1) > 0 then
    perform public.assign_transaction_tags(v_transaction_id, p_tag_ids);
  end if;

  -- Fee/interest are charged to the SAME source pocket the principal left
  -- from — never a second, invented funding pocket, and never silently
  -- charged to the parent wallet outside the selected pocket.
  if p_fee_amount is not null then
    v_fee_transaction_id := public.create_income_expense_transaction(
      'EXPENSE', p_wallet_id, p_from_pocket_id, p_fee_category_id, p_fee_amount,
      p_title, p_note, coalesce(p_occurred_at, now())
    );
    insert into public.transfer_ledger_links (charge_transaction_id, transfer_transaction_id, kind)
    values (v_fee_transaction_id, v_transaction_id, 'FEE');
  end if;

  if p_interest_amount is not null then
    v_interest_transaction_id := public.create_income_expense_transaction(
      'EXPENSE', p_wallet_id, p_from_pocket_id, p_interest_category_id, p_interest_amount,
      p_title, p_note, coalesce(p_occurred_at, now())
    );
    insert into public.transfer_ledger_links (charge_transaction_id, transfer_transaction_id, kind)
    values (v_interest_transaction_id, v_transaction_id, 'INTEREST');
  end if;

  return v_transaction_id;
end;
$$;

comment on function public.create_pocket_transfer(uuid, uuid, uuid, numeric, text, text, timestamptz, uuid[], numeric, uuid, numeric, uuid) is
  'SECURITY DEFINER: checks is_wallet_authorized() plus wallet/pocket archived status (restored 0052) before writing. Moves money between two pockets of the SAME wallet; wallet balance is unaffected by construction. Optional p_fee_amount/p_interest_amount (0052) each become a separate EXPENSE transaction funded from the same source pocket, linked via transfer_ledger_links — omit both for byte-identical behavior to 0032.';

revoke execute on function public.create_pocket_transfer(uuid, uuid, uuid, numeric, text, text, timestamptz, uuid[], numeric, uuid, numeric, uuid) from public, anon;
grant execute on function public.create_pocket_transfer(uuid, uuid, uuid, numeric, text, text, timestamptz, uuid[], numeric, uuid, numeric, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- create_wallet_transfer: DROP + CREATE — same treatment as
-- create_pocket_transfer above.
-- ---------------------------------------------------------------------

drop function public.create_wallet_transfer(uuid, uuid, uuid, uuid, numeric, text, text, timestamptz, uuid[]);

create function public.create_wallet_transfer(
  p_from_wallet_id uuid,
  p_from_pocket_id uuid,
  p_to_wallet_id uuid,
  p_to_pocket_id uuid,
  p_amount numeric,
  p_title text default null,
  p_note text default null,
  p_occurred_at timestamptz default now(),
  p_tag_ids uuid[] default null,
  p_fee_amount numeric default null,
  p_fee_category_id uuid default null,
  p_interest_amount numeric default null,
  p_interest_category_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_from_wallet public.wallets%rowtype;
  v_to_wallet public.wallets%rowtype;
  v_from_pocket public.pockets%rowtype;
  v_to_pocket public.pockets%rowtype;
  v_transaction_id uuid;
  v_fee_transaction_id uuid;
  v_interest_transaction_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be a positive number' using errcode = '22023';
  end if;

  if p_from_wallet_id = p_to_wallet_id then
    raise exception 'Use create_pocket_transfer to move money within the same wallet' using errcode = '22023';
  end if;

  perform public.validate_optional_charge_amount(p_fee_amount, p_fee_category_id, 'Fee ');
  perform public.validate_optional_charge_amount(p_interest_amount, p_interest_category_id, 'Interest ');

  if not public.is_wallet_authorized(p_from_wallet_id) then
    raise exception 'Wallet % not found or not authorized', p_from_wallet_id using errcode = '42501';
  end if;
  if not public.is_wallet_authorized(p_to_wallet_id) then
    raise exception 'Wallet % not found or not authorized', p_to_wallet_id using errcode = '42501';
  end if;

  select * into v_from_wallet from public.wallets where id = p_from_wallet_id;
  select * into v_to_wallet from public.wallets where id = p_to_wallet_id;

  if v_from_wallet.is_archived then
    raise exception 'Wallet % is archived and cannot receive new transactions', p_from_wallet_id using errcode = '23514';
  end if;
  if v_to_wallet.is_archived then
    raise exception 'Wallet % is archived and cannot receive new transactions', p_to_wallet_id using errcode = '23514';
  end if;

  select * into v_from_pocket from public.pockets where id = p_from_pocket_id;
  if not found then
    raise exception 'Pocket % not found', p_from_pocket_id using errcode = 'P0002';
  end if;
  if v_from_pocket.is_archived then
    raise exception 'Pocket % is archived and cannot be used in a new transfer', p_from_pocket_id using errcode = '23514';
  end if;

  select * into v_to_pocket from public.pockets where id = p_to_pocket_id;
  if not found then
    raise exception 'Pocket % not found', p_to_pocket_id using errcode = 'P0002';
  end if;
  if v_to_pocket.is_archived then
    raise exception 'Pocket % is archived and cannot be used in a new transfer', p_to_pocket_id using errcode = '23514';
  end if;

  if v_from_wallet.scope <> v_to_wallet.scope
    or v_from_wallet.owner_user_id is distinct from v_to_wallet.owner_user_id
    or v_from_wallet.household_id is distinct from v_to_wallet.household_id
  then
    raise exception 'Wallet transfer requires both wallets to share the same owner or household in this version'
      using errcode = '23514';
  end if;

  if v_from_wallet.currency <> v_to_wallet.currency then
    raise exception 'Cannot transfer directly between wallets with different currencies (% vs %); cross-currency transfers are not supported yet',
      v_from_wallet.currency, v_to_wallet.currency
      using errcode = '23514';
  end if;

  insert into public.transactions (
    scope, owner_user_id, household_id, transaction_type, category_id,
    title, note, occurred_at, created_by
  )
  values (
    v_from_wallet.scope, v_from_wallet.owner_user_id, v_from_wallet.household_id, 'TRANSFER', null,
    p_title, p_note, coalesce(p_occurred_at, now()), auth.uid()
  )
  returning id into v_transaction_id;

  insert into public.transaction_entries (transaction_id, wallet_id, pocket_id, amount)
  values
    (v_transaction_id, p_from_wallet_id, p_from_pocket_id, -p_amount),
    (v_transaction_id, p_to_wallet_id, p_to_pocket_id, p_amount);

  if p_tag_ids is not null and array_length(p_tag_ids, 1) > 0 then
    perform public.assign_transaction_tags(v_transaction_id, p_tag_ids);
  end if;

  -- Fee/interest are ALWAYS charged to the SOURCE wallet/pocket — the
  -- destination is never touched by either. Currency is inherited (no
  -- p_*_currency parameter exists at all): create_income_expense_transaction
  -- derives it from p_from_wallet_id, which by the check above already
  -- shares the transfer's own currency.
  if p_fee_amount is not null then
    v_fee_transaction_id := public.create_income_expense_transaction(
      'EXPENSE', p_from_wallet_id, p_from_pocket_id, p_fee_category_id, p_fee_amount,
      p_title, p_note, coalesce(p_occurred_at, now())
    );
    insert into public.transfer_ledger_links (charge_transaction_id, transfer_transaction_id, kind)
    values (v_fee_transaction_id, v_transaction_id, 'FEE');
  end if;

  if p_interest_amount is not null then
    v_interest_transaction_id := public.create_income_expense_transaction(
      'EXPENSE', p_from_wallet_id, p_from_pocket_id, p_interest_category_id, p_interest_amount,
      p_title, p_note, coalesce(p_occurred_at, now())
    );
    insert into public.transfer_ledger_links (charge_transaction_id, transfer_transaction_id, kind)
    values (v_interest_transaction_id, v_transaction_id, 'INTEREST');
  end if;

  return v_transaction_id;
end;
$$;

comment on function public.create_wallet_transfer(uuid, uuid, uuid, uuid, numeric, text, text, timestamptz, uuid[], numeric, uuid, numeric, uuid) is
  'SECURITY DEFINER: checks is_wallet_authorized() and archived status (restored 0052) for BOTH wallets/pockets, rejects cross-currency transfers, before writing. Total net worth is unaffected by construction. Optional p_fee_amount/p_interest_amount (0052) each become a separate EXPENSE transaction funded from the SOURCE wallet/pocket, linked via transfer_ledger_links — omit both for byte-identical behavior to 0032.';

revoke execute on function public.create_wallet_transfer(uuid, uuid, uuid, uuid, numeric, text, text, timestamptz, uuid[], numeric, uuid, numeric, uuid) from public, anon;
grant execute on function public.create_wallet_transfer(uuid, uuid, uuid, uuid, numeric, text, text, timestamptz, uuid[], numeric, uuid, numeric, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- void_transaction: CREATE OR REPLACE, same signature as 0033. A TRANSFER
-- remains un-voidable UNLESS it has at least one linked fee/interest
-- charge — every existing plain (unlinked) transfer keeps today's exact
-- "Transfers cannot be voided in this version" behavior, byte-identical.
-- A linked transfer's void now proceeds and is cascaded to its charges by
-- the new sync_transfer_ledger_void_state trigger below.
-- ---------------------------------------------------------------------

create or replace function public.void_transaction(
  p_transaction_id uuid,
  p_void_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_transaction public.transactions%rowtype;
  v_active_adjustment_total numeric(14, 2);
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if not public.is_transaction_authorized(p_transaction_id) then
    raise exception 'Transaction % not found or not authorized', p_transaction_id using errcode = '42501';
  end if;

  -- Locked for the duration of this call — a concurrent
  -- create_expense_adjustment_transaction against this same original
  -- blocks here (or vice versa) rather than racing past this check.
  select * into v_transaction from public.transactions where id = p_transaction_id for update;

  if v_transaction.transaction_type = 'TRANSFER' and not exists (
    select 1 from public.transfer_ledger_links where transfer_transaction_id = p_transaction_id
  ) then
    raise exception 'Transfers cannot be voided in this version' using errcode = '22023';
  end if;

  if v_transaction.deleted_at is not null then
    raise exception 'Transaction % is already voided', p_transaction_id using errcode = '22023';
  end if;

  v_active_adjustment_total := public.get_expense_adjustment_total(p_transaction_id);
  if v_active_adjustment_total > 0 then
    raise exception 'ยกเลิกรายการนี้ไม่ได้ เนื่องจากมีรายการคืนเงิน/เบิกคืนที่ยังใช้งานอยู่' using errcode = '23514';
  end if;

  update public.transactions
  set deleted_at = now(), voided_by = auth.uid(), void_reason = p_void_reason
  where id = p_transaction_id;

  return p_transaction_id;
end;
$$;

comment on function public.void_transaction(uuid, text) is
  'SECURITY DEFINER: sets deleted_at (+ voided_by/void_reason). Rejects voiding an EXPENSE that still has an active linked refund/reimbursement (0033). A plain (unlinked) TRANSFER still cannot be voided in this version; a TRANSFER with at least one transfer_ledger_links row (0052) CAN — cascaded atomically to its fee/interest charges by sync_transfer_ledger_void_state. Idempotency: voiding an already-voided transaction raises rather than silently succeeding.';

-- restore_transaction (0033) is untouched: it already has no
-- transaction_type gate at all and already loops over every entry the
-- transaction touches (its own comment: "INCOME/EXPENSE has one entry;
-- TRANSFER... would have two — checked in a loop so this stays correct
-- either way"), so a linked TRANSFER already restores correctly through
-- the existing function body with zero changes — only the new cascading
-- trigger below is needed to keep the GROUP synchronized.

-- ---------------------------------------------------------------------
-- sync_transfer_ledger_void_state: generalizes sync_debt_event_void_state
-- (0041) from a fixed 2-way partner link to an N-member group (one
-- TRANSFER plus up to one FEE and one INTEREST child), reached through
-- the exact same generic void_transaction/restore_transaction entry
-- points a user already uses for any other transaction — never a
-- dedicated compound void/restore RPC. This is deliberate: the addendum
-- asked to confirm this is safe for a three-member group before using it
-- rather than a dedicated RPC, and it is, for the same reason the 2-way
-- case already is — Postgres AFTER-trigger semantics make the whole
-- cascade part of one transaction, so ANY exception raised here rolls
-- back the initiating UPDATE too, leaving the group fully unchanged on
-- failure.
-- ---------------------------------------------------------------------

create function public.sync_transfer_ledger_void_state()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_group_ids uuid[];
  v_id uuid;
  v_partner_adjustment_total numeric(14, 2);
  v_wallet_or_pocket_inactive boolean;
begin
  -- Recursion guard, identical in shape to sync_debt_event_void_state:
  -- skip no-op updates, and skip any invocation nested inside this same
  -- trigger's own cascaded UPDATEs (those run at trigger depth >= 2).
  if new.deleted_at is not distinct from old.deleted_at or pg_trigger_depth() > 1 then
    return new;
  end if;

  -- Resolve every OTHER member of this transaction's transfer/charge
  -- group: if `new` is the transfer, its 0-2 linked charges; if `new` is
  -- a charge, its transfer plus the transfer's other charge (if any).
  -- Never includes new.id itself.
  select coalesce(array_agg(distinct m.id order by m.id), array[]::uuid[]) into v_group_ids
  from (
    select tll.charge_transaction_id as id
    from public.transfer_ledger_links tll
    where tll.transfer_transaction_id = new.id
    union
    select tll.transfer_transaction_id as id
    from public.transfer_ledger_links tll
    where tll.charge_transaction_id = new.id
    union
    select tll2.charge_transaction_id as id
    from public.transfer_ledger_links tll
    join public.transfer_ledger_links tll2 on tll2.transfer_transaction_id = tll.transfer_transaction_id
    where tll.charge_transaction_id = new.id and tll2.charge_transaction_id <> new.id
  ) m;

  if array_length(v_group_ids, 1) is null then
    return new;
  end if;

  -- Lock every OTHER group member, in a fixed ascending-id order, BEFORE
  -- validating or updating any of them — a deterministic lock order
  -- avoids deadlock against a concurrent void/restore initiated on a
  -- different member of the same group (that call will block here on
  -- whichever row it reaches first in the same ascending order, then
  -- proceed or correctly discover the group already changed).
  foreach v_id in array v_group_ids loop
    perform 1 from public.transactions where id = v_id for update;
  end loop;

  if new.deleted_at is not null then
    -- Voiding: refuse the WHOLE cascade, leaving every member unchanged,
    -- if any member has an active refund/reimbursement — the same rule
    -- void_transaction already applies to a single transaction (0033),
    -- generalized across the group before any UPDATE below runs.
    foreach v_id in array v_group_ids loop
      v_partner_adjustment_total := public.get_expense_adjustment_total(v_id);
      if v_partner_adjustment_total > 0 then
        raise exception 'ยกเลิกรายการนี้ไม่ได้ เนื่องจากมีรายการคืนเงิน/เบิกคืนที่ยังใช้งานอยู่ในรายการที่เชื่อมโยงกัน' using errcode = '23514';
      end if;
    end loop;
  else
    -- Restoring: refuse the WHOLE cascade if any member's wallet/pocket is
    -- no longer active — the same check restore_transaction (0033) already
    -- applies to a single transaction's own entries, generalized across
    -- the group.
    foreach v_id in array v_group_ids loop
      select exists (
        select 1
        from public.transaction_entries e
        join public.wallets w on w.id = e.wallet_id
        join public.pockets p on p.id = e.pocket_id
        where e.transaction_id = v_id and (w.is_archived or p.is_archived)
      ) into v_wallet_or_pocket_inactive;
      if v_wallet_or_pocket_inactive then
        raise exception 'ไม่สามารถกู้คืนรายการที่เชื่อมโยงกันได้ เนื่องจากกระเป๋าเงินหรือช่องที่เกี่ยวข้องถูกเก็บถาวรแล้ว' using errcode = '23514';
      end if;
    end loop;
  end if;

  update public.transactions
  set deleted_at = new.deleted_at, voided_by = new.voided_by, void_reason = new.void_reason
  where id = any(v_group_ids);

  return new;
end;
$$;

comment on function public.sync_transfer_ledger_void_state() is
  'AFTER UPDATE OF deleted_at on transactions: keeps a TRANSFER and its 0-2 linked FEE/INTEREST charges (transfer_ledger_links) voided/restored together, atomically, through the existing generic void_transaction/restore_transaction entry points. Locks every other group member in ascending-id order before validating or updating (deterministic order avoids deadlock against a concurrent void/restore on a different group member). Refuses the whole cascade — leaving every member unchanged — if any member has an active adjustment (void) or an archived wallet/pocket (restore). Recursion-guarded identically to sync_debt_event_void_state (0041).';

create trigger transactions_sync_transfer_ledger_void
  after update of deleted_at on public.transactions
  for each row execute function public.sync_transfer_ledger_void_state();
