create table public.household_expenses (
  id uuid primary key,
  household_id uuid not null references public.households(id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 120),
  category text not null check (category in ('shopping', 'utilities', 'pets', 'home', 'other')),
  amount numeric(14,2) not null check (amount > 0 and amount <> 'NaN'::numeric),
  paid_on date not null,
  payer_id uuid not null references public.profiles(id) on delete restrict,
  created_by uuid not null references public.profiles(id) on delete restrict default auth.uid()
);

create index household_expenses_month_idx
  on public.household_expenses (household_id, paid_on desc, id desc);

alter table public.household_expenses enable row level security;
revoke all on public.household_expenses from public, anon, authenticated;
grant select on public.household_expenses to authenticated;

create policy household_expenses_read on public.household_expenses
  for select to authenticated using (public.is_household_member(household_id));

alter table public.shopping_items
  add column household_expense_id uuid references public.household_expenses(id) on delete set null,
  add constraint shopping_expense_requires_purchase
    check (household_expense_id is null or purchased_at is not null);
create index shopping_items_household_expense_idx
  on public.shopping_items (household_expense_id) where household_expense_id is not null;

-- The shopping table is read-only for clients. Reuse its role-checked write
-- model and lock the selected rows so a bill and its purchases commit together.
create schema if not exists private;
create function private.save_household_expense(
  p_id uuid, p_household_id uuid, p_title text, p_category text,
  p_amount numeric, p_paid_on date, p_payer_id uuid, p_item_ids uuid[], p_edit boolean
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_item public.shopping_items;
  v_count integer := 0;
begin
  if auth.uid() is null or not public.has_household_role(
    p_household_id, array['owner','admin','member']::public.household_role[]
  ) then
    raise exception 'Household write access required' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.household_members
    where household_id = p_household_id and user_id = p_payer_id and role <> 'observer'
  ) and not (p_edit and exists (
    select 1 from public.household_expenses
    where id = p_id and household_id = p_household_id and payer_id = p_payer_id
  )) then
    raise exception 'Payer must be a member of this household' using errcode = '22023';
  end if;

  if p_edit then
    update public.household_expenses
    set title = btrim(p_title), category = p_category, amount = p_amount,
        paid_on = p_paid_on, payer_id = p_payer_id
    where id = p_id and household_id = p_household_id;
    if not found then
      raise exception 'Expense not found' using errcode = 'P0002';
    end if;
    return;
  end if;

  if coalesce(cardinality(p_item_ids), 0) > 100 then
    raise exception 'Too many shopping items' using errcode = '22023';
  end if;

  insert into public.household_expenses (id, household_id, title, category, amount, paid_on, payer_id)
  values (p_id, p_household_id, btrim(p_title), p_category, p_amount, p_paid_on, p_payer_id)
  on conflict (id) do nothing;

  if not found then
    if exists (
      select 1 from public.household_expenses
      where id = p_id and household_id = p_household_id and created_by = auth.uid()
    ) then
      return;
    end if;
    raise exception 'Expense identifier already used' using errcode = '23505';
  end if;

  for v_item in
    select * from public.shopping_items
    where id = any(p_item_ids) and household_id = p_household_id and archived_at is null
    order by id for update
  loop
    if v_item.household_expense_id is not null then
      raise exception 'Shopping item already has an expense' using errcode = '23505';
    end if;
    v_count := v_count + 1;
  end loop;

  if v_count <> coalesce(cardinality(p_item_ids), 0) then
    raise exception 'Shopping item not found' using errcode = 'P0002';
  end if;

  update public.shopping_items
  set household_expense_id = p_id,
      expense_transaction_id = null,
      purchased_at = coalesce(purchased_at, now()),
      purchased_by = coalesce(purchased_by, auth.uid())
  where id = any(p_item_ids) and household_id = p_household_id;
end;
$$;

revoke all on function private.save_household_expense(uuid,uuid,text,text,numeric,date,uuid,uuid[],boolean)
  from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.save_household_expense(uuid,uuid,text,text,numeric,date,uuid,uuid[],boolean)
  to authenticated;

create function public.save_household_expense(
  p_id uuid, p_household_id uuid, p_title text, p_category text,
  p_amount numeric, p_paid_on date, p_payer_id uuid, p_item_ids uuid[], p_edit boolean
)
returns void language sql security invoker set search_path = '' as $$
  select private.save_household_expense(
    p_id, p_household_id, p_title, p_category, p_amount, p_paid_on, p_payer_id, p_item_ids, p_edit
  );
$$;

revoke all on function public.save_household_expense(uuid,uuid,text,text,numeric,date,uuid,uuid[],boolean)
  from public, anon, authenticated;
grant execute on function public.save_household_expense(uuid,uuid,text,text,numeric,date,uuid,uuid[],boolean)
  to authenticated;

alter table public.shopping_items
  add constraint shopping_single_expense_system
    check (household_expense_id is null or expense_transaction_id is null);

create function public.mark_shopping_receipt_purchased(p_item_ids uuid[])
returns void language plpgsql security invoker set search_path = '' as $$
declare
  v_id uuid;
begin
  if coalesce(cardinality(p_item_ids), 0) not between 1 and 100 then
    raise exception 'Invalid receipt size' using errcode = '22023';
  end if;
  for v_id in select distinct unnest(p_item_ids) order by 1 loop
    perform public.set_shopping_item_purchased(v_id, true);
  end loop;
end;
$$;
revoke all on function public.mark_shopping_receipt_purchased(uuid[]) from public, anon, authenticated;
grant execute on function public.mark_shopping_receipt_purchased(uuid[]) to authenticated;

-- Keep the original transaction ID so each recorded payment becomes one
-- expense, even when it has both an attribution and a shopping link.
create temporary table legacy_household_expenses on commit drop as
select
  t.id,
  coalesce(a.household_id, t.household_id, s.household_id) as household_id,
  left(coalesce(
    case when a.household_id is not null or t.household_id is not null
      then nullif(btrim(t.title), '') end,
    s.name, c.name, 'ค่าใช้จ่ายบ้าน'
  ), 120) as title,
  case
    when s.id is not null or c.name ~ 'อาหาร|เดลิเวอรี|ของกิน|ของใช้' then 'shopping'
    when c.name ~ 'ค่าน้ำ|ค่าไฟ|สาธารณูปโภค' then 'utilities'
    when c.name ~ 'สัตว์เลี้ยง|อาหารแมว|ทรายแมว' then 'pets'
    when c.name ~ 'เฟอร์นิเจอร์|ของแต่งบ้าน|ซ่อมบ้าน' then 'home'
    else 'other'
  end as category,
  (t.occurred_at at time zone 'Asia/Bangkok')::date as paid_on,
  coalesce(t.owner_user_id, t.created_by) as payer_id,
  t.created_by,
  -sum(e.amount) as amount,
  count(e.id) as entry_count,
  bool_and(w.currency = 'THB' and e.amount < 0) as valid_entries,
  exists (
    select 1 from public.expense_adjustments ea
    join public.transactions adjustment on adjustment.id = ea.transaction_id
    where ea.original_expense_transaction_id = t.id and adjustment.deleted_at is null
  ) as has_adjustments
from public.transactions t
left join public.household_expense_attributions a on a.transaction_id = t.id
left join public.shopping_items s on s.expense_transaction_id = t.id
left join public.categories c on c.id = coalesce(a.household_category_id, t.category_id)
left join public.transaction_entries e on e.transaction_id = t.id
left join public.wallets w on w.id = e.wallet_id
where t.transaction_type = 'EXPENSE' and t.deleted_at is null
  and coalesce(a.household_id, t.household_id, s.household_id) is not null
  and not exists (
    select 1 from public.expense_adjustments ea where ea.transaction_id = t.id
  )
group by t.id, a.household_id, s.household_id, s.id, s.name, c.name;

do $$
begin
  if exists (
    select 1 from pg_temp.legacy_household_expenses
    where entry_count = 0 or valid_entries is distinct from true
      or has_adjustments or amount >= 1000000000000
  ) then
    raise exception 'Legacy household expense requires reconciliation before migration';
  end if;
end;
$$;

insert into public.household_expenses (
  id, household_id, title, category, amount, paid_on, payer_id, created_by
)
select id, household_id, title, category, amount, paid_on, payer_id, created_by
from pg_temp.legacy_household_expenses;

update public.shopping_items s
set household_expense_id = legacy.id, expense_transaction_id = null
from pg_temp.legacy_household_expenses legacy
where s.expense_transaction_id = legacy.id and s.household_id = legacy.household_id;
