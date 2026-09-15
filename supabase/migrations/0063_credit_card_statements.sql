-- Immutable card statements and payment/credit allocation rows.

create table public.credit_card_statements (
  id uuid primary key default gen_random_uuid(),
  card_account_id uuid not null references public.credit_card_accounts(id),
  period_start date not null,
  period_end date not null,
  due_date date not null,
  statement_balance numeric(14,2) not null check(statement_balance>=0),
  minimum_amount_due numeric(14,2) not null default 0 check(minimum_amount_due>=0 and minimum_amount_due<=statement_balance),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  constraint credit_card_statements_period_chk check(period_start<=period_end and period_end<due_date),
  constraint credit_card_statements_card_period_uniq unique(card_account_id,period_end)
);
create index credit_card_statements_card_due_idx on public.credit_card_statements(card_account_id,due_date desc);

create table public.credit_card_statement_allocations (
  id uuid primary key default gen_random_uuid(),
  statement_id uuid not null references public.credit_card_statements(id),
  liability_event_id uuid not null references public.credit_card_liability_events(id),
  allocation_kind text not null check(allocation_kind in ('PAYMENT','CREDIT')),
  amount numeric(14,2) not null check(amount>0),
  created_at timestamptz not null default now(),
  constraint credit_card_statement_allocations_uniq unique(statement_id,liability_event_id)
);
create index credit_card_statement_allocations_event_idx on public.credit_card_statement_allocations(liability_event_id);

alter table public.credit_card_statements enable row level security;
alter table public.credit_card_statement_allocations enable row level security;
create policy credit_card_statements_select on public.credit_card_statements for select to authenticated
using(exists(select 1 from public.credit_card_accounts c where c.id=card_account_id and public.is_wallet_authorized(c.wallet_id)));
create policy credit_card_statement_allocations_select on public.credit_card_statement_allocations for select to authenticated
using(exists(select 1 from public.credit_card_statements s join public.credit_card_accounts c on c.id=s.card_account_id where s.id=statement_id and public.is_wallet_authorized(c.wallet_id)));
revoke all on public.credit_card_statements,public.credit_card_statement_allocations from public,anon,authenticated;
grant select on public.credit_card_statements,public.credit_card_statement_allocations to authenticated;

create function public.protect_credit_card_statement_rows()
returns trigger language plpgsql security definer set search_path=''
as $$ begin raise exception 'Credit-card statement records are immutable' using errcode='23514'; end; $$;
create trigger credit_card_statements_immutable before update or delete on public.credit_card_statements
for each row execute function public.protect_credit_card_statement_rows();
create trigger credit_card_statement_allocations_immutable before update or delete on public.credit_card_statement_allocations
for each row execute function public.protect_credit_card_statement_rows();
revoke execute on function public.protect_credit_card_statement_rows() from public,anon,authenticated;

create function public.issue_credit_card_statement(
  p_card_account_id uuid,p_period_start date,p_period_end date,p_due_date date,p_minimum_amount_due numeric default 0
) returns uuid language plpgsql security definer set search_path=''
as $$
declare v_card public.credit_card_accounts%rowtype; v_wallet public.wallets%rowtype; v_balance numeric(14,2); v_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='28000'; end if;
  select * into v_card from public.credit_card_accounts where id=p_card_account_id for update;
  if not found or not public.is_wallet_authorized(v_card.wallet_id) then raise exception 'Credit card not found or not authorized' using errcode='42501'; end if;
  select * into v_wallet from public.wallets where id=v_card.wallet_id;
  if v_wallet.is_archived then raise exception 'Credit card is archived' using errcode='23514'; end if;
  if p_period_start is null or p_period_end is null or p_due_date is null or p_period_start>p_period_end or p_period_end>=p_due_date then
    raise exception 'Invalid statement period or due date' using errcode='22023';
  end if;
  if p_period_end>timezone('Asia/Bangkok',now())::date then raise exception 'Statement closing date cannot be in the future' using errcode='22023'; end if;
  if p_period_end<>public.credit_card_cycle_date(extract(year from p_period_end)::integer,extract(month from p_period_end)::integer,v_card.statement_closing_day) then
    raise exception 'Statement period end must match the configured closing day' using errcode='22023';
  end if;
  if p_due_date<>public.credit_card_cycle_date(extract(year from p_due_date)::integer,extract(month from p_due_date)::integer,v_card.payment_due_day) then
    raise exception 'Statement due date must match the configured due day' using errcode='22023';
  end if;
  if exists(select 1 from public.credit_card_statements s where s.card_account_id=p_card_account_id and daterange(s.period_start,s.period_end,'[]')&&daterange(p_period_start,p_period_end,'[]')) then
    raise exception 'Statement period overlaps an existing statement' using errcode='23505';
  end if;
  select greatest(0,coalesce(sum(e.amount),0)) into v_balance
  from public.credit_card_liability_events e join public.transactions t on t.id=e.transaction_id
  where e.card_account_id=p_card_account_id and t.deleted_at is null
    and timezone('Asia/Bangkok',t.occurred_at)::date between p_period_start and p_period_end;
  if p_minimum_amount_due is null or p_minimum_amount_due<0 or p_minimum_amount_due>v_balance then
    raise exception 'Minimum amount must be between zero and statement balance' using errcode='22023';
  end if;
  insert into public.credit_card_statements(card_account_id,period_start,period_end,due_date,statement_balance,minimum_amount_due,created_by)
  values(p_card_account_id,p_period_start,p_period_end,p_due_date,v_balance,p_minimum_amount_due,auth.uid()) returning id into v_id;
  return v_id;
end; $$;
revoke execute on function public.issue_credit_card_statement(uuid,date,date,date,numeric) from public,anon;
grant execute on function public.issue_credit_card_statement(uuid,date,date,date,numeric) to authenticated;

create function public.allocate_credit_card_statement_event()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_remaining numeric(14,2); v_kind text; v_statement record; v_amount numeric(14,2);
begin
  if new.amount>=0 then return new; end if;
  if new.event_kind like 'PAYMENT_%' then v_kind:='PAYMENT';
  elsif new.event_kind in ('PURCHASE_REFUND','CASHBACK','BALANCE_ADJUSTMENT') then v_kind:='CREDIT';
  else return new; end if;
  v_remaining:=abs(new.amount);
  for v_statement in
    select s.id,s.statement_balance-coalesce((select sum(a.amount) from public.credit_card_statement_allocations a where a.statement_id=s.id),0) as remaining
    from public.credit_card_statements s where s.card_account_id=new.card_account_id
    order by s.due_date,s.created_at for update of s
  loop
    exit when v_remaining<=0;
    v_amount:=least(v_remaining,greatest(v_statement.remaining,0));
    if v_amount>0 then
      insert into public.credit_card_statement_allocations(statement_id,liability_event_id,allocation_kind,amount)
      values(v_statement.id,new.id,v_kind,v_amount);
      v_remaining:=v_remaining-v_amount;
    end if;
  end loop;
  return new;
end; $$;
create trigger credit_card_events_allocate_statements after insert on public.credit_card_liability_events
for each row execute function public.allocate_credit_card_statement_event();
revoke execute on function public.allocate_credit_card_statement_event() from public,anon,authenticated;

create function public.get_credit_card_statements(p_card_account_id uuid)
returns table(statement_id uuid,period_start date,period_end date,due_date date,statement_balance numeric,minimum_amount_due numeric,paid_to_date numeric,credits_to_date numeric,effective_amount_due numeric,status text,minimum_payment_met boolean)
language plpgsql security definer stable set search_path=''
as $$ declare v_wallet_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='28000'; end if;
  select wallet_id into v_wallet_id from public.credit_card_accounts where id=p_card_account_id;
  if not found or not public.is_wallet_authorized(v_wallet_id) then raise exception 'Credit card not found or not authorized' using errcode='42501'; end if;
  return query with totals as (
    select s.*,coalesce(sum(a.amount) filter(where a.allocation_kind='PAYMENT' and t.deleted_at is null),0) paid,
      coalesce(sum(a.amount) filter(where a.allocation_kind='CREDIT' and t.deleted_at is null),0) credits
    from public.credit_card_statements s left join public.credit_card_statement_allocations a on a.statement_id=s.id
    left join public.credit_card_liability_events e on e.id=a.liability_event_id
    left join public.transactions t on t.id=e.transaction_id
    where s.card_account_id=p_card_account_id group by s.id
  ), derived as (select x.*,greatest(0,x.statement_balance-x.paid-x.credits) effective from totals x)
  select d.id,d.period_start,d.period_end,d.due_date,d.statement_balance,d.minimum_amount_due,d.paid,d.credits,d.effective,
    case when d.effective=0 then 'PAID' when timezone('Asia/Bangkok',now())::date>d.due_date then 'OVERDUE'
      when d.paid+d.credits>0 then 'PARTIALLY_PAID' else 'OPEN' end,
    d.minimum_amount_due=0 or d.paid>=d.minimum_amount_due
  from derived d order by d.period_end desc;
end; $$;
revoke execute on function public.get_credit_card_statements(uuid) from public,anon;
grant execute on function public.get_credit_card_statements(uuid) to authenticated;

comment on table public.credit_card_statements is 'Immutable period snapshots. statement_balance is derived once from active classified card events in the period; current card balance remains wallet-ledger authoritative.';
comment on table public.credit_card_statement_allocations is 'Immutable allocation of real payment or credit liability events to oldest statement balances. paid_to_date is always derived from PAYMENT rows.';
