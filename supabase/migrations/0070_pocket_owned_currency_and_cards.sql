-- Wallets are containers. Each pocket owns its account type and currency;
-- a managed credit card is one specialized pocket inside any wallet.

alter table public.pockets
  add column if not exists pocket_type public.wallet_type,
  add column if not exists currency text;

update public.pockets p
set pocket_type = w.wallet_type,
    currency = w.currency
from public.wallets w
where w.id = p.wallet_id
  and (p.pocket_type is null or p.currency is null);

alter table public.pockets
  alter column pocket_type set default 'OTHER',
  alter column pocket_type set not null,
  alter column currency set default 'THB',
  alter column currency set not null;

alter table public.pockets
  add constraint pockets_currency_len_chk check (currency ~ '^[A-Z]{3}$');

-- One container may now hold multiple managed cards.
alter table public.credit_card_accounts
  drop constraint if exists credit_card_accounts_wallet_id_key;

create index if not exists credit_card_accounts_wallet_id_idx
  on public.credit_card_accounts(wallet_id);

create or replace function public.credit_card_account_validate_links()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pocket public.pockets%rowtype;
begin
  select * into v_pocket from public.pockets where id = new.system_pocket_id;
  if not found or v_pocket.wallet_id <> new.wallet_id or v_pocket.pocket_type <> 'CREDIT_CARD' then
    raise exception 'Credit-card metadata requires a CREDIT_CARD pocket in the linked wallet'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function public.protect_managed_card_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'wallets' and exists (
    select 1 from public.credit_card_accounts cca where cca.wallet_id = old.id
  ) then
    if new.scope <> old.scope
      or new.owner_user_id is distinct from old.owner_user_id
      or new.household_id is distinct from old.household_id
    then
      raise exception 'A wallet containing credit cards cannot change ownership or scope'
        using errcode = '23514';
    end if;
  elsif tg_table_name = 'pockets' and exists (
    select 1 from public.credit_card_accounts cca where cca.system_pocket_id = old.id
  ) then
    if new.wallet_id <> old.wallet_id
      or new.pocket_type <> old.pocket_type
      or new.currency <> old.currency
      or new.is_archived <> old.is_archived
    then
      raise exception 'Credit-card pocket identity, currency, and archive state are managed by the card flow'
        using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.reject_unclassified_managed_card_entry()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.credit_card_accounts cca
    where cca.system_pocket_id = new.pocket_id
  ) and coalesce(current_setting('app.creating_classified_card_entry', true), '') <> 'true'
  then
    raise exception 'Managed credit cards require a dedicated card transaction flow'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function public.wallets_require_zero_balance_to_archive()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.is_archived and not old.is_archived and exists (
    select 1
    from public.pockets p
    where p.wallet_id = old.id
      and public.get_pocket_balance(p.id) <> 0
  ) then
    raise exception 'Wallet % has a non-zero pocket balance and cannot be archived', old.id
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function public.create_pocket_with_initial_balance(
  p_wallet_id uuid,
  p_name text,
  p_pocket_type public.wallet_type,
  p_currency text,
  p_initial_balance numeric default 0
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_wallet public.wallets%rowtype;
  v_pocket_id uuid;
  v_transaction_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if not public.is_wallet_authorized(p_wallet_id) then
    raise exception 'Wallet not found or not authorized' using errcode = '42501';
  end if;
  select * into v_wallet from public.wallets where id = p_wallet_id;
  if v_wallet.is_archived then
    raise exception 'Wallet is archived' using errcode = '23514';
  end if;
  if p_pocket_type = 'CREDIT_CARD' then
    raise exception 'Create credit cards through create_credit_card_pocket_with_available_credit'
      using errcode = '23514';
  end if;
  if btrim(coalesce(p_name, '')) = '' or char_length(btrim(p_name)) > 60 then
    raise exception 'Pocket name is required and must be at most 60 characters'
      using errcode = '22023';
  end if;
  if upper(btrim(coalesce(p_currency, ''))) !~ '^[A-Z]{3}$' then
    raise exception 'Currency must be a 3-letter code' using errcode = '22023';
  end if;
  if p_initial_balance is null or p_initial_balance < 0 then
    raise exception 'Initial balance cannot be negative' using errcode = '22023';
  end if;

  insert into public.pockets (wallet_id, name, pocket_type, currency, sort_order)
  values (
    p_wallet_id,
    btrim(p_name),
    p_pocket_type,
    upper(btrim(p_currency)),
    coalesce((select max(sort_order) + 1 from public.pockets where wallet_id = p_wallet_id), 0)
  ) returning id into v_pocket_id;

  if p_initial_balance > 0 then
    insert into public.transactions (
      scope, owner_user_id, household_id, transaction_type, category_id,
      title, note, occurred_at, created_by
    ) values (
      v_wallet.scope, v_wallet.owner_user_id, v_wallet.household_id,
      'OPENING_BALANCE', null, 'ยอดเงินเริ่มต้น', null, now(), auth.uid()
    ) returning id into v_transaction_id;

    insert into public.transaction_entries (transaction_id, wallet_id, pocket_id, amount)
    values (v_transaction_id, p_wallet_id, v_pocket_id, p_initial_balance);
  end if;

  return v_pocket_id;
end;
$$;

revoke execute on function public.create_pocket_with_initial_balance(
  uuid, text, public.wallet_type, text, numeric
) from public, anon;
grant execute on function public.create_pocket_with_initial_balance(
  uuid, text, public.wallet_type, text, numeric
) to authenticated;

create or replace function public.create_credit_card_balance_adjustment(
  p_card_account_id uuid,
  p_target_wallet_balance numeric,
  p_note text default null,
  p_occurred_at timestamptz default now()
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_card public.credit_card_accounts%rowtype;
  v_wallet public.wallets%rowtype;
  v_current numeric(14,2);
  v_delta numeric(14,2);
  v_transaction_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if p_target_wallet_balance is null then raise exception 'Target balance is required' using errcode='22023'; end if;
  select * into v_card from public.credit_card_accounts where id=p_card_account_id for update;
  if not found or not public.is_wallet_authorized(v_card.wallet_id) then
    raise exception 'Credit card not found or not authorized' using errcode='42501';
  end if;
  select * into v_wallet from public.wallets where id=v_card.wallet_id;
  if v_wallet.is_archived then raise exception 'Credit card container is archived' using errcode='23514'; end if;
  v_current := public.get_pocket_balance(v_card.system_pocket_id);
  v_delta := p_target_wallet_balance-v_current;
  if v_delta=0 then raise exception 'Card balance already matches target' using errcode='22023'; end if;

  insert into public.transactions(scope,owner_user_id,household_id,transaction_type,category_id,title,note,occurred_at,created_by)
  values(v_wallet.scope,v_wallet.owner_user_id,v_wallet.household_id,'CARD_ADJUSTMENT',null,
    'ปรับยอดบัตรเครดิต',nullif(trim(p_note),''),coalesce(p_occurred_at,now()),auth.uid())
  returning id into v_transaction_id;
  perform set_config('app.creating_classified_card_entry','true',true);
  insert into public.transaction_entries(transaction_id,wallet_id,pocket_id,amount)
  values(v_transaction_id,v_card.wallet_id,v_card.system_pocket_id,v_delta);
  insert into public.credit_card_liability_events(card_account_id,event_kind,amount,transaction_id,created_by)
  values(p_card_account_id,'BALANCE_ADJUSTMENT',-v_delta,v_transaction_id,auth.uid());
  return v_transaction_id;
end;
$$;

create or replace function public.create_credit_card_pocket_with_available_credit(
  p_wallet_id uuid,
  p_name text,
  p_currency text,
  p_credit_limit numeric,
  p_available_credit numeric,
  p_statement_closing_day integer,
  p_payment_due_day integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_wallet public.wallets%rowtype;
  v_pocket_id uuid;
  v_account_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if not public.is_wallet_authorized(p_wallet_id) then
    raise exception 'Wallet not found or not authorized' using errcode='42501';
  end if;
  select * into v_wallet from public.wallets where id=p_wallet_id;
  if v_wallet.is_archived then raise exception 'Wallet is archived' using errcode='23514'; end if;
  if btrim(coalesce(p_name,''))='' or char_length(btrim(p_name))>60 then
    raise exception 'Card name is required and must be at most 60 characters' using errcode='22023';
  end if;
  if upper(btrim(coalesce(p_currency,''))) !~ '^[A-Z]{3}$' then
    raise exception 'Currency must be a 3-letter code' using errcode='22023';
  end if;
  if p_credit_limit is null or p_credit_limit<=0 then
    raise exception 'Credit limit must be positive' using errcode='22023';
  end if;
  if p_available_credit is null or p_available_credit<0 or p_available_credit>p_credit_limit then
    raise exception 'Available credit must be between zero and the credit limit' using errcode='22023';
  end if;
  if p_statement_closing_day not between 1 and 31 or p_payment_due_day not between 1 and 31 then
    raise exception 'Statement and due days must be between 1 and 31' using errcode='22023';
  end if;

  perform set_config('app.creating_managed_card','true',true);
  insert into public.pockets(wallet_id,name,pocket_type,currency,sort_order)
  values(
    p_wallet_id,btrim(p_name),'CREDIT_CARD',upper(btrim(p_currency)),
    coalesce((select max(sort_order)+1 from public.pockets where wallet_id=p_wallet_id),0)
  ) returning id into v_pocket_id;

  insert into public.credit_card_accounts(
    wallet_id,system_pocket_id,credit_limit,statement_closing_day,payment_due_day,created_by
  ) values(
    p_wallet_id,v_pocket_id,p_credit_limit,p_statement_closing_day,p_payment_due_day,auth.uid()
  ) returning id into v_account_id;

  if p_available_credit<p_credit_limit then
    perform public.create_credit_card_balance_adjustment(
      v_account_id,p_available_credit-p_credit_limit,'ยอดค้างเริ่มต้น',now()
    );
  end if;
  return v_pocket_id;
end;
$$;

revoke execute on function public.create_credit_card_pocket_with_available_credit(
  uuid, text, text, numeric, numeric, integer, integer
) from public, anon;
grant execute on function public.create_credit_card_pocket_with_available_credit(
  uuid, text, text, numeric, numeric, integer, integer
) to authenticated;

create or replace function public.create_wallet_container_with_first_pocket(
  p_scope public.money_scope,
  p_owner_user_id uuid,
  p_household_id uuid,
  p_name text,
  p_first_pocket_name text,
  p_first_pocket_type public.wallet_type,
  p_currency text,
  p_initial_balance numeric default 0,
  p_credit_limit numeric default null,
  p_available_credit numeric default null,
  p_statement_closing_day integer default null,
  p_payment_due_day integer default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_wallet_id uuid;
begin
  if v_user_id is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if btrim(coalesce(p_name,''))='' or char_length(btrim(p_name))>80 then
    raise exception 'Wallet name is required and must be at most 80 characters' using errcode='22023';
  end if;
  if p_scope='PERSONAL' then
    if p_owner_user_id is distinct from v_user_id or p_household_id is not null then
      raise exception 'Invalid personal wallet owner' using errcode='42501';
    end if;
  elsif p_scope='HOUSEHOLD' then
    if p_owner_user_id is not null or p_household_id is null or not public.is_household_member(p_household_id) then
      raise exception 'Household not found or not authorized' using errcode='42501';
    end if;
  else
    raise exception 'Invalid wallet scope' using errcode='22023';
  end if;

  insert into public.wallets(scope,owner_user_id,household_id,name,wallet_type,currency,created_by)
  values(
    p_scope,p_owner_user_id,p_household_id,btrim(p_name),'OTHER',
    upper(btrim(p_currency)),v_user_id
  ) returning id into v_wallet_id;

  if p_first_pocket_type='CREDIT_CARD' then
    perform public.create_credit_card_pocket_with_available_credit(
      v_wallet_id,p_first_pocket_name,p_currency,p_credit_limit,p_available_credit,
      p_statement_closing_day,p_payment_due_day
    );
  else
    perform public.create_pocket_with_initial_balance(
      v_wallet_id,p_first_pocket_name,p_first_pocket_type,p_currency,p_initial_balance
    );
  end if;
  return v_wallet_id;
end;
$$;

revoke execute on function public.create_wallet_container_with_first_pocket(
  public.money_scope, uuid, uuid, text, text, public.wallet_type, text,
  numeric, numeric, numeric, integer, integer
) from public, anon;
grant execute on function public.create_wallet_container_with_first_pocket(
  public.money_scope, uuid, uuid, text, text, public.wallet_type, text,
  numeric, numeric, numeric, integer, integer
) to authenticated;

-- Keep the previous public RPC working while the web deployment rolls over.
-- It still creates a dedicated container, but the card identity now lives on
-- its first Pocket and the function keeps its original account-id return type.
create or replace function public.create_credit_card_account(
  p_scope public.money_scope,
  p_household_id uuid,
  p_name text,
  p_currency text,
  p_issuer text,
  p_network text,
  p_last_four text,
  p_credit_limit numeric,
  p_statement_closing_day integer,
  p_payment_due_day integer,
  p_apr numeric
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_wallet_id uuid;
  v_account_id uuid;
begin
  if p_apr is not null and p_apr < 0 then
    raise exception 'APR cannot be negative' using errcode='22023';
  end if;
  if nullif(btrim(coalesce(p_last_four,'')),'') is not null
    and btrim(p_last_four) !~ '^[0-9]{4}$' then
    raise exception 'Last four digits must contain exactly 4 digits' using errcode='22023';
  end if;

  v_wallet_id := public.create_wallet_container_with_first_pocket(
    p_scope,
    case when p_scope='PERSONAL' then v_user_id else null end,
    p_household_id,
    p_name,
    p_name,
    'CREDIT_CARD',
    p_currency,
    0,
    p_credit_limit,
    p_credit_limit,
    p_statement_closing_day,
    p_payment_due_day
  );

  select id into v_account_id
  from public.credit_card_accounts
  where wallet_id=v_wallet_id;

  update public.credit_card_accounts
  set issuer=nullif(btrim(coalesce(p_issuer,'')),''),
      network=nullif(btrim(coalesce(p_network,'')),''),
      last_four=nullif(btrim(coalesce(p_last_four,'')),''),
      apr=p_apr
  where id=v_account_id;

  return v_account_id;
end;
$$;

create or replace function public.get_credit_card_accounts(p_include_archived boolean default false)
returns table(
  account_id uuid, wallet_id uuid, system_pocket_id uuid, name text,
  issuer text, network text, last_four text, scope public.money_scope,
  household_id uuid, currency text, credit_limit numeric,
  wallet_balance numeric, liability numeric, card_credit numeric,
  available_credit numeric, statement_closing_day integer,
  payment_due_day integer, apr numeric, is_archived boolean
)
language sql
stable
set search_path = ''
as $$
  select cca.id, w.id, p.id, p.name, cca.issuer, cca.network, cca.last_four,
    w.scope, w.household_id, p.currency, cca.credit_limit,
    balance.amount as wallet_balance,
    greatest(0,-balance.amount) as liability,
    greatest(0,balance.amount) as card_credit,
    cca.credit_limit+balance.amount as available_credit,
    cca.statement_closing_day,cca.payment_due_day,cca.apr,
    (w.is_archived or p.is_archived) as is_archived
  from public.credit_card_accounts cca
  join public.wallets w on w.id=cca.wallet_id
  join public.pockets p on p.id=cca.system_pocket_id
  cross join lateral (select public.get_pocket_balance(p.id) as amount) balance
  where (p_include_archived or (not w.is_archived and not p.is_archived))
  order by cca.created_at,cca.id
$$;

create or replace function public.create_pocket_transfer(
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
  v_from public.pockets%rowtype;
  v_to public.pockets%rowtype;
  v_transaction_id uuid;
  v_charge_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if p_amount is null or p_amount<=0 then raise exception 'Amount must be positive' using errcode='22023'; end if;
  if p_from_pocket_id=p_to_pocket_id then raise exception 'Pockets must differ' using errcode='22023'; end if;
  perform public.validate_optional_charge_amount(p_fee_amount,p_fee_category_id,'Fee ');
  perform public.validate_optional_charge_amount(p_interest_amount,p_interest_category_id,'Interest ');
  if not public.is_wallet_authorized(p_wallet_id) then raise exception 'Wallet not authorized' using errcode='42501'; end if;
  select * into v_wallet from public.wallets where id=p_wallet_id;
  select * into v_from from public.pockets where id=p_from_pocket_id and wallet_id=p_wallet_id;
  if not found then raise exception 'Source pocket not found in wallet' using errcode='23514'; end if;
  select * into v_to from public.pockets where id=p_to_pocket_id and wallet_id=p_wallet_id;
  if not found then raise exception 'Destination pocket not found in wallet' using errcode='23514'; end if;
  if v_wallet.is_archived or v_from.is_archived or v_to.is_archived then raise exception 'Archived account cannot be used' using errcode='23514'; end if;
  if v_from.currency<>v_to.currency then raise exception 'Transfers require matching pocket currencies' using errcode='23514'; end if;

  insert into public.transactions(scope,owner_user_id,household_id,transaction_type,category_id,title,note,occurred_at,created_by)
  values(v_wallet.scope,v_wallet.owner_user_id,v_wallet.household_id,'TRANSFER',null,p_title,p_note,coalesce(p_occurred_at,now()),auth.uid())
  returning id into v_transaction_id;
  insert into public.transaction_entries(transaction_id,wallet_id,pocket_id,amount)
  values(v_transaction_id,p_wallet_id,p_from_pocket_id,-p_amount),(v_transaction_id,p_wallet_id,p_to_pocket_id,p_amount);
  if p_tag_ids is not null and array_length(p_tag_ids,1)>0 then perform public.assign_transaction_tags(v_transaction_id,p_tag_ids); end if;
  if p_fee_amount is not null then
    v_charge_id:=public.create_income_expense_transaction('EXPENSE',p_wallet_id,p_from_pocket_id,p_fee_category_id,p_fee_amount,p_title,p_note,coalesce(p_occurred_at,now()));
    insert into public.transfer_ledger_links(charge_transaction_id,transfer_transaction_id,kind) values(v_charge_id,v_transaction_id,'FEE');
  end if;
  if p_interest_amount is not null then
    v_charge_id:=public.create_income_expense_transaction('EXPENSE',p_wallet_id,p_from_pocket_id,p_interest_category_id,p_interest_amount,p_title,p_note,coalesce(p_occurred_at,now()));
    insert into public.transfer_ledger_links(charge_transaction_id,transfer_transaction_id,kind) values(v_charge_id,v_transaction_id,'INTEREST');
  end if;
  return v_transaction_id;
end;
$$;

create or replace function public.create_wallet_transfer(
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
  v_from public.pockets%rowtype;
  v_to public.pockets%rowtype;
  v_transaction_id uuid;
  v_charge_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if p_amount is null or p_amount<=0 then raise exception 'Amount must be positive' using errcode='22023'; end if;
  perform public.validate_optional_charge_amount(p_fee_amount,p_fee_category_id,'Fee ');
  perform public.validate_optional_charge_amount(p_interest_amount,p_interest_category_id,'Interest ');
  if not public.is_wallet_authorized(p_from_wallet_id) or not public.is_wallet_authorized(p_to_wallet_id) then
    raise exception 'Wallet not found or not authorized' using errcode='42501';
  end if;
  select * into v_from_wallet from public.wallets where id=p_from_wallet_id;
  select * into v_to_wallet from public.wallets where id=p_to_wallet_id;
  select * into v_from from public.pockets where id=p_from_pocket_id and wallet_id=p_from_wallet_id;
  if not found then raise exception 'Source pocket does not belong to source wallet' using errcode='23514'; end if;
  select * into v_to from public.pockets where id=p_to_pocket_id and wallet_id=p_to_wallet_id;
  if not found then raise exception 'Destination pocket does not belong to destination wallet' using errcode='23514'; end if;
  if v_from_wallet.is_archived or v_to_wallet.is_archived or v_from.is_archived or v_to.is_archived then
    raise exception 'Archived account cannot be used' using errcode='23514';
  end if;
  if v_from_wallet.scope<>v_to_wallet.scope
    or v_from_wallet.owner_user_id is distinct from v_to_wallet.owner_user_id
    or v_from_wallet.household_id is distinct from v_to_wallet.household_id then
    raise exception 'Both pockets must share the same owner or household' using errcode='23514';
  end if;
  if v_from.currency<>v_to.currency then raise exception 'Transfers require matching pocket currencies' using errcode='23514'; end if;

  insert into public.transactions(scope,owner_user_id,household_id,transaction_type,category_id,title,note,occurred_at,created_by)
  values(v_from_wallet.scope,v_from_wallet.owner_user_id,v_from_wallet.household_id,'TRANSFER',null,p_title,p_note,coalesce(p_occurred_at,now()),auth.uid())
  returning id into v_transaction_id;
  insert into public.transaction_entries(transaction_id,wallet_id,pocket_id,amount)
  values(v_transaction_id,p_from_wallet_id,p_from_pocket_id,-p_amount),(v_transaction_id,p_to_wallet_id,p_to_pocket_id,p_amount);
  if p_tag_ids is not null and array_length(p_tag_ids,1)>0 then perform public.assign_transaction_tags(v_transaction_id,p_tag_ids); end if;
  if p_fee_amount is not null then
    v_charge_id:=public.create_income_expense_transaction('EXPENSE',p_from_wallet_id,p_from_pocket_id,p_fee_category_id,p_fee_amount,p_title,p_note,coalesce(p_occurred_at,now()));
    insert into public.transfer_ledger_links(charge_transaction_id,transfer_transaction_id,kind) values(v_charge_id,v_transaction_id,'FEE');
  end if;
  if p_interest_amount is not null then
    v_charge_id:=public.create_income_expense_transaction('EXPENSE',p_from_wallet_id,p_from_pocket_id,p_interest_category_id,p_interest_amount,p_title,p_note,coalesce(p_occurred_at,now()));
    insert into public.transfer_ledger_links(charge_transaction_id,transfer_transaction_id,kind) values(v_charge_id,v_transaction_id,'INTEREST');
  end if;
  return v_transaction_id;
end;
$$;

create or replace function public.get_finance_hub_summary(
  p_month_start timestamptz,
  p_month_end timestamptz
)
returns jsonb
language sql
stable
set search_path = ''
as $$
  with wallet_balances as (
    select w.id, p.currency,
      coalesce(sum(e.amount) filter(where t.deleted_at is null),0) as amount
    from public.wallets w
    join public.pockets p on p.wallet_id=w.id and not p.is_archived
    left join public.transaction_entries e on e.pocket_id=p.id
    left join public.transactions t on t.id=e.transaction_id
    where not w.is_archived
    group by w.id,p.currency
  ), currency_totals as (
    select currency,sum(amount)::text as amount from wallet_balances group by currency order by currency
  ), monthly_entries as (
    select p.currency,t.transaction_type,e.amount
    from public.transactions t
    join public.transaction_entries e on e.transaction_id=t.id
    join public.pockets p on p.id=e.pocket_id
    where t.deleted_at is null and t.occurred_at>=p_month_start and t.occurred_at<p_month_end
      and t.transaction_type in('INCOME','EXPENSE')
      and not exists(select 1 from public.household_attributed_expense_effects v where v.transaction_id=t.id)
  ), monthly as (
    select currency,
      coalesce(sum(amount) filter(where transaction_type='INCOME'),0)::text as income,
      coalesce(sum(-amount) filter(where transaction_type='EXPENSE'),0)::text as expense
    from monthly_entries group by currency
  ), category_entries as (
    select t.category_id,coalesce(c.name,'ไม่ทราบหมวดหมู่') as name,p.currency,e.amount
    from public.transactions t
    join public.transaction_entries e on e.transaction_id=t.id
    join public.pockets p on p.id=e.pocket_id
    left join public.categories c on c.id=t.category_id
    where t.deleted_at is null and t.transaction_type='EXPENSE'
      and t.occurred_at>=p_month_start and t.occurred_at<p_month_end
      and not exists(select 1 from public.household_attributed_expense_effects v where v.transaction_id=t.id)
  ), category_totals as (
    select category_id,name,currency,sum(-amount)::text as amount
    from category_entries group by category_id,name,currency order by sum(-amount) desc,name limit 5
  )
  select jsonb_build_object(
    'wallet_balances',coalesce((select jsonb_agg(jsonb_build_object('wallet_id',id,'currency',currency,'amount',amount::text) order by id,currency) from wallet_balances),'[]'::jsonb),
    'currency_totals',coalesce((select jsonb_agg(jsonb_build_object('currency',currency,'amount',amount) order by currency) from currency_totals),'[]'::jsonb),
    'month_totals',coalesce((select jsonb_agg(jsonb_build_object('currency',currency,'income',income,'expense',expense) order by currency) from monthly),'[]'::jsonb),
    'category_totals',coalesce((select jsonb_agg(jsonb_build_object('category_id',category_id,'name',name,'currency',currency,'amount',amount)) from category_totals),'[]'::jsonb)
  )
$$;

grant select on public.pockets to authenticated;
