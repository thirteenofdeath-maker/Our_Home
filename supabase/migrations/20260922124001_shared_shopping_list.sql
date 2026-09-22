-- Shared household shopping list. Rows are readable by every household
-- participant, while all mutations stay behind role-aware RPCs so observers
-- remain strictly read-only.
create table public.shopping_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 120),
  note text check (note is null or length(note) <= 500),
  store text check (store is null or length(store) <= 120),
  quantity numeric(12,3) not null default 1 check (quantity > 0),
  unit text check (unit is null or length(unit) <= 40),
  estimated_amount numeric(18,2) check (estimated_amount is null or estimated_amount > 0),
  currency text not null default 'THB' check (currency ~ '^[A-Z]{3}$'),
  assigned_member_id uuid,
  created_by uuid not null references public.profiles(id) on delete restrict,
  purchased_at timestamptz,
  purchased_by uuid references public.profiles(id) on delete restrict,
  expense_transaction_id uuid unique references public.transactions(id) on delete restrict,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (assigned_member_id, household_id)
    references public.household_members(id, household_id)
    on delete set null (assigned_member_id),
  check (
    (purchased_at is null and purchased_by is null)
    or (purchased_at is not null and purchased_by is not null)
  ),
  check (expense_transaction_id is null or purchased_at is not null)
);

create index shopping_items_household_active_idx
  on public.shopping_items(household_id, archived_at, purchased_at, created_at);
create index shopping_items_assignee_idx
  on public.shopping_items(assigned_member_id)
  where assigned_member_id is not null and archived_at is null;

create trigger shopping_items_set_updated_at
  before update on public.shopping_items
  for each row execute function public.set_updated_at();

alter table public.shopping_items enable row level security;
create policy shopping_items_select_household
  on public.shopping_items for select to authenticated
  using (public.is_household_member(household_id));

revoke all privileges on table public.shopping_items from public, anon, authenticated;
grant select on table public.shopping_items to authenticated;

create function public.create_shopping_item(
  p_household_id uuid,
  p_name text,
  p_note text,
  p_store text,
  p_quantity numeric,
  p_unit text,
  p_estimated_amount numeric,
  p_currency text,
  p_assigned_member_id uuid
)
returns public.shopping_items
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.shopping_items;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if not public.has_household_role(
    p_household_id,
    array['owner','admin','member']::public.household_role[]
  ) then
    raise exception 'Shopping list changes require a household member role'
      using errcode = '42501';
  end if;
  if p_assigned_member_id is not null and not exists (
    select 1 from public.household_members hm
    where hm.id = p_assigned_member_id
      and hm.household_id = p_household_id
      and hm.role <> 'observer'
  ) then
    raise exception 'Assignee must be a household member' using errcode = '22023';
  end if;

  insert into public.shopping_items (
    household_id, name, note, store, quantity, unit,
    estimated_amount, currency, assigned_member_id, created_by
  ) values (
    p_household_id,
    btrim(p_name),
    nullif(btrim(p_note), ''),
    nullif(btrim(p_store), ''),
    p_quantity,
    nullif(btrim(p_unit), ''),
    p_estimated_amount,
    upper(p_currency),
    p_assigned_member_id,
    auth.uid()
  ) returning * into v_item;
  return v_item;
end;
$$;

create function public.set_shopping_item_purchased(
  p_item_id uuid,
  p_purchased boolean
)
returns public.shopping_items
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.shopping_items;
begin
  select * into v_item
  from public.shopping_items
  where id = p_item_id and archived_at is null
  for update;
  if not found then
    raise exception 'Shopping item not found' using errcode = 'P0002';
  end if;
  if not public.has_household_role(
    v_item.household_id,
    array['owner','admin','member']::public.household_role[]
  ) then
    raise exception 'Shopping list changes require a household member role'
      using errcode = '42501';
  end if;
  if not p_purchased and v_item.expense_transaction_id is not null then
    raise exception 'A purchased item linked to an expense cannot be unchecked'
      using errcode = '23514';
  end if;

  update public.shopping_items
  set purchased_at = case when p_purchased then coalesce(purchased_at, now()) else null end,
      purchased_by = case when p_purchased then coalesce(purchased_by, auth.uid()) else null end
  where id = p_item_id
  returning * into v_item;
  return v_item;
end;
$$;

create function public.set_shopping_item_archived(
  p_item_id uuid,
  p_archived boolean
)
returns public.shopping_items
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.shopping_items;
begin
  select * into v_item from public.shopping_items where id = p_item_id for update;
  if not found then
    raise exception 'Shopping item not found' using errcode = 'P0002';
  end if;
  if not public.has_household_role(
    v_item.household_id,
    array['owner','admin','member']::public.household_role[]
  ) then
    raise exception 'Shopping list changes require a household member role'
      using errcode = '42501';
  end if;
  update public.shopping_items
  set archived_at = case when p_archived then coalesce(archived_at, now()) else null end
  where id = p_item_id
  returning * into v_item;
  return v_item;
end;
$$;

create function public.create_shopping_item_expense(
  p_item_id uuid,
  p_wallet_id uuid,
  p_pocket_id uuid,
  p_category_id uuid,
  p_amount numeric,
  p_title text,
  p_note text,
  p_occurred_at timestamptz,
  p_tag_ids uuid[] default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.shopping_items;
  v_transaction_id uuid;
begin
  select * into v_item
  from public.shopping_items
  where id = p_item_id and archived_at is null
  for update;
  if not found then
    raise exception 'Shopping item not found' using errcode = 'P0002';
  end if;
  if not public.has_household_role(
    v_item.household_id,
    array['owner','admin','member']::public.household_role[]
  ) then
    raise exception 'Shopping list changes require a household member role'
      using errcode = '42501';
  end if;
  if v_item.expense_transaction_id is not null then
    raise exception 'Shopping item already has an expense' using errcode = '23505';
  end if;

  v_transaction_id := public.create_income_expense_transaction(
    'EXPENSE', p_wallet_id, p_pocket_id, p_category_id, p_amount,
    coalesce(nullif(btrim(p_title), ''), v_item.name), p_note,
    coalesce(p_occurred_at, now()), p_tag_ids
  );

  update public.shopping_items
  set purchased_at = coalesce(purchased_at, now()),
      purchased_by = coalesce(purchased_by, auth.uid()),
      expense_transaction_id = v_transaction_id
  where id = p_item_id;

  return v_transaction_id;
end;
$$;

revoke execute on function public.create_shopping_item(
  uuid,text,text,text,numeric,text,numeric,text,uuid
) from public, anon;
revoke execute on function public.set_shopping_item_purchased(uuid,boolean)
  from public, anon;
revoke execute on function public.set_shopping_item_archived(uuid,boolean)
  from public, anon;
revoke execute on function public.create_shopping_item_expense(
  uuid,uuid,uuid,uuid,numeric,text,text,timestamptz,uuid[]
) from public, anon;

grant execute on function public.create_shopping_item(
  uuid,text,text,text,numeric,text,numeric,text,uuid
) to authenticated;
grant execute on function public.set_shopping_item_purchased(uuid,boolean)
  to authenticated;
grant execute on function public.set_shopping_item_archived(uuid,boolean)
  to authenticated;
grant execute on function public.create_shopping_item_expense(
  uuid,uuid,uuid,uuid,numeric,text,text,timestamptz,uuid[]
) to authenticated;
