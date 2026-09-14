-- 0054_credit_card_accounts.sql
-- Wallet-backed credit-card metadata foundation. The linked CREDIT_CARD
-- wallet ledger is the only balance source; this table never caches money.

create table public.credit_card_accounts (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid not null unique references public.wallets (id),
  system_pocket_id uuid not null unique references public.pockets (id),
  issuer text check (issuer is null or char_length(issuer) <= 80),
  network text check (network is null or char_length(network) <= 80),
  last_four text check (last_four is null or last_four ~ '^[0-9]{4}$'),
  credit_limit numeric(14, 2) not null check (credit_limit > 0),
  statement_closing_day integer not null check (statement_closing_day between 1 and 31),
  payment_due_day integer not null check (payment_due_day between 1 and 31),
  apr numeric(8, 4) check (apr is null or apr >= 0),
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.credit_card_accounts is
  'Metadata-only 1:1 extension of a CREDIT_CARD wallet. Current balance, liability, card credit and available credit are always derived from transaction_entries through the linked wallet; never cached here.';

create trigger credit_card_accounts_set_updated_at
  before update on public.credit_card_accounts
  for each row execute function public.set_updated_at();

create trigger credit_card_accounts_prevent_identity_changes
  before update on public.credit_card_accounts
  for each row execute function public.prevent_immutable_column_changes('wallet_id', 'system_pocket_id', 'created_by');

create function public.credit_card_account_validate_links()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_wallet public.wallets%rowtype;
  v_pocket public.pockets%rowtype;
begin
  select * into v_wallet from public.wallets where id = new.wallet_id;
  if not found or v_wallet.wallet_type <> 'CREDIT_CARD' then
    raise exception 'Credit-card metadata requires a CREDIT_CARD wallet' using errcode = '23514';
  end if;
  select * into v_pocket from public.pockets where id = new.system_pocket_id;
  if not found or v_pocket.wallet_id <> new.wallet_id then
    raise exception 'Credit-card system pocket must belong to the linked wallet' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger credit_card_accounts_validate_links
  before insert or update on public.credit_card_accounts
  for each row execute function public.credit_card_account_validate_links();

alter table public.credit_card_accounts enable row level security;

create policy credit_card_accounts_select
  on public.credit_card_accounts for select
  using (public.is_wallet_authorized(wallet_id));

revoke all on public.credit_card_accounts from public, anon, authenticated;
grant select on public.credit_card_accounts to authenticated;

-- Clamp a configured day to the last real day of a month (e.g. day 31
-- becomes 28/29 in February). Statement rows will snapshot the resulting
-- concrete date in a later migration.
create function public.credit_card_cycle_date(p_year integer, p_month integer, p_day integer)
returns date
language sql
immutable
security invoker
set search_path = ''
as $$
  select make_date(
    p_year,
    p_month,
    least(p_day, extract(day from (make_date(p_year, p_month, 1) + interval '1 month - 1 day'))::integer)
  )
$$;

-- Managed card wallets use one system pocket because the current ledger
-- requires every entry to reference a pocket. It is infrastructure, not a
-- user budgeting pocket, and cannot be edited/archived independently.
create function public.protect_managed_card_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'wallets' and exists (
    select 1 from public.credit_card_accounts cca where cca.wallet_id = old.id
  ) then
    if new.wallet_type <> old.wallet_type
      or new.scope <> old.scope
      or new.owner_user_id is distinct from old.owner_user_id
      or new.household_id is distinct from old.household_id
      or new.currency <> old.currency
    then
      raise exception 'Managed credit-card identity and currency cannot be changed' using errcode = '23514';
    end if;
  elsif tg_table_name = 'pockets' and exists (
    select 1 from public.credit_card_accounts cca where cca.system_pocket_id = old.id
  ) then
    if new.name <> old.name or new.wallet_id <> old.wallet_id or new.is_archived <> old.is_archived then
      raise exception 'Credit-card system pocket cannot be edited or archived independently' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

create trigger wallets_protect_managed_card_identity
  before update on public.wallets
  for each row execute function public.protect_managed_card_identity();

create trigger pockets_protect_managed_card_identity
  before update on public.pockets
  for each row execute function public.protect_managed_card_identity();

-- Until dedicated card posting RPCs and their classification rows arrive,
-- managed cards are deliberately zero-balance metadata accounts. This DB
-- guard prevents every generic writer (including future callers that forget
-- to filter a selector) from creating an unclassified card posting.
create function public.reject_unclassified_managed_card_entry()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.credit_card_accounts cca where cca.wallet_id = new.wallet_id) then
    raise exception 'Managed credit cards require a dedicated card transaction flow' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger transaction_entries_reject_unclassified_managed_card
  before insert on public.transaction_entries
  for each row execute function public.reject_unclassified_managed_card_entry();

-- Existing CREDIT_CARD wallets remain legacy-compatible, but no new
-- unmanaged card wallet may be created through the raw wallets API.
create function public.reject_new_unmanaged_credit_card_wallet()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.wallet_type = 'CREDIT_CARD'
    and (tg_op = 'INSERT' or old.wallet_type <> 'CREDIT_CARD')
    and coalesce(current_setting('app.creating_managed_card', true), '') <> 'true'
  then
    raise exception 'Create credit cards through create_credit_card_account' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger wallets_reject_new_unmanaged_credit_card
  before insert or update of wallet_type on public.wallets
  for each row execute function public.reject_new_unmanaged_credit_card_wallet();

create function public.create_credit_card_account(
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
  v_pocket_id uuid;
  v_account_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if btrim(coalesce(p_name, '')) = '' or char_length(btrim(p_name)) > 80 then
    raise exception 'Card name is required and must be at most 80 characters' using errcode = '22023';
  end if;
  if p_scope = 'PERSONAL' then
    if p_household_id is not null then raise exception 'Personal card cannot have a household' using errcode = '22023'; end if;
  elsif p_scope = 'HOUSEHOLD' then
    if p_household_id is null or not public.is_household_member(p_household_id) then
      raise exception 'Household not found or not authorized' using errcode = '42501';
    end if;
  else
    raise exception 'Invalid card scope' using errcode = '22023';
  end if;
  if btrim(coalesce(p_currency, '')) !~ '^[A-Za-z]{3}$' then
    raise exception 'Currency must be a 3-letter code' using errcode = '22023';
  end if;
  if p_credit_limit is null or p_credit_limit <= 0 then raise exception 'Credit limit must be positive' using errcode = '22023'; end if;
  if p_statement_closing_day not between 1 and 31 or p_payment_due_day not between 1 and 31 then
    raise exception 'Statement and due days must be between 1 and 31' using errcode = '22023';
  end if;
  if p_apr is not null and p_apr < 0 then raise exception 'APR cannot be negative' using errcode = '22023'; end if;
  if nullif(btrim(coalesce(p_last_four, '')), '') is not null and btrim(p_last_four) !~ '^[0-9]{4}$' then
    raise exception 'Last four digits must contain exactly 4 digits' using errcode = '22023';
  end if;

  perform set_config('app.creating_managed_card', 'true', true);
  insert into public.wallets (scope, owner_user_id, household_id, name, wallet_type, currency, created_by)
  values (
    p_scope,
    case when p_scope = 'PERSONAL' then v_user_id else null end,
    case when p_scope = 'HOUSEHOLD' then p_household_id else null end,
    btrim(p_name), 'CREDIT_CARD', upper(btrim(p_currency)), v_user_id
  ) returning id into v_wallet_id;

  insert into public.pockets (wallet_id, name, sort_order)
  values (v_wallet_id, 'ยอดบัตร', 0) returning id into v_pocket_id;

  insert into public.credit_card_accounts (
    wallet_id, system_pocket_id, issuer, network, last_four, credit_limit,
    statement_closing_day, payment_due_day, apr, created_by
  ) values (
    v_wallet_id, v_pocket_id, nullif(btrim(coalesce(p_issuer, '')), ''),
    nullif(btrim(coalesce(p_network, '')), ''), nullif(btrim(coalesce(p_last_four, '')), ''),
    p_credit_limit, p_statement_closing_day, p_payment_due_day, p_apr, v_user_id
  ) returning id into v_account_id;

  return v_account_id;
end;
$$;

create function public.update_credit_card_account(
  p_account_id uuid,
  p_name text,
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
  v_account public.credit_card_accounts%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  select * into v_account from public.credit_card_accounts where id = p_account_id for update;
  if not found or not public.is_wallet_authorized(v_account.wallet_id) then
    raise exception 'Credit card not found or not authorized' using errcode = '42501';
  end if;
  if btrim(coalesce(p_name, '')) = '' or char_length(btrim(p_name)) > 80 then raise exception 'Invalid card name' using errcode = '22023'; end if;
  if p_credit_limit is null or p_credit_limit <= 0 then raise exception 'Credit limit must be positive' using errcode = '22023'; end if;
  if p_statement_closing_day not between 1 and 31 or p_payment_due_day not between 1 and 31 then raise exception 'Invalid cycle day' using errcode = '22023'; end if;
  if p_apr is not null and p_apr < 0 then raise exception 'APR cannot be negative' using errcode = '22023'; end if;
  if nullif(btrim(coalesce(p_last_four, '')), '') is not null and btrim(p_last_four) !~ '^[0-9]{4}$' then raise exception 'Invalid last four digits' using errcode = '22023'; end if;

  update public.wallets set name = btrim(p_name) where id = v_account.wallet_id;
  update public.credit_card_accounts set
    issuer = nullif(btrim(coalesce(p_issuer, '')), ''),
    network = nullif(btrim(coalesce(p_network, '')), ''),
    last_four = nullif(btrim(coalesce(p_last_four, '')), ''),
    credit_limit = p_credit_limit,
    statement_closing_day = p_statement_closing_day,
    payment_due_day = p_payment_due_day,
    apr = p_apr
  where id = p_account_id;
  return p_account_id;
end;
$$;

create function public.get_credit_card_accounts(p_include_archived boolean default false)
returns table(
  account_id uuid, wallet_id uuid, system_pocket_id uuid, name text, issuer text, network text,
  last_four text, scope public.money_scope, household_id uuid, currency text,
  credit_limit numeric, wallet_balance numeric, liability numeric,
  card_credit numeric, available_credit numeric, statement_closing_day integer,
  payment_due_day integer, apr numeric, is_archived boolean
)
language sql
security invoker
stable
set search_path = ''
as $$
  select cca.id, w.id, cca.system_pocket_id, w.name, cca.issuer, cca.network, cca.last_four,
    w.scope, w.household_id, w.currency, cca.credit_limit,
    balance.amount as wallet_balance,
    greatest(0, -balance.amount) as liability,
    greatest(0, balance.amount) as card_credit,
    cca.credit_limit + balance.amount as available_credit,
    cca.statement_closing_day, cca.payment_due_day, cca.apr, w.is_archived
  from public.credit_card_accounts cca
  join public.wallets w on w.id = cca.wallet_id
  cross join lateral (
    select public.get_wallet_balance(w.id) as amount
  ) balance
  where (p_include_archived or not w.is_archived)
  order by cca.created_at, cca.id
$$;

revoke execute on function public.credit_card_cycle_date(integer,integer,integer) from public, anon;
grant execute on function public.credit_card_cycle_date(integer,integer,integer) to authenticated;
revoke execute on function public.create_credit_card_account(public.money_scope,uuid,text,text,text,text,text,numeric,integer,integer,numeric) from public, anon;
grant execute on function public.create_credit_card_account(public.money_scope,uuid,text,text,text,text,text,numeric,integer,integer,numeric) to authenticated;
revoke execute on function public.update_credit_card_account(uuid,text,text,text,text,numeric,integer,integer,numeric) from public, anon;
grant execute on function public.update_credit_card_account(uuid,text,text,text,text,numeric,integer,integer,numeric) to authenticated;
revoke execute on function public.get_credit_card_accounts(boolean) from public, anon;
grant execute on function public.get_credit_card_accounts(boolean) to authenticated;
