-- 0018_category_hierarchy_ownership.sql
-- Milestone 1 hardening pass, item 9.
--
-- categories_validate_hierarchy (0007) already rejects self-parenting,
-- cycles, and a transaction_type mismatch between a category and its
-- parent — but said nothing about scope/ownership, so it previously
-- allowed nonsense like a PERSONAL category nested under a HOUSEHOLD
-- parent, or a HOUSEHOLD category nested under a different household's
-- category. Redefined here (CREATE OR REPLACE, same trigger, no new
-- trigger needed) to also require a category and its parent to have
-- identical scope AND identical owner_user_id (PERSONAL) or household_id
-- (HOUSEHOLD).
--
-- Future system categories: is_system rows have owner_user_id and
-- household_id both NULL by construction (0007's CHECK constraint), which
-- already makes two system categories compare equal on those columns. The
-- explicit is_system-must-match check below additionally means a
-- personal/household category can never nest under a system parent (or
-- vice versa) — a system category tree, if one is seeded later, stays a
-- fully separate tree from user-owned categories. That is a deliberate
-- Milestone 1 decision, documented here and in docs/DOMAIN_RULES.md, not
-- an oversight: mixing "shared system default" and "this household's own"
-- categories in one tree would make it unclear who may rename or archive
-- a given node.

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

  if v_parent.is_system <> new.is_system then
    raise exception 'A category and its parent must both be system categories or both be non-system'
      using errcode = '23514';
  end if;

  if not new.is_system and (
    v_parent.scope <> new.scope
    or v_parent.owner_user_id is distinct from new.owner_user_id
    or v_parent.household_id is distinct from new.household_id
  ) then
    raise exception 'A category must share the same scope and owner/household as its parent category'
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
