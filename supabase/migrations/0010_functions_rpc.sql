-- 0010_functions_rpc.sql
-- Balance readers and the atomic ledger-write RPCs.
--
-- All of these are SECURITY INVOKER (the default — stated explicitly for
-- clarity). They run as the calling user, so every statement inside is
-- still checked by RLS. Scope/owner/household for a new transaction is
-- always *derived* from the wallet(s) involved, never accepted as a
-- parameter — a client cannot claim a personal transaction is
-- household-scoped (or vice versa) by passing the "wrong" value, because
-- there is no such value to pass.

-- ---------------------------------------------------------------------
-- Balance readers
-- ---------------------------------------------------------------------

create function public.get_pocket_balance(p_pocket_id uuid)
returns numeric
language sql
security invoker
set search_path = public
stable
as $$
  select coalesce(sum(e.amount), 0)
  from public.transaction_entries e
  join public.transactions t on t.id = e.transaction_id
  where e.pocket_id = p_pocket_id
    and t.deleted_at is null;
$$;

comment on function public.get_pocket_balance(uuid) is
  'Pocket balance = SUM(transaction_entries.amount) for non-voided transactions. RLS-respecting (SECURITY INVOKER).';

create function public.get_wallet_balance(p_wallet_id uuid)
returns numeric
language sql
security invoker
set search_path = public
stable
as $$
  select coalesce(sum(e.amount), 0)
  from public.transaction_entries e
  join public.transactions t on t.id = e.transaction_id
  where e.wallet_id = p_wallet_id
    and t.deleted_at is null;
$$;

comment on function public.get_wallet_balance(uuid) is
  'Wallet balance = SUM(transaction_entries.amount) for non-voided transactions. Equivalent to summing all of the wallet''s pocket balances.';

-- ---------------------------------------------------------------------
-- create_income_expense_transaction
-- ---------------------------------------------------------------------

create function public.create_income_expense_transaction(
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
security invoker
set search_path = public
as $$
declare
  v_wallet public.wallets%rowtype;
  v_category public.categories%rowtype;
  v_signed_amount numeric(14, 2);
  v_transaction_id uuid;
begin
  if p_transaction_type not in ('INCOME', 'EXPENSE') then
    raise exception 'create_income_expense_transaction only accepts INCOME or EXPENSE, got %', p_transaction_type
      using errcode = '22023';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be a positive number' using errcode = '22023';
  end if;

  select * into v_wallet from public.wallets where id = p_wallet_id;
  if not found then
    raise exception 'Wallet % not found or not accessible', p_wallet_id using errcode = 'P0002';
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
  'Atomically creates an INCOME or EXPENSE transaction and its single ledger entry. Scope/owner/household are derived from the wallet, not client-supplied.';

-- ---------------------------------------------------------------------
-- create_pocket_transfer
-- ---------------------------------------------------------------------

create function public.create_pocket_transfer(
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
security invoker
set search_path = public
as $$
declare
  v_wallet public.wallets%rowtype;
  v_transaction_id uuid;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be a positive number' using errcode = '22023';
  end if;

  if p_from_pocket_id = p_to_pocket_id then
    raise exception 'Source and destination pocket must be different' using errcode = '22023';
  end if;

  select * into v_wallet from public.wallets where id = p_wallet_id;
  if not found then
    raise exception 'Wallet % not found or not accessible', p_wallet_id using errcode = 'P0002';
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
  'Atomically creates a TRANSFER transaction moving money between two pockets of the SAME wallet. Wallet balance is unaffected by construction.';

-- ---------------------------------------------------------------------
-- create_wallet_transfer
-- ---------------------------------------------------------------------

create function public.create_wallet_transfer(
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
security invoker
set search_path = public
as $$
declare
  v_from_wallet public.wallets%rowtype;
  v_to_wallet public.wallets%rowtype;
  v_transaction_id uuid;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be a positive number' using errcode = '22023';
  end if;

  if p_from_wallet_id = p_to_wallet_id then
    raise exception 'Use create_pocket_transfer to move money within the same wallet' using errcode = '22023';
  end if;

  select * into v_from_wallet from public.wallets where id = p_from_wallet_id;
  if not found then
    raise exception 'Wallet % not found or not accessible', p_from_wallet_id using errcode = 'P0002';
  end if;

  select * into v_to_wallet from public.wallets where id = p_to_wallet_id;
  if not found then
    raise exception 'Wallet % not found or not accessible', p_to_wallet_id using errcode = 'P0002';
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
  'Atomically creates a TRANSFER transaction moving money between two DIFFERENT wallets of the same owner/household. Total net worth is unaffected by construction.';
