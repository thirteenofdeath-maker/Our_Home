-- Wallet creation now supports a ledger-backed opening balance. Credit cards
-- keep using their dedicated account/liability model and expose the resulting
-- wallet id so the existing wallet detail route remains the post-create target.

alter type public.transaction_type add value if not exists 'OPENING_BALANCE';

create function public.create_wallet_with_initial_balance(
  p_scope public.money_scope,
  p_owner_user_id uuid,
  p_household_id uuid,
  p_name text,
  p_wallet_type public.wallet_type,
  p_currency text,
  p_first_pocket_name text,
  p_initial_balance numeric default 0
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_wallet_id uuid;
  v_pocket_id uuid;
  v_transaction_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if p_wallet_type = 'CREDIT_CARD' then
    raise exception 'Create credit cards through create_credit_card_account_with_available_credit' using errcode = '23514';
  end if;
  if btrim(coalesce(p_name, '')) = '' or char_length(btrim(p_name)) > 80 then
    raise exception 'Wallet name is required and must be at most 80 characters' using errcode = '22023';
  end if;
  if btrim(coalesce(p_first_pocket_name, '')) = '' or char_length(btrim(p_first_pocket_name)) > 60 then
    raise exception 'First pocket name is required and must be at most 60 characters' using errcode = '22023';
  end if;
  if btrim(coalesce(p_currency, '')) !~ '^[A-Za-z]{3}$' then
    raise exception 'Currency must be a 3-letter code' using errcode = '22023';
  end if;
  if p_initial_balance is null or p_initial_balance < 0 then
    raise exception 'Initial balance cannot be negative' using errcode = '22023';
  end if;
  if p_scope = 'PERSONAL' then
    if p_owner_user_id is distinct from v_user_id or p_household_id is not null then
      raise exception 'Invalid personal wallet owner' using errcode = '42501';
    end if;
  elsif p_scope = 'HOUSEHOLD' then
    if p_owner_user_id is not null or p_household_id is null or not public.is_household_member(p_household_id) then
      raise exception 'Household not found or not authorized' using errcode = '42501';
    end if;
  else
    raise exception 'Invalid wallet scope' using errcode = '22023';
  end if;

  insert into public.wallets (
    scope, owner_user_id, household_id, name, wallet_type, currency, created_by
  ) values (
    p_scope, p_owner_user_id, p_household_id, btrim(p_name), p_wallet_type,
    upper(btrim(p_currency)), v_user_id
  ) returning id into v_wallet_id;

  insert into public.pockets (wallet_id, name, sort_order)
  values (v_wallet_id, btrim(p_first_pocket_name), 0)
  returning id into v_pocket_id;

  if p_initial_balance > 0 then
    insert into public.transactions (
      scope, owner_user_id, household_id, transaction_type, category_id,
      title, note, occurred_at, created_by
    ) values (
      p_scope, p_owner_user_id, p_household_id, 'OPENING_BALANCE', null,
      'ยอดเงินเริ่มต้น', null, now(), v_user_id
    ) returning id into v_transaction_id;

    insert into public.transaction_entries (transaction_id, wallet_id, pocket_id, amount)
    values (v_transaction_id, v_wallet_id, v_pocket_id, p_initial_balance);
  end if;

  return v_wallet_id;
end;
$$;

revoke execute on function public.create_wallet_with_initial_balance(
  public.money_scope, uuid, uuid, text, public.wallet_type, text, text, numeric
) from public, anon;
grant execute on function public.create_wallet_with_initial_balance(
  public.money_scope, uuid, uuid, text, public.wallet_type, text, text, numeric
) to authenticated;

create function public.create_credit_card_account_with_available_credit(
  p_scope public.money_scope,
  p_household_id uuid,
  p_name text,
  p_currency text,
  p_credit_limit numeric,
  p_available_credit numeric,
  p_statement_closing_day integer,
  p_payment_due_day integer
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_account_id uuid;
  v_wallet_id uuid;
begin
  if p_available_credit is null or p_available_credit < 0 then
    raise exception 'Available credit cannot be negative' using errcode = '22023';
  end if;
  if p_credit_limit is null or p_available_credit > p_credit_limit then
    raise exception 'Available credit cannot exceed the credit limit' using errcode = '22023';
  end if;

  v_account_id := public.create_credit_card_account(
    p_scope, p_household_id, p_name, p_currency,
    null, null, null, p_credit_limit,
    p_statement_closing_day, p_payment_due_day, null
  );

  select wallet_id into v_wallet_id
  from public.credit_card_accounts
  where id = v_account_id;

  if p_available_credit < p_credit_limit then
    perform public.create_credit_card_balance_adjustment(
      v_account_id,
      p_available_credit - p_credit_limit,
      'ยอดค้างเริ่มต้น',
      now()
    );
  end if;

  return v_wallet_id;
end;
$$;

revoke execute on function public.create_credit_card_account_with_available_credit(
  public.money_scope, uuid, text, text, numeric, numeric, integer, integer
) from public, anon;
grant execute on function public.create_credit_card_account_with_available_credit(
  public.money_scope, uuid, text, text, numeric, numeric, integer, integer
) to authenticated;
