-- Phase R: deterministic, traceable insight values. No advice or AI output.
create function public.get_finance_insights(p_current_start timestamptz,p_current_end timestamptz,p_previous_start timestamptz,p_today date)
returns table(insight_type text,currency text,current_amount numeric,comparison_amount numeric,reference_id uuid,label text)
language sql security invoker stable set search_path='' as $$
with expenses as(
 select t.id,t.title,w.currency,-sum(e.amount) as amount,t.occurred_at
 from public.transactions as t
 join public.transaction_entries as e on e.transaction_id=t.id
 join public.wallets as w on w.id=e.wallet_id
 where t.deleted_at is null and t.transaction_type='EXPENSE'
 group by t.id,w.currency
),ranked as(
 select expenses.*,row_number() over(partition by expenses.currency order by expenses.amount desc,expenses.id) as rank_number
 from expenses where expenses.occurred_at>=p_current_start and expenses.occurred_at<p_current_end
),months as(
 select expenses.currency,
  coalesce(sum(expenses.amount) filter (where expenses.occurred_at>=p_current_start and expenses.occurred_at<p_current_end),0) as current_amount,
  coalesce(sum(expenses.amount) filter (where expenses.occurred_at>=p_previous_start and expenses.occurred_at<p_current_start),0) as previous_amount
 from expenses group by expenses.currency
),bills_due as(
 select b.currency,sum(o.expected_amount) as amount,(array_agg(o.id order by o.due_date,o.id))[1] as id
 from public.bill_occurrences as o join public.bills as b on b.id=o.bill_id
 where o.status='OPEN'and o.due_date>=p_today and o.due_date<p_today+30
 group by b.currency
),debts as(
 select d.currency,
  sum(case when ev.event_kind in('DRAW','DISBURSEMENT')then ev.principal_amount else -ev.principal_amount end)
   filter (where t.deleted_at is null and d.debt_type='LIABILITY') as amount,
  (array_agg(d.id order by d.id))[1] as id
 from public.debt_accounts as d
 left join public.debt_events as ev on ev.debt_account_id=d.id
 left join public.transactions as t on t.id=ev.principal_transaction_id
 group by d.currency
),insights(insight_type,currency,current_amount,comparison_amount,reference_id,label) as(
 select 'LARGEST_EXPENSE'::text,ranked.currency,ranked.amount,null::numeric,ranked.id,coalesce(ranked.title,'รายจ่าย')::text
 from ranked where ranked.rank_number=1
 union all
 select 'MONTH_COMPARISON'::text,months.currency,months.current_amount,months.previous_amount,null::uuid,'รายจ่ายเดือนนี้เทียบเดือนก่อน'::text
 from months
 union all
 select 'UPCOMING_BILLS'::text,bills_due.currency,bills_due.amount,null::numeric,bills_due.id,'บิล 30 วันข้างหน้า'::text
 from bills_due
 union all
 select 'LIABILITY_TOTAL'::text,debts.currency,coalesce(debts.amount,0),null::numeric,debts.id,'หนี้คงเหลือ'::text
 from debts
)
select i.insight_type,i.currency,i.current_amount,i.comparison_amount,i.reference_id,i.label
from insights as i
order by i.insight_type,i.currency
$$;
revoke execute on function public.get_finance_insights(timestamptz,timestamptz,timestamptz,date)from public,anon;grant execute on function public.get_finance_insights(timestamptz,timestamptz,timestamptz,date)to authenticated;
