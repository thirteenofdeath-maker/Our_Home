-- 0020_reject_archived_wallets_and_pockets.sql
-- Second Milestone 1 hardening pass, item 2.
--
-- The three ledger-write RPCs (redefined SECURITY DEFINER in
-- 0012_lockdown_transaction_writes.sql) checked wallet authorization and
-- category validity, but never checked `is_archived` on the wallet(s) or
-- pocket(s) involved. Archiving a wallet/pocket is meant to stop NEW
-- activity against it (it remains fully readable, and its historical
-- entries are untouched — this is a write-time guard only, exactly like
-- the existing "archived category" check it now sits alongside).
--
-- CREATE OR REPLACE here supersedes the full function bodies from 0012
-- (same pattern already used by 0018 for categories_validate_hierarchy
-- and 0015 for handle_new_user) — 0012 is not edited, its functions are
-- redefined again, on top.

create or replace function public.create_income_expense_transaction(
  p_transaction_type public.transaction_type,
  p_wallet_id uuid,
  p_pocket_id uuid,
  p_category_id uuid,
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

  return v_transaction_id;
end;
$$;

comment on function public.create_income_expense_transaction(public.transaction_type, uuid, uuid, uuid, numeric, text, text, timestamptz) is
  'SECURITY DEFINER: checks is_wallet_authorized() plus wallet/pocket/category archived status before writing. Scope/owner/household derived from the wallet row, never from a parameter.';

create or replace function public.create_pocket_transfer(
  p_wallet_id uuid,
  p_from_pocket_id uuid,
  p_to_pocket_id uuid,
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
  v_from_pocket public.pockets%rowtype;
  v_to_pocket public.pockets%rowtype;
  v_transaction_id uuid;
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

  return v_transaction_id;
end;
$$;

comment on function public.create_pocket_transfer(uuid, uuid, uuid, numeric, text, text, timestamptz) is
  'SECURITY DEFINER: checks is_wallet_authorized() plus wallet/pocket archived status before writing. Moves money between two pockets of the SAME wallet; wallet balance is unaffected by construction.';

create or replace function public.create_wallet_transfer(
  p_from_wallet_id uuid,
  p_from_pocket_id uuid,
  p_to_wallet_id uuid,
  p_to_pocket_id uuid,
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
  v_from_wallet public.wallets%rowtype;
  v_to_wallet public.wallets%rowtype;
  v_from_pocket public.pockets%rowtype;
  v_to_pocket public.pockets%rowtype;
  v_transaction_id uuid;
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

  -- Both endpoints are checked independently and explicitly: a caller
  -- authorized for the source wallet is not automatically authorized for
  -- the destination (the "same owner/household" rule below is a Milestone
  -- 1 product restriction, not something this authorization check should
  -- assume).
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

  -- Milestone 1 restriction: both wallets must belong to the same owner
  -- (PERSONAL) or the same household (HOUSEHOLD). Moving money between a
  -- personal wallet and a household wallet is a "contribution", which is a
  -- distinct future feature (it likely needs its own representation, not a
  -- plain transfer) — see docs/ARCHITECTURE.md simplifications.
  if v_from_wallet.scope <> v_to_wallet.scope
    or v_from_wallet.owner_user_id is distinct from v_to_wallet.owner_user_id
    or v_from_wallet.household_id is distinct from v_to_wallet.household_id
  then
    raise exception 'Wallet transfer requires both wallets to share the same owner or household in this version'
      using errcode = '23514';
  end if;

  -- Milestone 1 restriction: plain transfers do not carry FX semantics.
  -- Moving money between wallets of different currencies requires an
  -- explicit exchange rate and is a future feature, not part of this RPC.
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

  return v_transaction_id;
end;
$$;

comment on function public.create_wallet_transfer(uuid, uuid, uuid, uuid, numeric, text, text, timestamptz) is
  'SECURITY DEFINER: checks is_wallet_authorized() and archived status for BOTH wallets/pockets, rejects cross-currency transfers, before writing. Total net worth is unaffected by construction.';
