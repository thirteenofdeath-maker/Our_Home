-- 0004_household_members.sql
-- Membership rows, the RLS helper functions that depend on them, and RLS
-- policies for both households and household_members (and one extra policy
-- on profiles so household members can see each other's display name).

create table public.household_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.household_role not null default 'member',
  created_at timestamptz not null default now(),
  unique (household_id, user_id)
);

comment on table public.household_members is
  'Membership + role of a profile within a household. A user may belong to more than one household.';

create index household_members_household_id_idx on public.household_members (household_id);
create index household_members_user_id_idx on public.household_members (user_id);

-- Automatically make the creator of a household its owner. This removes the
-- need for a client-writable "insert yourself as owner" policy, which would
-- otherwise be a privilege-escalation foot-gun.
create function public.households_add_creator_as_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.household_members (household_id, user_id, role)
  values (new.id, new.created_by, 'owner');
  return new;
end;
$$;

create trigger households_after_insert_add_owner
  after insert on public.households
  for each row execute function public.households_add_creator_as_owner();

-- ---------------------------------------------------------------------
-- RLS helper functions.
--
-- SECURITY DEFINER is required here specifically to avoid infinite RLS
-- recursion: household_members' own SELECT policy needs to answer "is the
-- caller a member of this household", which is a query against
-- household_members itself. If that check ran as a normal RLS-checked
-- query it would recursively invoke the same policy. Running it as the
-- function owner (bypassing RLS) breaks the recursion. The function only
-- ever returns a boolean derived from auth.uid(), so it cannot be used to
-- exfiltrate arbitrary rows.
-- ---------------------------------------------------------------------

create function public.is_household_member(p_household_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.household_members
    where household_id = p_household_id
      and user_id = auth.uid()
  );
$$;

comment on function public.is_household_member(uuid) is
  'RLS helper: true if the current user is a member of the given household. SECURITY DEFINER to avoid recursive RLS on household_members.';

create function public.has_household_role(p_household_id uuid, p_roles public.household_role[])
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.household_members
    where household_id = p_household_id
      and user_id = auth.uid()
      and role = any (p_roles)
  );
$$;

comment on function public.has_household_role(uuid, public.household_role[]) is
  'RLS helper: true if the current user has one of the given roles in the household. SECURITY DEFINER to avoid recursive RLS on household_members.';

-- ---------------------------------------------------------------------
-- RLS: households
-- ---------------------------------------------------------------------

alter table public.households enable row level security;

create policy households_select_member
  on public.households for select
  using (public.is_household_member(id));

create policy households_insert_self
  on public.households for insert
  with check (created_by = auth.uid());

create policy households_update_owner_admin
  on public.households for update
  using (public.has_household_role(id, array['owner', 'admin']::public.household_role[]))
  with check (public.has_household_role(id, array['owner', 'admin']::public.household_role[]));

-- No delete policy in Milestone 1: deleting a household with live wallets/
-- transactions is a deliberately unhandled edge case for now.

-- ---------------------------------------------------------------------
-- RLS: household_members
-- ---------------------------------------------------------------------

alter table public.household_members enable row level security;

create policy household_members_select_member
  on public.household_members for select
  using (public.is_household_member(household_id));

create policy household_members_insert_owner_admin
  on public.household_members for insert
  with check (public.has_household_role(household_id, array['owner', 'admin']::public.household_role[]));

create policy household_members_update_owner_admin
  on public.household_members for update
  using (public.has_household_role(household_id, array['owner', 'admin']::public.household_role[]))
  with check (public.has_household_role(household_id, array['owner', 'admin']::public.household_role[]));

create policy household_members_delete_owner_admin
  on public.household_members for delete
  using (public.has_household_role(household_id, array['owner', 'admin']::public.household_role[]));

-- ---------------------------------------------------------------------
-- Extra profiles policy: members of the same household can see each
-- other's (public-ish) profile row, e.g. to render a member list.
-- ---------------------------------------------------------------------

create policy profiles_select_household_members
  on public.profiles for select
  using (
    exists (
      select 1
      from public.household_members mine
      join public.household_members theirs
        on theirs.household_id = mine.household_id
      where mine.user_id = auth.uid()
        and theirs.user_id = profiles.id
    )
  );

-- ---------------------------------------------------------------------
-- add_household_member: owner/admin-only invite of an already-registered
-- user by email. SECURITY INVOKER: the INSERT it performs is still checked
-- by household_members_insert_owner_admin above, so authorization is not
-- duplicated here — this function is a convenience wrapper for "look up a
-- profile id by email, then insert", not a privilege boundary itself.
-- ---------------------------------------------------------------------

create function public.add_household_member(
  p_household_id uuid,
  p_email text,
  p_role public.household_role default 'member'
)
returns public.household_members
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid;
  v_result public.household_members;
begin
  select id into v_user_id from public.profiles where email = p_email;

  if v_user_id is null then
    raise exception 'No registered user with email %', p_email
      using errcode = 'P0002';
  end if;

  insert into public.household_members (household_id, user_id, role)
  values (p_household_id, v_user_id, p_role)
  returning * into v_result;

  return v_result;
end;
$$;

comment on function public.add_household_member(uuid, text, public.household_role) is
  'Owner/admin-only: adds an already-registered user to a household by email. Authorization comes from household_members_insert_owner_admin, not from this function.';
