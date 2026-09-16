-- Terminal statement resolution plus card obligations for Finance/Calendar.
-- Minimum payment never suppresses overdue reminders; only zero effective due
-- or an explicit immutable terminal resolution does.

create table public.credit_card_statement_resolutions(
  statement_id uuid primary key references public.credit_card_statements(id),
  reason text not null check(length(btrim(reason)) between 1 and 500),
  resolved_by uuid not null references public.profiles(id),
  resolved_at timestamptz not null default now()
);
alter table public.credit_card_statement_resolutions enable row level security;
create policy credit_card_statement_resolutions_select on public.credit_card_statement_resolutions for select to authenticated
using(exists(select 1 from public.credit_card_statements s join public.credit_card_accounts c on c.id=s.card_account_id where s.id=statement_id and public.is_wallet_authorized(c.wallet_id)));
revoke all on public.credit_card_statement_resolutions from public,anon,authenticated;
grant select on public.credit_card_statement_resolutions to authenticated;
create trigger credit_card_statement_resolutions_immutable before update or delete on public.credit_card_statement_resolutions
for each row execute function public.protect_credit_card_statement_rows();

create function public.resolve_credit_card_statement(p_statement_id uuid,p_reason text)
returns uuid language plpgsql security definer set search_path=''
as $$declare v_wallet_id uuid;begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='28000';end if;
  if length(btrim(coalesce(p_reason,''))) not between 1 and 500 then raise exception 'Resolution reason is required' using errcode='22023';end if;
  select c.wallet_id into v_wallet_id from public.credit_card_statements s join public.credit_card_accounts c on c.id=s.card_account_id where s.id=p_statement_id;
  if not found or not public.is_wallet_authorized(v_wallet_id) then raise exception 'Statement not found or not authorized' using errcode='42501';end if;
  insert into public.credit_card_statement_resolutions(statement_id,reason,resolved_by) values(p_statement_id,btrim(p_reason),auth.uid());
  return p_statement_id;
end;$$;
revoke execute on function public.resolve_credit_card_statement(uuid,text) from public,anon;
grant execute on function public.resolve_credit_card_statement(uuid,text) to authenticated;

drop function public.get_credit_card_statements(uuid);
create function public.get_credit_card_statements(p_card_account_id uuid)
returns table(statement_id uuid,period_start date,period_end date,due_date date,statement_balance numeric,minimum_amount_due numeric,paid_to_date numeric,credits_to_date numeric,effective_amount_due numeric,status text,minimum_payment_met boolean,resolution_reason text,resolved_at timestamptz)
language plpgsql security definer stable set search_path=''
as $$declare v_wallet_id uuid;begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='28000';end if;
  select wallet_id into v_wallet_id from public.credit_card_accounts where id=p_card_account_id;
  if not found or not public.is_wallet_authorized(v_wallet_id) then raise exception 'Credit card not found or not authorized' using errcode='42501';end if;
  return query with totals as(
    select s.*,coalesce(sum(a.amount)filter(where a.allocation_kind='PAYMENT' and t.deleted_at is null),0)paid,
      coalesce(sum(a.amount)filter(where a.allocation_kind='CREDIT' and t.deleted_at is null),0)credits,r.reason,r.resolved_at
    from public.credit_card_statements s left join public.credit_card_statement_allocations a on a.statement_id=s.id
    left join public.credit_card_liability_events e on e.id=a.liability_event_id left join public.transactions t on t.id=e.transaction_id
    left join public.credit_card_statement_resolutions r on r.statement_id=s.id where s.card_account_id=p_card_account_id group by s.id,r.statement_id
  ),derived as(select x.*,greatest(0,x.statement_balance-x.paid-x.credits)effective from totals x)
  select d.id,d.period_start,d.period_end,d.due_date,d.statement_balance,d.minimum_amount_due,d.paid,d.credits,d.effective,
    case when d.resolved_at is not null then 'RESOLVED' when d.effective=0 then 'PAID' when timezone('Asia/Bangkok',now())::date>d.due_date then 'OVERDUE' when d.paid+d.credits>0 then 'PARTIALLY_PAID' else 'OPEN' end,
    d.minimum_amount_due=0 or d.paid>=d.minimum_amount_due,d.reason,d.resolved_at from derived d order by d.period_end desc;
end;$$;
revoke execute on function public.get_credit_card_statements(uuid) from public,anon;
grant execute on function public.get_credit_card_statements(uuid) to authenticated;

drop function public.get_calendar_finance_items(date,date);
create function public.get_calendar_finance_items(p_start date,p_end date)
returns table(source text,source_id uuid,item_date date,title text,scope public.money_scope,status text)
language sql security invoker stable set search_path='' as $$
with statement_totals as(
  select s.id,s.card_account_id,s.due_date,s.statement_balance,
    coalesce(sum(a.amount)filter(where t.deleted_at is null),0)allocated,r.statement_id resolved_id
  from public.credit_card_statements s left join public.credit_card_statement_allocations a on a.statement_id=s.id
  left join public.credit_card_liability_events e on e.id=a.liability_event_id left join public.transactions t on t.id=e.transaction_id
  left join public.credit_card_statement_resolutions r on r.statement_id=s.id group by s.id,r.statement_id
),statement_calc as(select x.*,greatest(0,x.statement_balance-x.allocated)effective from statement_totals x),items as(
  select 'RECURRING'::text source,o.id source_id,o.due_date item_date,r.name title,r.scope,o.status::text status from public.recurring_occurrences o join public.recurring_transactions r on r.id=o.recurring_transaction_id where o.due_date>=p_start and o.due_date<p_end and r.archived_at is null
  union all select 'BILL',o.id,o.due_date,b.name,b.scope,o.status::text from public.bill_occurrences o join public.bills b on b.id=o.bill_id where o.due_date>=p_start and o.due_date<p_end and b.archived_at is null
  union all select 'INSTALLMENT',o.id,o.due_date,p.name,p.scope,o.status::text from public.installment_occurrences o join public.installment_plans p on p.id=o.plan_id where o.due_date>=p_start and o.due_date<p_end and p.archived_at is null
  union all select 'CARD_INSTALLMENT',o.id,o.due_date,p.name,w.scope,case when o.payment_transaction_id is null then 'OPEN' when pt.deleted_at is null then 'PAID' else 'VOIDED' end from public.credit_card_installment_occurrences o join public.credit_card_installment_plans p on p.id=o.plan_id join public.credit_card_accounts c on c.id=p.card_account_id join public.wallets w on w.id=c.wallet_id left join public.transactions pt on pt.id=o.payment_transaction_id where o.due_date>=p_start and o.due_date<p_end and p.archived_at is null
  union all select 'CARD_STATEMENT',s.id,s.due_date,'ใบแจ้งยอด '||w.name,w.scope,case when s.resolved_id is not null then 'RESOLVED' when s.effective=0 then 'PAID' when timezone('Asia/Bangkok',now())::date>s.due_date then 'OVERDUE' else 'OPEN' end from statement_calc s join public.credit_card_accounts c on c.id=s.card_account_id join public.wallets w on w.id=c.wallet_id where s.due_date>=p_start and s.due_date<p_end
  union all select 'CARD_STATEMENT',s.id,g.day::date,'เตือนยอดค้าง '||w.name,w.scope,'OVERDUE' from statement_calc s join public.credit_card_accounts c on c.id=s.card_account_id join public.wallets w on w.id=c.wallet_id cross join lateral generate_series(greatest(s.due_date+1,p_start),least(timezone('Asia/Bangkok',now())::date,p_end-1),interval '1 day')g(day) where s.effective>0 and s.resolved_id is null and s.due_date<timezone('Asia/Bangkok',now())::date
)select * from items order by item_date,source,source_id;
$$;
revoke execute on function public.get_calendar_finance_items(date,date) from public,anon;
grant execute on function public.get_calendar_finance_items(date,date) to authenticated;

create function public.get_credit_card_due_items(p_today date)
returns table(source text,source_id uuid,card_account_id uuid,plan_id uuid,title text,due_date date,amount numeric,currency text,scope public.money_scope,status text)
language sql security definer stable set search_path='' as $$
with statement_totals as(
 select s.id,s.card_account_id,s.due_date,s.statement_balance,coalesce(sum(a.amount)filter(where t.deleted_at is null),0)allocated,r.statement_id resolved_id
 from public.credit_card_statements s left join public.credit_card_statement_allocations a on a.statement_id=s.id left join public.credit_card_liability_events e on e.id=a.liability_event_id left join public.transactions t on t.id=e.transaction_id left join public.credit_card_statement_resolutions r on r.statement_id=s.id group by s.id,r.statement_id
),statement_items as(
 select 'CARD_STATEMENT'::text source,s.id source_id,s.card_account_id,null::uuid plan_id,'ใบแจ้งยอด '||w.name title,s.due_date,greatest(0,s.statement_balance-s.allocated) amount,w.currency,w.scope,case when s.due_date<p_today then 'OVERDUE' else 'DUE' end status
 from statement_totals s join public.credit_card_accounts c on c.id=s.card_account_id join public.wallets w on w.id=c.wallet_id where auth.uid() is not null and public.is_wallet_authorized(c.wallet_id) and s.resolved_id is null and greatest(0,s.statement_balance-s.allocated)>0 and s.due_date<=p_today+30
),installment_items as(
 select 'CARD_INSTALLMENT'::text,o.id,p.card_account_id,p.id plan_id,p.name,o.due_date,o.expected_amount,w.currency,w.scope,case when o.due_date<p_today then 'OVERDUE' when o.due_date=p_today then 'DUE' else 'UPCOMING' end
 from public.credit_card_installment_occurrences o join public.credit_card_installment_plans p on p.id=o.plan_id join public.credit_card_accounts c on c.id=p.card_account_id join public.wallets w on w.id=c.wallet_id left join public.transactions pt on pt.id=o.payment_transaction_id
 where auth.uid() is not null and public.is_wallet_authorized(c.wallet_id) and p.archived_at is null and (o.payment_transaction_id is null or pt.deleted_at is not null) and o.due_date<=p_today+30
)select * from statement_items union all select * from installment_items order by due_date,source,source_id;
$$;
revoke execute on function public.get_credit_card_due_items(date) from public,anon;
grant execute on function public.get_credit_card_due_items(date) to authenticated;

comment on function public.get_calendar_finance_items(date,date) is 'Composes authorized Finance dates. Unresolved statement balances repeat daily after due date even when minimum payment was met; zero due or terminal resolution stops repeats.';
