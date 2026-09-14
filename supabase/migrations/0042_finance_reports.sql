-- Phase L: exact, RLS-scoped financial reports. All aggregation stays in
-- PostgreSQL numeric; each result keeps currency as a grouping key.
create function public.get_finance_reports(p_scope public.money_scope,p_household_id uuid,p_start timestamptz,p_end timestamptz)
returns jsonb language sql security invoker stable set search_path='' as $$
with base as(
 select t.id,t.transaction_type,t.category_id,t.occurred_at,w.currency,e.amount
 from public.transactions t join public.transaction_entries e on e.transaction_id=t.id join public.wallets w on w.id=e.wallet_id
 where t.deleted_at is null and t.transaction_type in('INCOME','EXPENSE') and t.occurred_at>=p_start and t.occurred_at<p_end
 and t.scope=p_scope and(p_scope='PERSONAL'or t.household_id=p_household_id)
),months as(
 select to_char(date_trunc('month',occurred_at at time zone 'Asia/Bangkok'),'YYYY-MM') as month_key,currency,
 coalesce(sum(amount) filter (where transaction_type='INCOME'),0)::text as income,
 coalesce(sum(-amount) filter (where transaction_type='EXPENSE'),0)::text as expense
 from base group by 1,currency order by 1,currency
),categories as(
 select b.transaction_type,b.category_id,coalesce(c.name,'ไม่ทราบหมวดหมู่') as name,b.currency,
 (case when b.transaction_type='EXPENSE'then sum(-b.amount)else sum(b.amount)end)::text as amount
 from base b left join public.categories c on c.id=b.category_id
 group by b.transaction_type,b.category_id,c.name,b.currency order by b.transaction_type,b.currency,sum(abs(b.amount))desc
)
select jsonb_build_object(
 'months',coalesce((select jsonb_agg(jsonb_build_object('month',month_key,'currency',currency,'income',income,'expense',expense) order by month_key,currency) from months),'[]'::jsonb),
 'categories',coalesce((select jsonb_agg(jsonb_build_object('type',transaction_type,'category_id',category_id,'name',name,'currency',currency,'amount',amount))from categories),'[]'::jsonb)
)
$$;
revoke execute on function public.get_finance_reports(public.money_scope,uuid,timestamptz,timestamptz)from public,anon;
grant execute on function public.get_finance_reports(public.money_scope,uuid,timestamptz,timestamptz)to authenticated;
