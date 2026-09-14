-- Card-aware installment V2. The linked purchase remains the one EXPENSE.
-- Paying a due occurrence creates one ordinary card-payment TRANSFER only.

create table public.credit_card_installment_plans(
  id uuid primary key default gen_random_uuid(),
  card_account_id uuid not null references public.credit_card_accounts(id),
  purchase_transaction_id uuid not null unique references public.transactions(id),
  name text not null check(btrim(name)<>''),
  total_amount numeric(14,2) not null check(total_amount>0),
  installment_count integer not null check(installment_count between 2 and 600),
  first_due_date date not null,
  interval_months integer not null default 1 check(interval_months between 1 and 120),
  created_by uuid not null references public.profiles(id),
  archived_at timestamptz,
  created_at timestamptz not null default now()
);
create index credit_card_installment_plans_card_idx on public.credit_card_installment_plans(card_account_id,created_at desc);

create table public.credit_card_installment_occurrences(
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.credit_card_installment_plans(id),
  sequence_number integer not null check(sequence_number>0),
  due_date date not null,
  expected_amount numeric(14,2) not null check(expected_amount>0),
  payment_transaction_id uuid references public.transactions(id),
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  constraint credit_card_installment_occurrences_payment_chk check((payment_transaction_id is null and paid_at is null)or(payment_transaction_id is not null and paid_at is not null)),
  constraint credit_card_installment_occurrences_plan_sequence_uniq unique(plan_id,sequence_number),
  constraint credit_card_installment_occurrences_plan_due_uniq unique(plan_id,due_date),
  constraint credit_card_installment_occurrences_payment_uniq unique(payment_transaction_id)
);
create index credit_card_installment_occurrences_due_idx on public.credit_card_installment_occurrences(due_date) where payment_transaction_id is null;

alter table public.credit_card_installment_plans enable row level security;
alter table public.credit_card_installment_occurrences enable row level security;
create policy credit_card_installment_plans_select on public.credit_card_installment_plans for select to authenticated
using(exists(select 1 from public.credit_card_accounts c where c.id=card_account_id and public.is_wallet_authorized(c.wallet_id)));
create policy credit_card_installment_occurrences_select on public.credit_card_installment_occurrences for select to authenticated
using(exists(select 1 from public.credit_card_installment_plans p join public.credit_card_accounts c on c.id=p.card_account_id where p.id=plan_id and public.is_wallet_authorized(c.wallet_id)));
revoke all on public.credit_card_installment_plans,public.credit_card_installment_occurrences from public,anon,authenticated;
grant select on public.credit_card_installment_plans,public.credit_card_installment_occurrences to authenticated;

create function public.protect_credit_card_installment_plan()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
  if new.id is distinct from old.id or new.card_account_id is distinct from old.card_account_id
    or new.purchase_transaction_id is distinct from old.purchase_transaction_id or new.name is distinct from old.name
    or new.total_amount is distinct from old.total_amount or new.installment_count is distinct from old.installment_count
    or new.first_due_date is distinct from old.first_due_date or new.interval_months is distinct from old.interval_months
    or new.created_by is distinct from old.created_by or new.created_at is distinct from old.created_at then
    raise exception 'Card installment schedule and identity are immutable' using errcode='23514';
  end if;
  return new;
end;$$;
create trigger credit_card_installment_plans_protect before update on public.credit_card_installment_plans
for each row execute function public.protect_credit_card_installment_plan();

create function public.protect_credit_card_installment_occurrence()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
  if tg_op='DELETE' then
    if auth.role()='service_role' then return old;end if;
    raise exception 'Card installment occurrences are immutable' using errcode='23514';
  end if;
  if coalesce(current_setting('app.paying_card_installment',true),'')<>'true'
    or old.payment_transaction_id is not null or new.payment_transaction_id is null
    or new.id is distinct from old.id or new.plan_id is distinct from old.plan_id
    or new.sequence_number is distinct from old.sequence_number or new.due_date is distinct from old.due_date
    or new.expected_amount is distinct from old.expected_amount or new.created_at is distinct from old.created_at then
    raise exception 'Card installment occurrences are immutable' using errcode='23514';
  end if;
  return new;
end;$$;
create trigger credit_card_installment_occurrences_protect_update before update on public.credit_card_installment_occurrences
for each row execute function public.protect_credit_card_installment_occurrence();
create trigger credit_card_installment_occurrences_protect_delete before delete on public.credit_card_installment_occurrences
for each row execute function public.protect_credit_card_installment_occurrence();
revoke execute on function public.protect_credit_card_installment_plan() from public,anon,authenticated;
revoke execute on function public.protect_credit_card_installment_occurrence() from public,anon,authenticated;

create function public.create_credit_card_installment_plan(
  p_card_account_id uuid,p_purchase_transaction_id uuid,p_name text,p_installment_count integer,
  p_first_due_date date,p_interval_months integer default 1
) returns uuid language plpgsql security definer set search_path=''
as $$
declare v_card public.credit_card_accounts%rowtype;v_wallet public.wallets%rowtype;v_event public.credit_card_liability_events%rowtype;
  v_purchase public.transactions%rowtype;v_id uuid;v_base numeric(14,2);v_part numeric(14,2);v_due date;v_i integer;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='28000';end if;
  if nullif(btrim(p_name),'') is null or p_installment_count not between 2 and 600 or p_interval_months not between 1 and 120 or p_first_due_date is null then
    raise exception 'Invalid card installment schedule' using errcode='22023';end if;
  select * into v_card from public.credit_card_accounts where id=p_card_account_id for update;
  if not found or not public.is_wallet_authorized(v_card.wallet_id) then raise exception 'Credit card not found or not authorized' using errcode='42501';end if;
  select * into v_wallet from public.wallets where id=v_card.wallet_id;
  if v_wallet.is_archived then raise exception 'Credit card is archived' using errcode='23514';end if;
  select * into v_event from public.credit_card_liability_events where card_account_id=p_card_account_id and transaction_id=p_purchase_transaction_id and event_kind='PURCHASE';
  if not found then raise exception 'Active purchase does not belong to this card' using errcode='23514';end if;
  select * into v_purchase from public.transactions where id=p_purchase_transaction_id;
  if v_purchase.deleted_at is not null then raise exception 'Voided purchase cannot become an installment plan' using errcode='23514';end if;
  if p_first_due_date<timezone('Asia/Bangkok',v_purchase.occurred_at)::date then raise exception 'First due date cannot precede purchase' using errcode='22023';end if;
  insert into public.credit_card_installment_plans(card_account_id,purchase_transaction_id,name,total_amount,installment_count,first_due_date,interval_months,created_by)
  values(p_card_account_id,p_purchase_transaction_id,btrim(p_name),v_event.amount,p_installment_count,p_first_due_date,p_interval_months,auth.uid()) returning id into v_id;
  v_base:=trunc((v_event.amount*100)/p_installment_count)/100;v_due:=p_first_due_date;
  for v_i in 1..p_installment_count loop
    v_part:=case when v_i=p_installment_count then v_event.amount-(v_base*(p_installment_count-1)) else v_base end;
    insert into public.credit_card_installment_occurrences(plan_id,sequence_number,due_date,expected_amount) values(v_id,v_i,v_due,v_part);
    v_due:=public.recurring_next_due_date(v_due,p_first_due_date,'MONTHLY',p_interval_months,extract(day from p_first_due_date)::integer);
  end loop;
  return v_id;
end;$$;
revoke execute on function public.create_credit_card_installment_plan(uuid,uuid,text,integer,date,integer) from public,anon;
grant execute on function public.create_credit_card_installment_plan(uuid,uuid,text,integer,date,integer) to authenticated;

create function public.pay_credit_card_installment_occurrence(
  p_occurrence_id uuid,p_from_wallet_id uuid,p_from_pocket_id uuid,p_title text default null,p_note text default null,p_occurred_at timestamptz default now()
) returns uuid language plpgsql security definer set search_path=''
as $$
declare v_occurrence public.credit_card_installment_occurrences%rowtype;v_plan public.credit_card_installment_plans%rowtype;v_payment uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='28000';end if;
  select * into v_occurrence from public.credit_card_installment_occurrences where id=p_occurrence_id for update;
  if not found then raise exception 'Card installment occurrence not found' using errcode='P0002';end if;
  select * into v_plan from public.credit_card_installment_plans where id=v_occurrence.plan_id;
  if not public.is_wallet_authorized((select wallet_id from public.credit_card_accounts where id=v_plan.card_account_id)) then raise exception 'Not authorized' using errcode='42501';end if;
  if v_plan.archived_at is not null then raise exception 'Card installment plan is archived' using errcode='23514';end if;
  if v_occurrence.payment_transaction_id is not null then raise exception 'Occurrence already has a payment; restore its transaction if voided' using errcode='23514';end if;
  v_payment:=public.create_credit_card_payment(v_plan.card_account_id,p_from_wallet_id,p_from_pocket_id,v_occurrence.expected_amount,coalesce(nullif(btrim(p_title),''),v_plan.name),p_note,coalesce(p_occurred_at,now()));
  perform set_config('app.paying_card_installment','true',true);
  update public.credit_card_installment_occurrences set payment_transaction_id=v_payment,paid_at=now() where id=v_occurrence.id;
  return v_payment;
end;$$;
revoke execute on function public.pay_credit_card_installment_occurrence(uuid,uuid,uuid,text,text,timestamptz) from public,anon;
grant execute on function public.pay_credit_card_installment_occurrence(uuid,uuid,uuid,text,text,timestamptz) to authenticated;

create function public.set_credit_card_installment_archived(p_plan_id uuid,p_archived boolean)
returns uuid language plpgsql security definer set search_path=''
as $$declare v_plan public.credit_card_installment_plans%rowtype;begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='28000';end if;
  select * into v_plan from public.credit_card_installment_plans where id=p_plan_id for update;
  if not found or not public.is_wallet_authorized((select wallet_id from public.credit_card_accounts where id=v_plan.card_account_id)) then raise exception 'Plan not found or not authorized' using errcode='42501';end if;
  update public.credit_card_installment_plans set archived_at=case when p_archived then now() else null end where id=p_plan_id;return p_plan_id;
end;$$;
revoke execute on function public.set_credit_card_installment_archived(uuid,boolean) from public,anon;
grant execute on function public.set_credit_card_installment_archived(uuid,boolean) to authenticated;

create function public.get_credit_card_installment_plans()
returns table(plan_id uuid,card_account_id uuid,card_name text,currency text,purchase_transaction_id uuid,name text,total_amount numeric,installment_count integer,first_due_date date,interval_months integer,paid_count bigint,next_due_date date,next_due_amount numeric,archived_at timestamptz)
language sql security definer stable set search_path=''
as $$
select p.id,p.card_account_id,w.name,w.currency,p.purchase_transaction_id,p.name,p.total_amount,p.installment_count,p.first_due_date,p.interval_months,
  count(*) filter(where o.payment_transaction_id is not null and pt.deleted_at is null),
  min(o.due_date) filter(where o.payment_transaction_id is null or pt.deleted_at is not null),
  (array_agg(o.expected_amount order by o.due_date) filter(where o.payment_transaction_id is null or pt.deleted_at is not null))[1],p.archived_at
from public.credit_card_installment_plans p join public.credit_card_accounts c on c.id=p.card_account_id join public.wallets w on w.id=c.wallet_id
join public.credit_card_installment_occurrences o on o.plan_id=p.id left join public.transactions pt on pt.id=o.payment_transaction_id
where auth.uid() is not null and public.is_wallet_authorized(c.wallet_id)
group by p.id,w.name,w.currency;
$$;
revoke execute on function public.get_credit_card_installment_plans() from public,anon;
grant execute on function public.get_credit_card_installment_plans() to authenticated;

create function public.get_credit_card_installment_occurrences(p_plan_id uuid)
returns table(occurrence_id uuid,sequence_number integer,due_date date,expected_amount numeric,status text,payment_transaction_id uuid,paid_at timestamptz)
language sql security definer stable set search_path=''
as $$
select o.id,o.sequence_number,o.due_date,o.expected_amount,
  case when o.payment_transaction_id is null then 'OPEN' when t.deleted_at is null then 'PAID' else 'VOIDED' end,
  o.payment_transaction_id,o.paid_at
from public.credit_card_installment_occurrences o join public.credit_card_installment_plans p on p.id=o.plan_id
join public.credit_card_accounts c on c.id=p.card_account_id left join public.transactions t on t.id=o.payment_transaction_id
where p.id=p_plan_id and auth.uid() is not null and public.is_wallet_authorized(c.wallet_id) order by o.sequence_number;
$$;
revoke execute on function public.get_credit_card_installment_occurrences(uuid) from public,anon;
grant execute on function public.get_credit_card_installment_occurrences(uuid) to authenticated;

create function public.get_credit_card_installment_candidates(p_card_account_id uuid)
returns table(transaction_id uuid,title text,occurred_at timestamptz,amount numeric)
language sql security definer stable set search_path=''
as $$
select t.id,t.title,t.occurred_at,e.amount from public.credit_card_liability_events e join public.transactions t on t.id=e.transaction_id
where e.card_account_id=p_card_account_id and e.event_kind='PURCHASE' and t.deleted_at is null
  and auth.uid() is not null and public.is_wallet_authorized((select wallet_id from public.credit_card_accounts where id=p_card_account_id))
  and not exists(select 1 from public.credit_card_installment_plans p where p.purchase_transaction_id=t.id)
order by t.occurred_at desc;
$$;
revoke execute on function public.get_credit_card_installment_candidates(uuid) from public,anon;
grant execute on function public.get_credit_card_installment_candidates(uuid) to authenticated;

create function public.guard_active_card_installment_purchase_change()
returns trigger language plpgsql security definer set search_path=''
as $$begin
  if tg_table_name='transactions' and new.deleted_at is not null and old.deleted_at is null
    and exists(select 1 from public.credit_card_installment_plans p where p.purchase_transaction_id=old.id and p.archived_at is null) then
    raise exception 'Archive the card installment plan before voiding its purchase' using errcode='23514';end if;
  if tg_table_name='credit_card_liability_events' and new.event_kind='PURCHASE_REFUND'
    and exists(select 1 from public.credit_card_installment_plans p join public.credit_card_liability_events e on e.transaction_id=p.purchase_transaction_id where e.id=new.reverses_event_id and p.archived_at is null) then
    raise exception 'Archive the card installment plan before refunding its purchase' using errcode='23514';end if;
  return new;
end;$$;
create trigger card_installment_guard_purchase_void before update of deleted_at on public.transactions
for each row execute function public.guard_active_card_installment_purchase_change();
create trigger card_installment_guard_purchase_refund before insert on public.credit_card_liability_events
for each row execute function public.guard_active_card_installment_purchase_change();
revoke execute on function public.guard_active_card_installment_purchase_change() from public,anon,authenticated;

comment on table public.credit_card_installment_plans is 'V2 schedule metadata linked one-to-one to an already-expensed card purchase. It never creates or stores another expense.';
comment on function public.pay_credit_card_installment_occurrence(uuid,uuid,uuid,text,text,timestamptz) is 'Pays one immutable scheduled amount through create_credit_card_payment. The result is a wallet TRANSFER, never a second EXPENSE.';
