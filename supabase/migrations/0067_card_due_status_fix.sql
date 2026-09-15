-- Distinguish future obligations from items due today in the Finance hub.
create or replace function public.get_credit_card_due_items(p_today date)
returns table(source text,source_id uuid,card_account_id uuid,plan_id uuid,title text,due_date date,amount numeric,currency text,scope public.money_scope,status text)
language sql security definer stable set search_path='' as $$
with statement_totals as(
 select s.id,s.card_account_id,s.due_date,s.statement_balance,coalesce(sum(a.amount)filter(where t.deleted_at is null),0)allocated,r.statement_id resolved_id
 from public.credit_card_statements s left join public.credit_card_statement_allocations a on a.statement_id=s.id left join public.credit_card_liability_events e on e.id=a.liability_event_id left join public.transactions t on t.id=e.transaction_id left join public.credit_card_statement_resolutions r on r.statement_id=s.id group by s.id,r.statement_id
),statement_items as(
 select 'CARD_STATEMENT'::text source,s.id source_id,s.card_account_id,null::uuid plan_id,'ใบแจ้งยอด '||w.name title,s.due_date,greatest(0,s.statement_balance-s.allocated) amount,w.currency,w.scope,case when s.due_date<p_today then 'OVERDUE' when s.due_date=p_today then 'DUE' else 'UPCOMING' end status
 from statement_totals s join public.credit_card_accounts c on c.id=s.card_account_id join public.wallets w on w.id=c.wallet_id where auth.uid() is not null and public.is_wallet_authorized(c.wallet_id) and s.resolved_id is null and greatest(0,s.statement_balance-s.allocated)>0 and s.due_date<=p_today+30
),installment_items as(
 select 'CARD_INSTALLMENT'::text,o.id,p.card_account_id,p.id plan_id,p.name,o.due_date,o.expected_amount,w.currency,w.scope,case when o.due_date<p_today then 'OVERDUE' when o.due_date=p_today then 'DUE' else 'UPCOMING' end
 from public.credit_card_installment_occurrences o join public.credit_card_installment_plans p on p.id=o.plan_id join public.credit_card_accounts c on c.id=p.card_account_id join public.wallets w on w.id=c.wallet_id left join public.transactions pt on pt.id=o.payment_transaction_id
 where auth.uid() is not null and public.is_wallet_authorized(c.wallet_id) and p.archived_at is null and (o.payment_transaction_id is null or pt.deleted_at is not null) and o.due_date<=p_today+30
)select * from statement_items union all select * from installment_items order by due_date,source,source_id;
$$;
revoke execute on function public.get_credit_card_due_items(date) from public,anon;
grant execute on function public.get_credit_card_due_items(date) to authenticated;
