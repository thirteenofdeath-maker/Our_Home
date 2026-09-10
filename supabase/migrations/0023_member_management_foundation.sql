-- 0023_member_management_foundation.sql
-- Expand-only Milestone 2 member presentation and role management.
-- Old application versions remain compatible: member_color has a default,
-- and direct household_members writes remain revoked.

alter table public.household_members
  add column member_color text not null default '#7A9E7E',
  add constraint household_members_member_color_palette check (
    member_color in ('#7A9E7E', '#7C9DBD', '#D49A89', '#C5A3C7', '#D2AD62', '#789F97')
  );

create or replace function public.update_member_presentation(
  p_household_id uuid,
  p_display_name text,
  p_member_color text
)
returns public.household_members
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result public.household_members;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if nullif(btrim(p_display_name), '') is null or length(btrim(p_display_name)) > 80 then
    raise exception 'Display name must contain 1 to 80 characters' using errcode = '22023';
  end if;
  if p_member_color not in ('#7A9E7E', '#7C9DBD', '#D49A89', '#C5A3C7', '#D2AD62', '#789F97') then
    raise exception 'Invalid member color' using errcode = '22023';
  end if;

  update public.household_members
  set member_color = p_member_color
  where household_id = p_household_id and user_id = auth.uid()
  returning * into v_result;
  if v_result.id is null then
    raise exception 'Household membership not found' using errcode = '42501';
  end if;

  update public.profiles set display_name = btrim(p_display_name) where id = auth.uid();
  return v_result;
end;
$$;

create or replace function public.change_household_member_role(
  p_household_id uuid,
  p_member_id uuid,
  p_role public.household_role
)
returns public.household_members
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller_role public.household_role;
  v_target public.household_members%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  select role into v_caller_role from public.household_members
    where household_id = p_household_id and user_id = auth.uid();
  if v_caller_role is distinct from 'owner' then
    raise exception 'Only the household owner may change member roles' using errcode = '42501';
  end if;
  if p_role not in ('admin', 'member') then
    raise exception 'Only admin or member may be assigned' using errcode = '22023';
  end if;
  select * into v_target from public.household_members
    where id = p_member_id and household_id = p_household_id;
  if not found then
    raise exception 'Household member not found' using errcode = 'P0002';
  end if;
  if v_target.role = 'owner' then
    raise exception 'Owner role cannot be changed through member management' using errcode = '42501';
  end if;

  update public.household_members set role = p_role where id = p_member_id returning * into v_target;
  return v_target;
end;
$$;

revoke execute on function public.update_member_presentation(uuid, text, text) from public, anon;
revoke execute on function public.change_household_member_role(uuid, uuid, public.household_role) from public, anon;
grant execute on function public.update_member_presentation(uuid, text, text) to authenticated;
grant execute on function public.change_household_member_role(uuid, uuid, public.household_role) to authenticated;

comment on function public.update_member_presentation(uuid, text, text) is
  'Updates only auth.uid() display name and membership color after membership and palette validation.';
comment on function public.change_household_member_role(uuid, uuid, public.household_role) is
  'Owner-only admin/member role changes. Owner rows and owner assignment are rejected.';

-- Rollback, if required before new clients depend on member_color:
-- drop the two functions, then drop the constraint and member_color column.
