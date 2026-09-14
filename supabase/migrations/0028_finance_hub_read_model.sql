-- 0028_finance_hub_read_model.sql
-- Batched, RLS-respecting Finance Hub aggregation. No stored balances.
--
-- month_totals and category_totals are grouped by wallet currency, same as
-- wallet_balances/currency_totals below — a household with wallets in more
-- than one currency must never see a single combined "income"/"expense"/
-- category figure that quietly adds THB and USD together. Each group is
-- returned as its own row, labeled with its currency; the caller renders
-- one line per currency instead of one summed line.

create or replace function public.get_finance_hub_summary(p_month_start timestamptz, p_month_end timestamptz)
returns jsonb
language sql
security invoker
set search_path = ''
stable
as $$
  with wallet_balances as (
    select w.id, w.currency, coalesce(sum(e.amount) filter (where t.deleted_at is null), 0) as amount
    from public.wallets w
    left join public.transaction_entries e on e.wallet_id = w.id
    left join public.transactions t on t.id = e.transaction_id
    where not w.is_archived
    group by w.id, w.currency
  ), currency_totals as (
    select currency, sum(amount)::text as amount from wallet_balances group by currency order by currency
  ), monthly_entries as (
    select w.currency, t.transaction_type, e.amount
    from public.transactions t
    join public.transaction_entries e on e.transaction_id = t.id
    join public.wallets w on w.id = e.wallet_id
    where t.deleted_at is null
      and t.occurred_at >= p_month_start and t.occurred_at < p_month_end
      and t.transaction_type in ('INCOME', 'EXPENSE')
  ), monthly as (
    select
      currency,
      coalesce(sum(amount) filter (where transaction_type = 'INCOME'), 0)::text as income,
      coalesce(sum(-amount) filter (where transaction_type = 'EXPENSE'), 0)::text as expense
    from monthly_entries
    group by currency
  ), category_entries as (
    -- LEFT JOIN categories: an archived (or, hypothetically, since-deleted-
    -- but-unused) category must still contribute its historical label and
    -- amount here — archiving/history preservation rules apply the same
    -- way they do everywhere else in the ledger (see docs/DOMAIN_RULES.md).
    select t.category_id, coalesce(c.name, 'ไม่ทราบหมวดหมู่') as name, w.currency, e.amount
    from public.transactions t
    join public.transaction_entries e on e.transaction_id = t.id
    join public.wallets w on w.id = e.wallet_id
    left join public.categories c on c.id = t.category_id
    where t.deleted_at is null and t.transaction_type = 'EXPENSE'
      and t.occurred_at >= p_month_start and t.occurred_at < p_month_end
  ), category_totals as (
    select category_id, name, currency, sum(-amount)::text as amount
    from category_entries
    group by category_id, name, currency
    order by sum(-amount) desc, name
    limit 5
  )
  select jsonb_build_object(
    'wallet_balances', coalesce((select jsonb_agg(jsonb_build_object('wallet_id', id, 'currency', currency, 'amount', amount::text) order by id) from wallet_balances), '[]'::jsonb),
    'currency_totals', coalesce((select jsonb_agg(jsonb_build_object('currency', currency, 'amount', amount) order by currency) from currency_totals), '[]'::jsonb),
    'month_totals', coalesce((select jsonb_agg(jsonb_build_object('currency', currency, 'income', income, 'expense', expense) order by currency) from monthly), '[]'::jsonb),
    'category_totals', coalesce((select jsonb_agg(jsonb_build_object('category_id', category_id, 'name', name, 'currency', currency, 'amount', amount)) from category_totals), '[]'::jsonb)
  );
$$;

revoke execute on function public.get_finance_hub_summary(timestamptz, timestamptz) from public, anon;
grant execute on function public.get_finance_hub_summary(timestamptz, timestamptz) to authenticated;

comment on function public.get_finance_hub_summary(timestamptz, timestamptz) is
  'RLS-scoped derived wallet balances plus current-period income/expense and top-5 expense-category totals, every aggregate grouped by wallet currency so different currencies are never summed. All numeric values return as decimal strings.';

-- Rollback: drop function public.get_finance_hub_summary(timestamptz, timestamptz).
