-- User-created categories are a central household catalog. They remain
-- editable/archivable, but can classify both PERSONAL and HOUSEHOLD money.
--
-- Existing finance validators already treat is_system=true categories as
-- scope-independent. A non-null system_key continues to identify immutable,
-- globally seeded defaults; is_system=true + system_key=NULL now identifies an
-- editable household-shared category. RLS below is what keeps those rows inside
-- their own household instead of exposing them globally.

alter table public.categories drop constraint categories_system_or_user_chk;

-- Preserve existing user categories. Household rows already belong in the
-- shared catalog. Personal rows are promoted only when their owner belongs to
-- exactly one household; ambiguous multi-household ownership stays Personal.
drop trigger if exists categories_prevent_identity_changes on public.categories;

update public.categories
set is_system = true
where not is_system and scope = 'HOUSEHOLD';

with single_household as (
  select user_id, min(household_id::text)::uuid as household_id
  from public.household_members
  group by user_id
  having count(distinct household_id) = 1
)
update public.categories as c
set is_system = true,
    scope = 'HOUSEHOLD',
    owner_user_id = null,
    household_id = sh.household_id
from single_household as sh
where not c.is_system
  and c.scope = 'PERSONAL'
  and c.owner_user_id = sh.user_id;

create trigger categories_prevent_identity_changes
  before update on public.categories
  for each row execute function public.prevent_immutable_column_changes(
    'scope', 'owner_user_id', 'household_id', 'created_by', 'is_system', 'transaction_type'
  );

alter table public.categories add constraint categories_system_or_user_chk check (
  (
    is_system
    and system_key is not null
    and scope is null
    and owner_user_id is null
    and household_id is null
    and created_by is null
  )
  or
  (
    is_system
    and system_key is null
    and scope = 'HOUSEHOLD'
    and owner_user_id is null
    and household_id is not null
    and created_by is not null
  )
  or
  (
    not is_system
    and system_key is null
    and created_by is not null
    and (
      (scope = 'PERSONAL' and owner_user_id is not null and household_id is null)
      or (scope = 'HOUSEHOLD' and owner_user_id is null and household_id is not null)
    )
  )
);

comment on column public.categories.is_system is
  'TRUE means scope-independent in finance validators. system_key identifies immutable global defaults; NULL system_key identifies an editable household-shared category.';

drop policy if exists categories_select on public.categories;
drop policy if exists categories_insert on public.categories;
drop policy if exists categories_update on public.categories;
drop policy if exists categories_delete on public.categories;

create policy categories_select
  on public.categories for select
  to authenticated
  using (
    (is_system and system_key is not null)
    or (is_system and system_key is null and scope = 'HOUSEHOLD' and public.is_household_member(household_id))
    or (not is_system and scope = 'PERSONAL' and owner_user_id = (select auth.uid()))
    or (not is_system and scope = 'HOUSEHOLD' and public.is_household_member(household_id))
  );

create policy categories_insert
  on public.categories for insert
  to authenticated
  with check (
    system_key is null
    and created_by = (select auth.uid())
    and (
      (is_system and scope = 'HOUSEHOLD' and public.is_household_member(household_id))
      or (not is_system and scope = 'PERSONAL' and owner_user_id = (select auth.uid()))
      or (not is_system and scope = 'HOUSEHOLD' and public.is_household_member(household_id))
    )
  );

create policy categories_update
  on public.categories for update
  to authenticated
  using (
    system_key is null
    and (
      (is_system and scope = 'HOUSEHOLD' and public.is_household_member(household_id))
      or (not is_system and scope = 'PERSONAL' and owner_user_id = (select auth.uid()))
      or (not is_system and scope = 'HOUSEHOLD' and public.is_household_member(household_id))
    )
  )
  with check (
    system_key is null
    and (
      (is_system and scope = 'HOUSEHOLD' and public.is_household_member(household_id))
      or (not is_system and scope = 'PERSONAL' and owner_user_id = (select auth.uid()))
      or (not is_system and scope = 'HOUSEHOLD' and public.is_household_member(household_id))
    )
  );

create policy categories_delete
  on public.categories for delete
  to authenticated
  using (
    system_key is null
    and (
      (is_system and scope = 'HOUSEHOLD' and public.is_household_member(household_id))
      or (not is_system and scope = 'PERSONAL' and owner_user_id = (select auth.uid()))
      or (not is_system and scope = 'HOUSEHOLD' and public.is_household_member(household_id))
    )
  );

create or replace function public.categories_validate_hierarchy()
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
  if new.parent_id is null then return new; end if;

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

  -- A user category may sit below an immutable default root. Below an
  -- editable user parent, child and parent must still belong to the same
  -- personal owner/household catalog.
  if v_parent.system_key is null and (
    new.system_key is not null
    or v_parent.is_system <> new.is_system
    or v_parent.scope is distinct from new.scope
    or v_parent.owner_user_id is distinct from new.owner_user_id
    or v_parent.household_id is distinct from new.household_id
  ) then
    raise exception 'A category must share the same catalog as its parent category'
      using errcode = '23514';
  end if;

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

comment on function public.categories_validate_hierarchy() is
  'Validates category tree integrity and permits editable household categories beneath immutable default roots.';
