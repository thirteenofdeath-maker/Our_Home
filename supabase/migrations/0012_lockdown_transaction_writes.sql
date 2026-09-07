-- 0012_lockdown_transaction_writes.sql
-- Milestone 1 hardening pass, item 1 & 8.
--
-- Before this migration, `transactions` and `transaction_entries` granted
-- INSERT to `authenticated`, gated only by RLS policies that re-derived
-- scope/owner/household correctly *when called through the RPCs* — but
-- nothing stopped an authenticated client from calling PostgREST directly
-- (`POST /rest/v1/transactions`) with a crafted scope/owner_user_id/
-- household_id, or from creating a transaction_entries row with an
-- arbitrary signed amount unrelated to any transaction total. TypeScript
-- types and the Server Action layer are not a security boundary — nothing
-- stops a client from bypassing the Next.js app and calling PostgREST
-- directly with its own access token.
--
-- Fix: authenticated clients can no longer INSERT into either table at
-- all, and can no longer UPDATE `transactions` at all (Milestone 1 has no
-- edit/void UI, so there is nothing legitimate to protect by leaving
-- UPDATE open — see docs/DOMAIN_RULES.md "Transaction correction"). The
-- only way to write the ledger is through the three RPC functions below,
-- which are redefined as SECURITY DEFINER with explicit, hand-written
-- authorization checks.
--
-- Why SECURITY DEFINER is safe here: these functions are owned by the
-- migration-running role (the table owner), and a table owner bypasses RLS
-- on its own tables by default (Postgres only restricts this under
-- `ALTER TABLE ... FORCE ROW LEVEL SECURITY`, which we do not use). That
-- means once a statement is running "as" the definer, RLS on wallets/
-- households/transactions is not what protects the caller anymore — the
-- explicit checks inside the function body are. Every one of these
-- functions therefore: (1) requires `auth.uid()` to be non-null, (2)
-- checks PERSONAL ownership or HOUSEHOLD membership against the real
-- wallet row (fetched with RLS bypassed, so it can't be hidden from the
-- check), and (3) derives scope/owner_user_id/household_id exclusively
-- from that authorized wallet row — never from a client-supplied
-- parameter. `search_path = ''` plus fully schema-qualifying every
-- reference closes the classic SECURITY DEFINER search_path hijack (a
-- malicious search_path could otherwise shadow an unqualified function/
-- operator name with an attacker-controlled one).

-- ---------------------------------------------------------------------
-- Revoke direct write access. SELECT stays granted — the app reads
-- transactions/entries through normal RLS-checked queries.
-- ---------------------------------------------------------------------

revoke insert, update on public.transactions from authenticated;
revoke insert on public.transaction_entries from authenticated;

-- These policies described conditions under which a direct client INSERT/
-- UPDATE used to be allowed. They are now unreachable (the GRANT is gone
-- before RLS is even evaluated) and would be misleading to leave in place.
drop policy if exists transactions_insert on public.transactions;
drop policy if exists transactions_update on public.transactions;
drop policy if exists transaction_entries_insert on public.transaction_entries;

-- ---------------------------------------------------------------------
-- is_wallet_authorized: shared authorization check used by every ledger-
-- write RPC below. Returns false (never raises) so callers can produce
-- their own contextual error message; also doubles as an existence check
-- (a nonexistent wallet id is simply "not authorized").
-- ---------------------------------------------------------------------

create function public.is_wallet_authorized(p_wallet_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_wallet public.wallets%rowtype;
begin
  if auth.uid() is null then
    return false;
  end if;

  select * into v_wallet from public.wallets where id = p_wallet_id;
  if not found then
    return false;
  end if;

  if v_wallet.scope = 'PERSONAL' then
    return v_wallet.owner_user_id = auth.uid();
  end if;

  return public.is_household_member(v_wallet.household_id);
end;
$$;

comment on function public.is_wallet_authorized(uuid) is
  'True if the current user may transact against this wallet (PERSONAL owner or HOUSEHOLD member). SECURITY DEFINER so it can see the wallet regardless of the caller''s own RLS visibility, which is the point: it IS the authorization check.';

revoke execute on function public.is_wallet_authorized(uuid) from public, anon;
grant execute on function public.is_wallet_authorized(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- create_income_expense_transaction (redefined: SECURITY DEFINER)
-- ---------------------------------------------------------------------

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
  'SECURITY DEFINER: explicitly checks is_wallet_authorized() before writing. Scope/owner/household are derived from the wallet row, never from a parameter.';

revoke execute on function public.create_income_expense_transaction(public.transaction_type, uuid, uuid, uuid, numeric, text, text, timestamptz) from public, anon;
grant execute on function public.create_income_expense_transaction(public.transaction_type, uuid, uuid, uuid, numeric, text, text, timestamptz) to authenticated;

-- ---------------------------------------------------------------------
-- create_pocket_transfer (redefined: SECURITY DEFINER)
-- ---------------------------------------------------------------------

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
  'SECURITY DEFINER: explicitly checks is_wallet_authorized() before writing. Moves money between two pockets of the SAME wallet; wallet balance is unaffected by construction.';

revoke execute on function public.create_pocket_transfer(uuid, uuid, uuid, numeric, text, text, timestamptz) from public, anon;
grant execute on function public.create_pocket_transfer(uuid, uuid, uuid, numeric, text, text, timestamptz) to authenticated;

-- ---------------------------------------------------------------------
-- create_wallet_transfer (redefined: SECURITY DEFINER + currency check)
-- ---------------------------------------------------------------------

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
  'SECURITY DEFINER: explicitly checks is_wallet_authorized() for BOTH wallets, rejects cross-currency transfers, before writing. Total net worth is unaffected by construction.';

revoke execute on function public.create_wallet_transfer(uuid, uuid, uuid, uuid, numeric, text, text, timestamptz) from public, anon;
grant execute on function public.create_wallet_transfer(uuid, uuid, uuid, uuid, numeric, text, text, timestamptz) to authenticated;

-- ---------------------------------------------------------------------
-- General hygiene: Postgres grants EXECUTE on every new function to
-- PUBLIC by default. Close that for the read-only RLS/balance helpers too
-- — low risk either way since they're scoped by auth.uid()/RLS
-- internally, but there is no reason an anonymous request should be able
-- to invoke them at all.
-- ---------------------------------------------------------------------

revoke execute on function public.is_household_member(uuid) from public, anon;
revoke execute on function public.has_household_role(uuid, public.household_role[]) from public, anon;
revoke execute on function public.get_pocket_balance(uuid) from public, anon;
revoke execute on function public.get_wallet_balance(uuid) from public, anon;

grant execute on function public.is_household_member(uuid) to authenticated;
grant execute on function public.has_household_role(uuid, public.household_role[]) to authenticated;
grant execute on function public.get_pocket_balance(uuid) to authenticated;
grant execute on function public.get_wallet_balance(uuid) to authenticated;
