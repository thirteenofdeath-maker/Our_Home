create or replace function public.add_household_member(
  p_household_id uuid,
  p_email text,
  p_role public.household_role default 'member'
)
returns public.household_members
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller_role public.household_role;
  v_user_id uuid;
  v_result public.household_members;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  perform 1 from public.households where id = p_household_id for update;

  select role into v_caller_role
  from public.household_members
  where household_id = p_household_id
    and user_id = auth.uid();

  if v_caller_role is null or v_caller_role not in ('owner', 'admin') then
    raise exception 'Only a household owner or admin may add members' using errcode = '42501';
  end if;

  if p_role is null or p_role not in ('admin', 'member', 'observer') then
    raise exception 'Cannot assign the owner role through an invite' using errcode = '42501';
  end if;

  if v_caller_role = 'admin' and p_role not in ('member', 'observer') then
    raise exception 'An admin may only add members or observers' using errcode = '42501';
  end if;

  -- SECURITY DEFINER bypasses profiles RLS here deliberately: this is the
  -- one place a user's profile legitimately needs to be found by email
  -- even though the caller does not (yet) share a household with them.
  select id into v_user_id from public.profiles where lower(email) = lower(p_email);

  if v_user_id is null then
    raise exception 'No registered user with email %', p_email using errcode = 'P0002';
  end if;

  insert into public.household_members (household_id, user_id, role)
  values (p_household_id, v_user_id, p_role)
  returning * into v_result;

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
  perform 1 from public.households where id = p_household_id for update;
  select role into v_caller_role from public.household_members
    where household_id = p_household_id and user_id = auth.uid();
  if v_caller_role is distinct from 'owner' then
    raise exception 'Only the household owner may change member roles' using errcode = '42501';
  end if;
  if p_role is null or p_role not in ('admin', 'member', 'observer') then
    raise exception 'Only admin, member or observer may be assigned' using errcode = '22023';
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


-- Direct membership writes remain revoked. This authorized RPC is the only
-- removal entry point, matching the existing invite/role management contract.
create or replace function public.remove_household_member(
  p_household_id uuid, p_member_id uuid
) returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_actor public.household_role;
  v_target public.household_members%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  -- Serialize invitations, role changes and removal within a household.
  perform 1 from public.households where id = p_household_id for update;
  select role into v_actor from public.household_members
    where household_id = p_household_id and user_id = auth.uid();
  if v_actor is null or v_actor not in ('owner', 'admin') then
    raise exception 'Only owner or admin may remove members' using errcode = '42501';
  end if;
  select * into v_target from public.household_members
    where id = p_member_id and household_id = p_household_id for update;
  if not found then
    raise exception 'Member not found' using errcode = 'P0002';
  end if;
  if v_target.role = 'owner' or v_target.user_id = auth.uid()
     or (v_actor = 'admin' and v_target.role not in ('member', 'observer')) then
    raise exception 'You cannot remove this member' using errcode = '42501';
  end if;
  delete from public.household_members
    where id = v_target.id and household_id = p_household_id;
end;
$$;
revoke all on function public.remove_household_member(uuid, uuid) from public, anon;
grant execute on function public.remove_household_member(uuid, uuid) to authenticated;
revoke all on function public.add_household_member(uuid, text, public.household_role) from public, anon;
grant execute on function public.add_household_member(uuid, text, public.household_role) to authenticated;
revoke all on function public.change_household_member_role(uuid, uuid, public.household_role) from public, anon;
grant execute on function public.change_household_member_role(uuid, uuid, public.household_role) to authenticated;
comment on function public.add_household_member(uuid, text, public.household_role) is
  'Owner may invite admin/member/observer; admin may invite member/observer only.';
comment on function public.change_household_member_role(uuid, uuid, public.household_role) is
  'Owner-only role management; owner rows are protected.';
