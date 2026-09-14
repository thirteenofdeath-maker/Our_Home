-- Phase M: compose Finance due items for Calendar without copying them into
-- calendar_events. Source tables and their RLS remain authoritative.
create function public.get_calendar_finance_items(p_start date,p_end date)
returns table(source text,source_id uuid,item_date date,title text,scope public.money_scope,status text)
language sql security invoker stable set search_path='' as $$
 select 'RECURRING' as source,o.id as source_id,o.due_date as item_date,r.name as title,r.scope as scope,o.status::text as status from public.recurring_occurrences as o join public.recurring_transactions as r on r.id=o.recurring_transaction_id where o.due_date>=p_start and o.due_date<p_end and r.archived_at is null
 union all
 select 'BILL',o.id,o.due_date,b.name,b.scope,o.status::text from public.bill_occurrences as o join public.bills as b on b.id=o.bill_id where o.due_date>=p_start and o.due_date<p_end and b.archived_at is null
 union all
 select 'INSTALLMENT',o.id,o.due_date,p.name,p.scope,o.status::text from public.installment_occurrences as o join public.installment_plans as p on p.id=o.plan_id where o.due_date>=p_start and o.due_date<p_end and p.archived_at is null
 order by item_date,source,source_id
$$;
revoke execute on function public.get_calendar_finance_items(date,date)from public,anon;
grant execute on function public.get_calendar_finance_items(date,date)to authenticated;
