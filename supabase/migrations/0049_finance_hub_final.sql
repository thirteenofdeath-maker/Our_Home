-- Phase T: compact final Hub composition. Reuses authoritative read models.
create function public.get_finance_hub_final(p_report_start timestamptz,p_report_end timestamptz,p_today date)
returns jsonb language sql security invoker stable set search_path='' as $$
 select jsonb_build_object(
  'net_worth',coalesce((select jsonb_agg(to_jsonb(n) order by n.currency) from public.get_net_worth() as n),'[]'::jsonb),
  'trend',coalesce(public.get_finance_reports('PERSONAL',null,p_report_start,p_report_end)->'months','[]'::jsonb),
  'installments',coalesce((select jsonb_agg(to_jsonb(i) order by i.due_date,i.id) from(select o.id,p.id as plan_id,p.name,o.due_date,o.expected_amount::text as amount,p.currency from public.installment_occurrences as o join public.installment_plans as p on p.id=o.plan_id where p.scope='PERSONAL'and p.archived_at is null and o.status='OPEN'and o.due_date>=p_today order by o.due_date,o.id limit 3) as i),'[]'::jsonb)
 )
$$;
revoke execute on function public.get_finance_hub_final(timestamptz,timestamptz,date)from public,anon;grant execute on function public.get_finance_hub_final(timestamptz,timestamptz,date)to authenticated;
