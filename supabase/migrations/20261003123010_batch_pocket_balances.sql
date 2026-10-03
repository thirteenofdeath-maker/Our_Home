create or replace function public.list_pockets_with_balances(
  p_wallet_ids uuid[],
  p_include_archived boolean default false
)
returns table (
  id uuid,
  wallet_id uuid,
  name text,
  pocket_type public.wallet_type,
  currency text,
  icon text,
  sort_order integer,
  is_archived boolean,
  created_at timestamptz,
  updated_at timestamptz,
  balance numeric
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    p.id,
    p.wallet_id,
    p.name,
    p.pocket_type,
    p.currency,
    p.icon,
    p.sort_order,
    p.is_archived,
    p.created_at,
    p.updated_at,
    coalesce(sum(e.amount) filter (where t.id is not null), 0)::numeric as balance
  from public.pockets p
  left join public.transaction_entries e on e.pocket_id = p.id
  left join public.transactions t
    on t.id = e.transaction_id
   and t.deleted_at is null
  where p.wallet_id = any(coalesce(p_wallet_ids, array[]::uuid[]))
    and (p_include_archived or not p.is_archived)
  group by p.id
  order by p.wallet_id, p.sort_order, p.created_at, p.id;
$$;

revoke all on function public.list_pockets_with_balances(uuid[], boolean) from public;
revoke all on function public.list_pockets_with_balances(uuid[], boolean) from anon;
grant execute on function public.list_pockets_with_balances(uuid[], boolean) to authenticated;
grant execute on function public.list_pockets_with_balances(uuid[], boolean) to service_role;
