-- 0016_household_invite_and_owner_integrity.sql
-- Milestone 1 hardening pass, items 5 & 6.
--
-- ITEM 5 — add_household_member was SECURITY INVOKER, so its internal
-- `select id from profiles where email = p_email` ran as the inviting
-- user. profiles RLS (0002, 0004) only lets a user see their OWN profile
-- or a profile of someone who ALREADY shares a household with them — but
-- the entire point of this function is to find someone who does not yet
-- share a household with the caller. In practice this meant the lookup
-- silently found nothing for exactly the case it exists to handle, and
-- the function would always raise "No registered user with email %.".
--
-- ITEM 6 — separately, `household_members` granted INSERT/UPDATE/DELETE
-- to `authenticated` with RLS gated only on "is the caller owner/admin".
-- That check says nothing about what ROLE VALUE the caller may write. An
-- admin could call `PATCH /household_members?id=eq.<self>` with
-- `{"role":"owner"}` directly — self-promotion — or `{"role":"member"}`
-- on the actual owner's row, or DELETE the owner's row outright, and RLS
-- would allow it because the policy only ever checked the ACTOR's role,
-- never the row being written.
--
-- Fix for both: household_members INSERT/UPDATE/DELETE is revoked from
-- authenticated entirely. The only supported way to add a member becomes
-- this redesigned SECURITY DEFINER function, which performs its own
-- authorization AND enforces the role-assignment rules that RLS could not
-- express. Milestone 1 has no "change role" or "remove member" UI, so
-- revoking UPDATE/DELETE outright (rather than trying to write a fully
-- general role-management RPC now) mirrors the same reasoning already
-- applied to transactions in 0012: don't leave a broad privilege open
-- "just in case" when nothing legitimate currently needs it.
--
-- Milestone 1 invite role policy (documented here because RLS can no
-- longer express it declaratively — see docs/DOMAIN_RULES.md):
--   - owner may invite as 'admin' or 'member'.
--   - admin may invite as 'member' only (not 'admin', to avoid a member
--     admin quietly minting more admins).
--   - Neither owner nor admin may invite as 'owner'. A household can only
--     ever gain a second owner in some future explicit "transfer/share
--     ownership" feature, not through the invite path.

revoke insert, update, delete on public.household_members from authenticated;

drop policy if exists household_members_insert_owner_admin on public.household_members;
drop policy if exists household_members_update_owner_admin on public.household_members;
drop policy if exists household_members_delete_owner_admin on public.household_members;

-- ---------------------------------------------------------------------
-- Belt-and-suspenders data invariant: no matter which future code path
-- writes this table, a household must never end up with zero owners.
-- Written as a trigger (not just "the RPC checks it") so it holds even if
-- a later Milestone adds a role-change/removal RPC and its author forgets
-- to re-derive this rule by hand.
-- ---------------------------------------------------------------------

create function public.household_members_protect_owner()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_remaining_owners integer;
begin
  if (tg_op = 'DELETE' and old.role = 'owner')
     or (tg_op = 'UPDATE' and old.role = 'owner' and new.role <> 'owner')
  then
    select count(*) into v_remaining_owners
    from public.household_members
    where household_id = old.household_id
      and role = 'owner'
      and id <> old.id;

    if v_remaining_owners = 0 then
      raise exception 'A household must always have at least one owner' using errcode = '23514';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

comment on function public.household_members_protect_owner() is
  'Refuses to delete or demote the last owner row of a household, regardless of which privileged path attempts it.';

create trigger household_members_before_change_protect_owner
  before update or delete on public.household_members
  for each row execute function public.household_members_protect_owner();

-- ---------------------------------------------------------------------
-- add_household_member (redesigned: SECURITY DEFINER)
-- ---------------------------------------------------------------------

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

  select role into v_caller_role
  from public.household_members
  where household_id = p_household_id
    and user_id = auth.uid();

  if v_caller_role is null or v_caller_role not in ('owner', 'admin') then
    raise exception 'Only a household owner or admin may add members' using errcode = '42501';
  end if;

  if p_role = 'owner' then
    raise exception 'Cannot assign the owner role through an invite' using errcode = '42501';
  end if;

  if v_caller_role = 'admin' and p_role <> 'member' then
    raise exception 'An admin may only add members, not admins' using errcode = '42501';
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

comment on function public.add_household_member(uuid, text, public.household_role) is
  'SECURITY DEFINER: owner/admin-only, never assigns "owner", admin may only add "member". Looks up the target profile with RLS bypassed on purpose (see comment above) since the invitee is not yet a household member.';

revoke execute on function public.add_household_member(uuid, text, public.household_role) from public, anon;
grant execute on function public.add_household_member(uuid, text, public.household_role) to authenticated;
