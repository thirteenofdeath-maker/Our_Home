-- 0053_transfer_export_linkage.sql
-- Make transfer charges machine-identifiable in the logical finance
-- export. 0052 deliberately kept fee/interest as ordinary EXPENSE
-- transactions; this migration adds their stable parent/kind metadata
-- without changing visibility or inventing a second reporting path.

drop function public.get_finance_export(timestamptz,timestamptz,uuid,uuid,uuid,public.transaction_type,uuid);

create function public.get_finance_export(
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_wallet_id uuid default null,
  p_pocket_id uuid default null,
  p_category_id uuid default null,
  p_type public.transaction_type default null,
  p_tag_id uuid default null
)
returns table(
  id uuid,
  occurred_at timestamptz,
  transaction_type public.transaction_type,
  title text,
  note text,
  category text,
  wallets text,
  pockets text,
  currency text,
  amount numeric,
  tags text,
  scope public.money_scope,
  linked_transfer_id uuid,
  transfer_charge_kind text
)
language sql
security invoker
stable
set search_path = ''
as $$
  with entry_summary as (
    select
      t.id,
      string_agg(distinct w.name, ' | ') as wallets,
      string_agg(distinct p.name, ' | ') as pockets,
      min(w.currency) as currency,
      case
        when t.transaction_type = 'INCOME' then sum(e.amount)
        when t.transaction_type = 'EXPENSE' then sum(-e.amount)
        else max(abs(e.amount))
      end as amount
    from public.transactions as t
    join public.transaction_entries as e on e.transaction_id = t.id
    join public.wallets as w on w.id = e.wallet_id
    join public.pockets as p on p.id = e.pocket_id
    group by t.id
  )
  select
    t.id,
    t.occurred_at,
    t.transaction_type,
    t.title,
    t.note,
    coalesce(c.name, hc.name || ' (ครอบครัว: ' || h.name || ')'),
    s.wallets,
    s.pockets,
    s.currency,
    s.amount,
    (
      select string_agg(tag.name, ' | ' order by tag.name)
      from public.transaction_tags tt
      join public.tags tag on tag.id = tt.tag_id
      where tt.transaction_id = t.id
    ),
    t.scope,
    tll.transfer_transaction_id,
    tll.kind
  from public.transactions as t
  join entry_summary as s on s.id = t.id
  left join public.categories as c on c.id = t.category_id
  left join public.household_expense_attributions as hea on hea.transaction_id = t.id
  left join public.categories as hc on hc.id = hea.household_category_id
  left join public.households as h on h.id = hea.household_id
  left join public.transfer_ledger_links as tll on tll.charge_transaction_id = t.id
  where t.deleted_at is null
    and (p_from is null or t.occurred_at >= p_from)
    and (p_to is null or t.occurred_at < p_to)
    and (p_category_id is null or t.category_id = p_category_id)
    and (p_type is null or t.transaction_type = p_type)
    and (p_wallet_id is null or exists (
      select 1 from public.transaction_entries x
      where x.transaction_id = t.id and x.wallet_id = p_wallet_id
    ))
    and (p_pocket_id is null or exists (
      select 1 from public.transaction_entries x
      where x.transaction_id = t.id and x.pocket_id = p_pocket_id
    ))
    and (p_tag_id is null or exists (
      select 1 from public.transaction_tags x
      where x.transaction_id = t.id and x.tag_id = p_tag_id
    ))
  order by t.occurred_at, t.id
$$;

comment on function public.get_finance_export(timestamptz,timestamptz,uuid,uuid,uuid,public.transaction_type,uuid) is
  'RLS-scoped logical export. 0053 adds scope plus stable linked_transfer_id/transfer_charge_kind fields so FEE and INTEREST child expenses from 0052 are machine-identifiable. A principal row remains identifiable as transaction_type=TRANSFER. Visibility remains security-invoker/RLS-scoped.';

revoke execute on function public.get_finance_export(timestamptz,timestamptz,uuid,uuid,uuid,public.transaction_type,uuid) from public, anon;
grant execute on function public.get_finance_export(timestamptz,timestamptz,uuid,uuid,uuid,public.transaction_type,uuid) to authenticated;
