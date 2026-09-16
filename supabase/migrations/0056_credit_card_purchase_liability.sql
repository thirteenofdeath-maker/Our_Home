-- 0056_credit_card_purchase_liability.sql
-- First real card-ledger slice: PURCHASE and PURCHASE_REFUND.
-- The card wallet remains the only monetary source of truth. This table is
-- an append-only classification index over the exact same ledger postings.

create table public.credit_card_liability_events (
  id uuid primary key default gen_random_uuid(),
  card_account_id uuid not null references public.credit_card_accounts (id),
  event_kind text not null check (event_kind in (
    'PURCHASE', 'INTEREST_CHARGE', 'FEE_CHARGE', 'LATE_FEE_CHARGE',
    'PAYMENT_PRINCIPAL', 'PAYMENT_INTEREST', 'PAYMENT_FEE', 'PAYMENT_LATE_FEE',
    'PURCHASE_REFUND', 'CASHBACK', 'CASH_ADVANCE', 'BALANCE_ADJUSTMENT'
  )),
  amount numeric(14, 2) not null check (amount <> 0),
  transaction_id uuid not null references public.transactions (id),
  reverses_event_id uuid references public.credit_card_liability_events (id),
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  constraint credit_card_liability_events_transaction_kind_uniq unique (transaction_id, event_kind),
  constraint credit_card_liability_events_not_self_reverse_chk check (reverses_event_id is null or reverses_event_id <> id),
  constraint credit_card_liability_events_purchase_sign_chk check (
    (event_kind in ('PURCHASE', 'INTEREST_CHARGE', 'FEE_CHARGE', 'LATE_FEE_CHARGE', 'CASH_ADVANCE') and amount > 0)
    or (event_kind in ('PAYMENT_PRINCIPAL', 'PAYMENT_INTEREST', 'PAYMENT_FEE', 'PAYMENT_LATE_FEE', 'PURCHASE_REFUND', 'CASHBACK') and amount < 0)
    or event_kind = 'BALANCE_ADJUSTMENT'
  )
);

create index credit_card_liability_events_card_idx
  on public.credit_card_liability_events (card_account_id, created_at desc);
create index credit_card_liability_events_reverses_idx
  on public.credit_card_liability_events (reverses_event_id)
  where reverses_event_id is not null;

comment on table public.credit_card_liability_events is
  'Append-only classification of real card-wallet ledger postings. amount is liability-signed: purchase/charge positive, payment/refund/cashback negative. Every event links a real transaction; balances are never read from this table instead of get_wallet_balance.';

alter table public.credit_card_liability_events enable row level security;

create policy credit_card_liability_events_select
  on public.credit_card_liability_events for select
  using (
    exists (
      select 1
      from public.credit_card_accounts cca
      where cca.id = credit_card_liability_events.card_account_id
        and public.is_wallet_authorized(cca.wallet_id)
    )
  );

revoke all on public.credit_card_liability_events from public, anon, authenticated;
grant select on public.credit_card_liability_events to authenticated;

-- Active effects only. Voiding/restoring the linked transaction therefore
-- changes both the wallet balance and classified liability in lockstep.
create view public.credit_card_liability_effects
with (security_invoker = true)
as
  select e.*, t.deleted_at, t.occurred_at
  from public.credit_card_liability_events e
  join public.transactions t on t.id = e.transaction_id;

grant select on public.credit_card_liability_effects to authenticated;

-- Replace 0054's temporary total block with a narrowly-scoped internal
-- bypass. A caller cannot set this through PostgREST; only dedicated
-- SECURITY DEFINER card RPCs below set it, transaction-locally.
create or replace function public.reject_unclassified_managed_card_entry()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.credit_card_accounts cca where cca.wallet_id = new.wallet_id)
    and coalesce(current_setting('app.creating_classified_card_entry', true), '') <> 'true'
  then
    raise exception 'Managed credit cards require a dedicated card transaction flow' using errcode = '23514';
  end if;
  return new;
end;
$$;

-- Card-linked money/category/date cannot be changed through the generic
-- editor because that would desynchronise its immutable classification.
-- Title/note and void/restore metadata remain safe; amount corrections use
-- refund/void now and the dedicated adjustment flow later.
create function public.protect_card_linked_transaction_header()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.credit_card_liability_events e where e.transaction_id = old.id)
    and (
      new.scope is distinct from old.scope
      or new.owner_user_id is distinct from old.owner_user_id
      or new.household_id is distinct from old.household_id
      or new.transaction_type is distinct from old.transaction_type
      or new.category_id is distinct from old.category_id
      or new.occurred_at is distinct from old.occurred_at
    )
  then
    raise exception 'Card-linked accounting fields are immutable; void/refund or use a dedicated card correction flow' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger transactions_protect_card_linked_header
  before update on public.transactions
  for each row execute function public.protect_card_linked_transaction_header();

create function public.protect_card_linked_entry()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.credit_card_liability_events e where e.transaction_id = old.transaction_id)
    and (
      tg_op = 'DELETE'
      or new.wallet_id is distinct from old.wallet_id
      or new.pocket_id is distinct from old.pocket_id
      or new.amount is distinct from old.amount
    )
  then
    raise exception 'Card-linked ledger entries are immutable; void/refund or use a dedicated card correction flow' using errcode = '23514';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger transaction_entries_protect_card_linked_update
  before update on public.transaction_entries
  for each row execute function public.protect_card_linked_entry();
create trigger transaction_entries_protect_card_linked_delete
  before delete on public.transaction_entries
  for each row execute function public.protect_card_linked_entry();

-- A card purchase refund must return to the same card and create its
-- PURCHASE_REFUND event atomically. This closes the generic refund route.
create function public.require_classified_card_purchase_refund()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_card_wallet_id uuid;
  v_refund_wallet_id uuid;
begin
  select cca.wallet_id into v_card_wallet_id
  from public.credit_card_liability_events e
  join public.credit_card_accounts cca on cca.id = e.card_account_id
  where e.transaction_id = new.original_expense_transaction_id
    and e.event_kind = 'PURCHASE';

  if found and new.adjustment_kind = 'REFUND' then
    if coalesce(current_setting('app.creating_card_purchase_refund', true), '') <> 'true' then
      raise exception 'Card purchases require the dedicated card refund flow' using errcode = '23514';
    end if;
    select wallet_id into v_refund_wallet_id
    from public.transaction_entries
    where transaction_id = new.transaction_id;
    if v_refund_wallet_id is distinct from v_card_wallet_id then
      raise exception 'A card purchase refund must return to the original card' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

create trigger expense_adjustments_require_card_refund_flow
  before insert on public.expense_adjustments
  for each row execute function public.require_classified_card_purchase_refund();

create function public.create_card_purchase(
  p_card_account_id uuid,
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
  v_card public.credit_card_accounts%rowtype;
  v_wallet public.wallets%rowtype;
  v_transaction_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Amount must be positive' using errcode = '22023'; end if;

  select * into v_card from public.credit_card_accounts where id = p_card_account_id for update;
  if not found or not public.is_wallet_authorized(v_card.wallet_id) then
    raise exception 'Credit card not found or not authorized' using errcode = '42501';
  end if;
  select * into v_wallet from public.wallets where id = v_card.wallet_id;
  if v_wallet.is_archived then raise exception 'Credit card is archived' using errcode = '23514'; end if;

  perform set_config('app.creating_classified_card_entry', 'true', true);
  v_transaction_id := public.create_income_expense_transaction(
    'EXPENSE', v_card.wallet_id, v_card.system_pocket_id, p_category_id,
    p_amount, p_title, p_note, coalesce(p_occurred_at, now()), p_tag_ids
  );

  insert into public.credit_card_liability_events (
    card_account_id, event_kind, amount, transaction_id, created_by
  ) values (p_card_account_id, 'PURCHASE', p_amount, v_transaction_id, auth.uid());
  return v_transaction_id;
end;
$$;

create function public.create_attributed_card_purchase(
  p_card_account_id uuid,
  p_household_id uuid,
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
  v_card public.credit_card_accounts%rowtype;
  v_wallet public.wallets%rowtype;
  v_transaction_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  select * into v_card from public.credit_card_accounts where id = p_card_account_id for update;
  if not found or not public.is_wallet_authorized(v_card.wallet_id) then
    raise exception 'Credit card not found or not authorized' using errcode = '42501';
  end if;
  select * into v_wallet from public.wallets where id = v_card.wallet_id;
  if v_wallet.scope <> 'PERSONAL' or v_wallet.owner_user_id <> auth.uid() then
    raise exception 'Only your PERSONAL card can fund an attributed household purchase' using errcode = '23514';
  end if;
  if v_wallet.is_archived then raise exception 'Credit card is archived' using errcode = '23514'; end if;

  perform set_config('app.creating_classified_card_entry', 'true', true);
  v_transaction_id := public.create_attributed_household_expense(
    p_household_id, p_household_category_id, v_card.wallet_id,
    v_card.system_pocket_id, p_amount, p_title, p_note,
    coalesce(p_occurred_at, now())
  );
  insert into public.credit_card_liability_events (
    card_account_id, event_kind, amount, transaction_id, created_by
  ) values (p_card_account_id, 'PURCHASE', p_amount, v_transaction_id, auth.uid());
  return v_transaction_id;
end;
$$;

create function public.create_card_purchase_refund(
  p_original_purchase_transaction_id uuid,
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
  v_purchase public.credit_card_liability_events%rowtype;
  v_card public.credit_card_accounts%rowtype;
  v_transaction_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Amount must be positive' using errcode = '22023'; end if;

  select * into v_purchase
  from public.credit_card_liability_events
  where transaction_id = p_original_purchase_transaction_id and event_kind = 'PURCHASE'
  for update;
  if not found then raise exception 'Card purchase not found' using errcode = 'P0002'; end if;
  select * into v_card from public.credit_card_accounts where id = v_purchase.card_account_id for update;
  if not public.is_wallet_authorized(v_card.wallet_id) then
    raise exception 'Card purchase not found or not authorized' using errcode = '42501';
  end if;

  perform set_config('app.creating_classified_card_entry', 'true', true);
  perform set_config('app.creating_card_purchase_refund', 'true', true);
  v_transaction_id := public.create_expense_adjustment_transaction(
    p_original_purchase_transaction_id, 'REFUND', v_card.wallet_id,
    v_card.system_pocket_id, p_amount, p_title, p_note,
    coalesce(p_occurred_at, now()), p_tag_ids
  );
  insert into public.credit_card_liability_events (
    card_account_id, event_kind, amount, transaction_id, reverses_event_id, created_by
  ) values (
    v_purchase.card_account_id, 'PURCHASE_REFUND', -p_amount,
    v_transaction_id, v_purchase.id, auth.uid()
  );
  return v_transaction_id;
end;
$$;

create function public.get_credit_card_activity(p_card_account_id uuid, p_limit integer default 50)
returns table (
  event_id uuid, event_kind text, amount numeric, transaction_id uuid,
  occurred_at timestamptz, title text, category_name text, is_voided boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare v_wallet_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  select wallet_id into v_wallet_id from public.credit_card_accounts where id = p_card_account_id;
  if not found or not public.is_wallet_authorized(v_wallet_id) then
    raise exception 'Credit card not found or not authorized' using errcode = '42501';
  end if;
  return query
    select e.id, e.event_kind, e.amount, e.transaction_id, t.occurred_at,
      t.title, c.name, t.deleted_at is not null
    from public.credit_card_liability_events e
    join public.transactions t on t.id = e.transaction_id
    left join public.categories c on c.id = t.category_id
    where e.card_account_id = p_card_account_id
    order by t.occurred_at desc, e.created_at desc
    limit greatest(1, least(coalesce(p_limit, 50), 200));
end;
$$;

revoke execute on function public.create_card_purchase(uuid,uuid,numeric,text,text,timestamptz,uuid[]) from public, anon;
grant execute on function public.create_card_purchase(uuid,uuid,numeric,text,text,timestamptz,uuid[]) to authenticated;
revoke execute on function public.create_attributed_card_purchase(uuid,uuid,uuid,numeric,text,text,timestamptz) from public, anon;
grant execute on function public.create_attributed_card_purchase(uuid,uuid,uuid,numeric,text,text,timestamptz) to authenticated;
revoke execute on function public.create_card_purchase_refund(uuid,numeric,text,text,timestamptz,uuid[]) from public, anon;
grant execute on function public.create_card_purchase_refund(uuid,numeric,text,text,timestamptz,uuid[]) to authenticated;
revoke execute on function public.get_credit_card_activity(uuid,integer) from public, anon;
grant execute on function public.get_credit_card_activity(uuid,integer) to authenticated;

revoke execute on function public.protect_card_linked_transaction_header() from public, anon, authenticated;
revoke execute on function public.protect_card_linked_entry() from public, anon, authenticated;
revoke execute on function public.require_classified_card_purchase_refund() from public, anon, authenticated;
