-- Recurring household chores with deterministic member rotation. Observers may
-- read the schedule and history, but all writes stay behind role-aware RPCs.

create table public.chore_templates (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 120),
  details text check (details is null or length(details) <= 1000),
  cadence text not null check (cadence in ('DAILY', 'WEEKLY')),
  starts_on date not null,
  due_time time,
  is_active boolean not null default true,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, household_id)
);

create trigger chore_templates_set_updated_at
before update on public.chore_templates
for each row execute function public.set_updated_at();

create table public.chore_template_assignees (
  template_id uuid not null,
  household_id uuid not null,
  member_id uuid not null,
  position integer not null check (position >= 0),
  created_at timestamptz not null default now(),
  primary key (template_id, member_id),
  unique (template_id, position),
  foreign key (template_id, household_id)
    references public.chore_templates(id, household_id) on delete cascade,
  foreign key (member_id, household_id)
    references public.household_members(id, household_id) on delete cascade
);

create table public.chore_occurrences (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null,
  household_id uuid not null,
  due_date date not null,
  assigned_member_id uuid not null,
  original_assigned_member_id uuid not null,
  taken_over_by uuid,
  completed_by uuid references public.profiles(id) on delete restrict,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (template_id, due_date),
  foreign key (template_id, household_id)
    references public.chore_templates(id, household_id) on delete cascade,
  foreign key (assigned_member_id, household_id)
    references public.household_members(id, household_id) on delete restrict,
  foreign key (original_assigned_member_id, household_id)
    references public.household_members(id, household_id) on delete restrict,
  foreign key (taken_over_by, household_id)
    references public.household_members(id, household_id) on delete restrict,
  check ((completed_at is null) = (completed_by is null))
);

create trigger chore_occurrences_set_updated_at
before update on public.chore_occurrences
for each row execute function public.set_updated_at();

create index chore_templates_household_active_idx
  on public.chore_templates(household_id, is_active, starts_on);
create index chore_templates_created_by_idx
  on public.chore_templates(created_by);
create index chore_template_assignees_household_idx
  on public.chore_template_assignees(household_id, member_id);
create index chore_occurrences_household_due_idx
  on public.chore_occurrences(household_id, due_date, completed_at);
create index chore_occurrences_template_household_fk_idx
  on public.chore_occurrences(template_id, household_id);
create index chore_occurrences_assigned_household_fk_idx
  on public.chore_occurrences(assigned_member_id, household_id);
create index chore_occurrences_original_household_fk_idx
  on public.chore_occurrences(original_assigned_member_id, household_id);
create index chore_occurrences_takeover_household_fk_idx
  on public.chore_occurrences(taken_over_by, household_id)
  where taken_over_by is not null;
create index chore_occurrences_completed_by_idx
  on public.chore_occurrences(completed_by)
  where completed_by is not null;

alter table public.chore_templates enable row level security;
alter table public.chore_template_assignees enable row level security;
alter table public.chore_occurrences enable row level security;

create policy chore_templates_select_household
on public.chore_templates for select to authenticated
using (public.is_household_member(household_id));
create policy chore_template_assignees_select_household
on public.chore_template_assignees for select to authenticated
using (public.is_household_member(household_id));
create policy chore_occurrences_select_household
on public.chore_occurrences for select to authenticated
using (public.is_household_member(household_id));

revoke all privileges on table public.chore_templates from public, anon, authenticated;
revoke all privileges on table public.chore_template_assignees from public, anon, authenticated;
revoke all privileges on table public.chore_occurrences from public, anon, authenticated;
grant select on table public.chore_templates to authenticated;
grant select on table public.chore_template_assignees to authenticated;
grant select on table public.chore_occurrences to authenticated;

create or replace function public.materialize_chore_occurrences(
  p_household_id uuid,
  p_through_date date default (current_date + 14)
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_template public.chore_templates%rowtype;
  v_date date;
  v_last_date date;
  v_existing_count integer;
  v_assignee_id uuid;
  v_inserted integer := 0;
begin
  if not public.has_household_role(
    p_household_id,
    array['owner','admin','member']::public.household_role[]
  ) then
    raise exception 'Chore changes require a household member role' using errcode = '42501';
  end if;
  if p_through_date > current_date + 62 then
    raise exception 'Chores may only be generated 62 days ahead' using errcode = '22023';
  end if;

  for v_template in
    select * from public.chore_templates
    where household_id = p_household_id and is_active
    order by created_at, id
  loop
    select max(due_date), count(*)
    into v_last_date, v_existing_count
    from public.chore_occurrences
    where template_id = v_template.id;

    v_date := case
      when v_last_date is null then v_template.starts_on
      when v_template.cadence = 'DAILY' then v_last_date + 1
      else v_last_date + 7
    end;

    while v_date <= p_through_date loop
      select member_id into v_assignee_id
      from public.chore_template_assignees
      where template_id = v_template.id
      order by position
      offset (v_existing_count % greatest((
        select count(*) from public.chore_template_assignees
        where template_id = v_template.id
      ), 1))
      limit 1;

      if v_assignee_id is not null then
        insert into public.chore_occurrences (
          template_id, household_id, due_date,
          assigned_member_id, original_assigned_member_id
        ) values (
          v_template.id, p_household_id, v_date,
          v_assignee_id, v_assignee_id
        ) on conflict (template_id, due_date) do nothing;
        if found then
          v_inserted := v_inserted + 1;
          v_existing_count := v_existing_count + 1;
        end if;
      end if;

      v_date := case
        when v_template.cadence = 'DAILY' then v_date + 1
        else v_date + 7
      end;
    end loop;
  end loop;
  return v_inserted;
end;
$$;

create or replace function public.create_chore_template(
  p_household_id uuid,
  p_title text,
  p_details text,
  p_cadence text,
  p_starts_on date,
  p_due_time time,
  p_member_ids uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := gen_random_uuid();
  v_member_id uuid;
  v_position integer := 0;
begin
  if not public.has_household_role(
    p_household_id,
    array['owner','admin']::public.household_role[]
  ) then
    raise exception 'Only household owners and administrators may schedule chores'
      using errcode = '42501';
  end if;
  if p_member_ids is null or cardinality(p_member_ids) = 0 then
    raise exception 'Choose at least one chore assignee' using errcode = '22023';
  end if;

  insert into public.chore_templates (
    id, household_id, title, details, cadence, starts_on, due_time, created_by
  ) values (
    v_id, p_household_id, btrim(p_title), nullif(btrim(p_details), ''),
    p_cadence, p_starts_on, p_due_time, auth.uid()
  );

  foreach v_member_id in array p_member_ids loop
    if not exists (
      select 1 from public.household_members
      where id = v_member_id
        and household_id = p_household_id
        and role <> 'observer'
    ) then
      raise exception 'Every assignee must be an editable household member'
        using errcode = '22023';
    end if;
    insert into public.chore_template_assignees (
      template_id, household_id, member_id, position
    ) values (v_id, p_household_id, v_member_id, v_position);
    v_position := v_position + 1;
  end loop;

  perform public.materialize_chore_occurrences(p_household_id, current_date + 14);
  return v_id;
end;
$$;

create or replace function public.claim_chore_occurrence(p_occurrence_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_occurrence public.chore_occurrences%rowtype;
  v_member_id uuid;
begin
  select * into v_occurrence from public.chore_occurrences where id = p_occurrence_id;
  if not found then raise exception 'Chore occurrence not found' using errcode = 'P0002'; end if;
  if v_occurrence.completed_at is not null then
    raise exception 'Completed chores cannot be claimed' using errcode = '22023';
  end if;
  select id into v_member_id from public.household_members
  where household_id = v_occurrence.household_id
    and user_id = auth.uid()
    and role <> 'observer';
  if v_member_id is null then
    raise exception 'Chore changes require a household member role' using errcode = '42501';
  end if;
  update public.chore_occurrences
  set assigned_member_id = v_member_id, taken_over_by = v_member_id
  where id = p_occurrence_id;
end;
$$;

create or replace function public.complete_chore_occurrence(p_occurrence_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_occurrence public.chore_occurrences%rowtype;
  v_member_id uuid;
begin
  select * into v_occurrence from public.chore_occurrences where id = p_occurrence_id;
  if not found then raise exception 'Chore occurrence not found' using errcode = 'P0002'; end if;
  select id into v_member_id from public.household_members
  where household_id = v_occurrence.household_id
    and user_id = auth.uid()
    and role <> 'observer';
  if v_member_id is null then
    raise exception 'Chore changes require a household member role' using errcode = '42501';
  end if;
  update public.chore_occurrences
  set assigned_member_id = v_member_id,
      taken_over_by = case
        when v_member_id <> original_assigned_member_id then v_member_id
        else taken_over_by
      end,
      completed_by = auth.uid(),
      completed_at = now()
  where id = p_occurrence_id and completed_at is null;
end;
$$;

create or replace function public.set_chore_template_active(
  p_template_id uuid,
  p_active boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_household_id uuid;
begin
  select household_id into v_household_id
  from public.chore_templates where id = p_template_id;
  if v_household_id is null then
    raise exception 'Chore template not found' using errcode = 'P0002';
  end if;
  if not public.has_household_role(
    v_household_id,
    array['owner','admin']::public.household_role[]
  ) then
    raise exception 'Only household owners and administrators may change chore schedules'
      using errcode = '42501';
  end if;
  update public.chore_templates set is_active = p_active where id = p_template_id;
end;
$$;

revoke all on function public.materialize_chore_occurrences(uuid, date) from public, anon;
revoke all on function public.create_chore_template(uuid, text, text, text, date, time, uuid[]) from public, anon;
revoke all on function public.claim_chore_occurrence(uuid) from public, anon;
revoke all on function public.complete_chore_occurrence(uuid) from public, anon;
revoke all on function public.set_chore_template_active(uuid, boolean) from public, anon;
grant execute on function public.materialize_chore_occurrences(uuid, date) to authenticated;
grant execute on function public.create_chore_template(uuid, text, text, text, date, time, uuid[]) to authenticated;
grant execute on function public.claim_chore_occurrence(uuid) to authenticated;
grant execute on function public.complete_chore_occurrence(uuid) to authenticated;
grant execute on function public.set_chore_template_active(uuid, boolean) to authenticated;

comment on table public.chore_occurrences is
  'Materialized household chore schedule and completion history.';
