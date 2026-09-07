-- 0007_categories.sql
-- Self-referencing category tree (Category -> Subcategory via parent_id).
-- A category classifies what a transaction was for; it is not a budget.

create type public.category_transaction_type as enum ('INCOME', 'EXPENSE');

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  scope public.money_scope not null,
  owner_user_id uuid references public.profiles (id),
  household_id uuid references public.households (id),
  name text not null,
  transaction_type public.category_transaction_type not null,
  parent_id uuid references public.categories (id),
  icon text,
  sort_order integer not null default 0,
  is_system boolean not null default false,
  archived_at timestamptz,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint categories_scope_ownership_chk check (
    is_system
    or (scope = 'PERSONAL' and owner_user_id is not null and household_id is null)
    or (scope = 'HOUSEHOLD' and household_id is not null and owner_user_id is null)
  )
);

comment on table public.categories is
  'Self-referencing category/subcategory tree. parent_id replaces a separate subcategories table.';
comment on column public.categories.archived_at is
  'NULL = active/selectable. Set (never deleted) once a category has been used by any transaction.';

create index categories_owner_user_id_idx on public.categories (owner_user_id) where owner_user_id is not null;
create index categories_household_id_idx on public.categories (household_id) where household_id is not null;
create index categories_parent_id_idx on public.categories (parent_id) where parent_id is not null;

create trigger categories_set_updated_at
  before update on public.categories
  for each row execute function public.set_updated_at();

-- Prevents self-parenting, cycles, and transaction_type mismatches between
-- a category and its parent. Runs on both INSERT and UPDATE because
-- re-parenting via UPDATE could otherwise introduce a cycle just as easily
-- as a malformed INSERT.
create function public.categories_validate_hierarchy()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_parent public.categories%rowtype;
  v_current_id uuid;
  v_depth integer := 0;
begin
  if new.parent_id is null then
    return new;
  end if;

  if new.parent_id = new.id then
    raise exception 'A category cannot be its own parent' using errcode = '23514';
  end if;

  select * into v_parent from public.categories where id = new.parent_id;

  if not found then
    raise exception 'Parent category % does not exist', new.parent_id using errcode = '23503';
  end if;

  if v_parent.transaction_type <> new.transaction_type then
    raise exception 'A category''s transaction_type must match its parent''s transaction_type'
      using errcode = '23514';
  end if;

  -- Walk up the parent chain looking for a cycle back to this category.
  -- Depth-limited defensively; the tree is expected to be shallow (V1 UI
  -- only ever shows two levels).
  v_current_id := new.parent_id;
  while v_current_id is not null and v_depth < 100 loop
    if v_current_id = new.id then
      raise exception 'Category hierarchy cannot contain a cycle' using errcode = '23514';
    end if;
    select parent_id into v_current_id from public.categories where id = v_current_id;
    v_depth := v_depth + 1;
  end loop;

  return new;
end;
$$;

create trigger categories_before_insert_or_update_validate
  before insert or update of parent_id, transaction_type on public.categories
  for each row execute function public.categories_validate_hierarchy();
