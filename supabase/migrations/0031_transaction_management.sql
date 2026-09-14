-- 0031_transaction_management.sql
-- Phase B: Transaction management (edit/void/restore for INCOME/EXPENSE).
--
-- Audit finding: the void architecture this phase needs already exists.
-- `transactions.deleted_at` has been the void marker since 0008 ("Set
-- instead of DELETE so financial history and audit trails survive
-- corrections"), and get_pocket_balance / get_wallet_balance (0010) plus
-- get_finance_hub_summary (0028) already filter every aggregate on
-- `t.deleted_at is null`. This migration therefore does NOT touch any
-- balance/summary function — voiding a transaction already has zero
-- financial effect the instant `deleted_at` is set. What is actually
-- missing is (1) an authoritative way to set/clear it, since 0012 revoked
-- UPDATE on `transactions` entirely, (2) audit context (who voided it and
-- why), and (3) a way to correct a transaction's logical fields and its
-- ledger entry atomically.
--
-- Transfers are explicitly out of scope: every RPC below rejects
-- transaction_type = 'TRANSFER'. See docs/FINANCE.md Phase B.

-- ---------------------------------------------------------------------
-- Audit columns for void. deleted_at itself is unchanged/reused.
-- ---------------------------------------------------------------------

alter table public.transactions
  add column if not exists voided_by uuid references public.profiles (id),
  add column if not exists void_reason text;

comment on column public.transactions.voided_by is
  'Who voided this transaction (set together with deleted_at). Null while active, and cleared on restore.';
comment on column public.transactions.void_reason is
  'Optional free-text reason supplied at void time. Null while active, and cleared on restore.';

-- ---------------------------------------------------------------------
-- is_transaction_authorized: shared authorization check for edit/void/
-- restore, mirroring is_wallet_authorized (0012). SECURITY DEFINER so it
-- can see the transaction regardless of the caller's own RLS visibility —
-- that visibility check IS the authorization check.
--
-- Per docs/DOMAIN_RULES.md "Security": household money management is a
-- member-level privilege, not owner/admin-gated. Any active member of the
-- transaction's household (or the PERSONAL owner) may edit/void/restore
-- it — not only its original creator.
-- ---------------------------------------------------------------------

create or replace function public.is_transaction_authorized(p_transaction_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_transaction public.transactions%rowtype;
begin
  if auth.uid() is null then
    return false;
  end if;

  select * into v_transaction from public.transactions where id = p_transaction_id;
  if not found then
    return false;
  end if;

  if v_transaction.scope = 'PERSONAL' then
    return v_transaction.owner_user_id = auth.uid();
  end if;

  return public.is_household_member(v_transaction.household_id);
end;
$$;

comment on function public.is_transaction_authorized(uuid) is
  'True if the current user may edit/void/restore this transaction (PERSONAL owner or any HOUSEHOLD member — day-to-day finance is a member-level privilege, not creator-only). SECURITY DEFINER: this check IS the authorization boundary.';

revoke execute on function public.is_transaction_authorized(uuid) from public, anon;
grant execute on function public.is_transaction_authorized(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- update_income_expense_transaction
--
-- Editable: amount, occurred_at, pocket (within the SAME wallet), category
-- (must remain type-compatible; only re-validated if it actually changes,
-- so a historical transaction never loses an already-archived category
-- just because nothing else about it changed), title, note.
--
-- NOT editable: transaction_type, wallet. Wallet is derived from the
-- transaction's existing single ledger entry and never touched — the
-- entry's wallet_id in the UPDATE below is set to itself.
-- ---------------------------------------------------------------------

create or replace function public.update_income_expense_transaction(
  p_transaction_id uuid,
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
  v_transaction public.transactions%rowtype;
  v_entry public.transaction_entries%rowtype;
  v_wallet public.wallets%rowtype;
  v_pocket public.pockets%rowtype;
  v_category public.categories%rowtype;
  v_signed_amount numeric(14, 2);
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

  select * into v_transaction from public.transactions where id = p_transaction_id;

  if v_transaction.transaction_type not in ('INCOME', 'EXPENSE') then
    raise exception 'Only INCOME or EXPENSE transactions can be edited this way; % is a %',
      p_transaction_id, v_transaction.transaction_type
      using errcode = '22023';
  end if;

  if v_transaction.deleted_at is not null then
    raise exception 'Transaction % is voided and cannot be edited; restore it first', p_transaction_id
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

  -- Category is only re-validated when it actually changes — an already
  -- assigned (possibly since-archived) category stays valid for a
  -- transaction that isn't touching it. See docs/FINANCE.md Phase B.
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

  return p_transaction_id;
end;
$$;

comment on function public.update_income_expense_transaction(uuid, uuid, uuid, numeric, text, text, timestamptz) is
  'SECURITY DEFINER: atomically corrects an INCOME/EXPENSE transaction and rebuilds its single ledger entry. Wallet and transaction_type are immutable here; balances recompute automatically (never stored).';

revoke execute on function public.update_income_expense_transaction(uuid, uuid, uuid, numeric, text, text, timestamptz) from public, anon;
grant execute on function public.update_income_expense_transaction(uuid, uuid, uuid, numeric, text, text, timestamptz) to authenticated;

-- ---------------------------------------------------------------------
-- void_transaction
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
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if not public.is_transaction_authorized(p_transaction_id) then
    raise exception 'Transaction % not found or not authorized', p_transaction_id using errcode = '42501';
  end if;

  select * into v_transaction from public.transactions where id = p_transaction_id;

  if v_transaction.transaction_type = 'TRANSFER' then
    raise exception 'Transfers cannot be voided in this version' using errcode = '22023';
  end if;

  if v_transaction.deleted_at is not null then
    raise exception 'Transaction % is already voided', p_transaction_id using errcode = '22023';
  end if;

  update public.transactions
  set deleted_at = now(), voided_by = auth.uid(), void_reason = p_void_reason
  where id = p_transaction_id;

  return p_transaction_id;
end;
$$;

comment on function public.void_transaction(uuid, text) is
  'SECURITY DEFINER: sets deleted_at (+ voided_by/void_reason). Ledger entries are untouched; every balance/summary function already excludes voided transactions (t.deleted_at is null). Idempotency: voiding an already-voided transaction raises rather than silently succeeding.';

revoke execute on function public.void_transaction(uuid, text) from public, anon;
grant execute on function public.void_transaction(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- restore_transaction
-- ---------------------------------------------------------------------

create or replace function public.restore_transaction(p_transaction_id uuid)
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
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if not public.is_transaction_authorized(p_transaction_id) then
    raise exception 'Transaction % not found or not authorized', p_transaction_id using errcode = '42501';
  end if;

  select * into v_transaction from public.transactions where id = p_transaction_id;

  if v_transaction.deleted_at is null then
    raise exception 'Transaction % is not voided', p_transaction_id using errcode = '22023';
  end if;

  -- Reactivating must restore the exact original financial effect, so
  -- every wallet/pocket it moved money through must still be usable.
  -- INCOME/EXPENSE has one entry; TRANSFER (voided by some future path)
  -- would have two — checked in a loop so this stays correct either way,
  -- even though void_transaction currently never lets a TRANSFER reach
  -- this state.
  for v_entry in select * from public.transaction_entries where transaction_id = p_transaction_id loop
    select * into v_wallet from public.wallets where id = v_entry.wallet_id;
    if not found or v_wallet.is_archived then
      raise exception 'Wallet % is archived or no longer exists; restore is not safe', v_entry.wallet_id
        using errcode = '23514';
    end if;

    select * into v_pocket from public.pockets where id = v_entry.pocket_id;
    if not found or v_pocket.is_archived then
      raise exception 'Pocket % is archived or no longer exists; restore is not safe', v_entry.pocket_id
        using errcode = '23514';
    end if;
  end loop;

  update public.transactions
  set deleted_at = null, voided_by = null, void_reason = null
  where id = p_transaction_id;

  return p_transaction_id;
end;
$$;

comment on function public.restore_transaction(uuid) is
  'SECURITY DEFINER: clears deleted_at/voided_by/void_reason after validating every wallet/pocket the transaction touches is still active. Rejects (does not silently rewrite) when a dependency is archived. Restoring an already-active transaction raises rather than silently succeeding.';

revoke execute on function public.restore_transaction(uuid) from public, anon;
grant execute on function public.restore_transaction(uuid) to authenticated;
