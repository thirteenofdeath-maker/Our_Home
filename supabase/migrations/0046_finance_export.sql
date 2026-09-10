-- Phase P: filtered logical export. RLS on transactions/entries remains active.
create function public.get_finance_export(p_from timestamptz default null,p_to timestamptz default null,p_wallet_id uuid default null,p_pocket_id uuid default null,p_category_id uuid default null,p_type public.transaction_type default null,p_tag_id uuid default null)
returns table(id uuid,occurred_at timestamptz,transaction_type public.transaction_type,title text,note text,category text,wallets text,pockets text,currency text,amount numeric,tags text)
language sql security invoker stable set search_path='' as $$
 with entry_summary as(select t.id,string_agg(distinct w.name,' | ') as wallets,string_agg(distinct p.name,' | ') as pockets,min(w.currency) as currency,case when t.transaction_type='INCOME'then sum(e.amount)when t.transaction_type='EXPENSE'then sum(-e.amount)else max(abs(e.amount))end as amount from public.transactions as t join public.transaction_entries as e on e.transaction_id=t.id join public.wallets as w on w.id=e.wallet_id join public.pockets as p on p.id=e.pocket_id group by t.id)
 select t.id,t.occurred_at,t.transaction_type,t.title,t.note,c.name,s.wallets,s.pockets,s.currency,s.amount,(select string_agg(tag.name,' | 'order by tag.name)from public.transaction_tags tt join public.tags tag on tag.id=tt.tag_id where tt.transaction_id=t.id)
 from public.transactions as t join entry_summary as s on s.id=t.id left join public.categories as c on c.id=t.category_id
 where t.deleted_at is null and(p_from is null or t.occurred_at>=p_from)and(p_to is null or t.occurred_at<p_to)and(p_category_id is null or t.category_id=p_category_id)and(p_type is null or t.transaction_type=p_type)
 and(p_wallet_id is null or exists(select 1 from public.transaction_entries x where x.transaction_id=t.id and x.wallet_id=p_wallet_id))
 and(p_pocket_id is null or exists(select 1 from public.transaction_entries x where x.transaction_id=t.id and x.pocket_id=p_pocket_id))
 and(p_tag_id is null or exists(select 1 from public.transaction_tags x where x.transaction_id=t.id and x.tag_id=p_tag_id))
 order by t.occurred_at,t.id
$$;
revoke execute on function public.get_finance_export(timestamptz,timestamptz,uuid,uuid,uuid,public.transaction_type,uuid)from public,anon;grant execute on function public.get_finance_export(timestamptz,timestamptz,uuid,uuid,uuid,public.transaction_type,uuid)to authenticated;
