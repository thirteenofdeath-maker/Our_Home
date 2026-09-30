-- Allow household chore rotations to repeat every N days, weeks, months, or
-- years. Existing schedules retain their cadence with an interval of one.

alter table public.chore_templates
  add column interval_count integer not null default 1;

alter table public.chore_templates
  drop constraint chore_templates_cadence_check,
  add constraint chore_templates_cadence_check
    check (cadence in ('DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY')),
  add constraint chore_templates_interval_count_check
    check (interval_count between 1 and 365);

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
      when v_last_date is null or v_last_date < v_template.starts_on
        then v_template.starts_on
      when v_template.cadence = 'DAILY'
        then v_last_date + v_template.interval_count
      else public.recurring_next_due_date(
        v_last_date,
        v_template.starts_on,
        v_template.cadence,
        v_template.interval_count,
        extract(day from v_template.starts_on)::integer
      )
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
        when v_template.cadence = 'DAILY'
          then v_date + v_template.interval_count
        else public.recurring_next_due_date(
          v_date,
          v_template.starts_on,
          v_template.cadence,
          v_template.interval_count,
          extract(day from v_template.starts_on)::integer
        )
      end;
    end loop;
  end loop;
  return v_inserted;
end;
$$;

create function public.create_chore_template(
  p_household_id uuid,
  p_title text,
  p_details text,
  p_cadence text,
  p_interval_count integer,
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
    id, household_id, title, details, cadence, interval_count,
    starts_on, due_time, created_by
  ) values (
    v_id, p_household_id, btrim(p_title), nullif(btrim(p_details), ''),
    p_cadence, p_interval_count, p_starts_on, p_due_time, auth.uid()
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

create function public.update_chore_template(
  p_template_id uuid,
  p_title text,
  p_details text,
  p_cadence text,
  p_interval_count integer,
  p_starts_on date,
  p_due_time time,
  p_member_ids uuid[]
)
returns public.chore_templates
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_template public.chore_templates;
  v_member_id uuid;
  v_position integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  select * into v_template from public.chore_templates
  where id = p_template_id for update;
  if not found then raise exception 'Chore template not found' using errcode = 'P0002'; end if;
  if not public.has_household_role(
    v_template.household_id,
    array['owner','admin']::public.household_role[]
  ) then
    raise exception 'Only household owners and administrators may edit chores' using errcode = '42501';
  end if;
  if p_member_ids is null or cardinality(p_member_ids) = 0 then
    raise exception 'Choose at least one chore assignee' using errcode = '22023';
  end if;

  foreach v_member_id in array p_member_ids loop
    if not exists (
      select 1 from public.household_members
      where id = v_member_id
        and household_id = v_template.household_id
        and role <> 'observer'
    ) then
      raise exception 'Every assignee must be an editable household member' using errcode = '22023';
    end if;
  end loop;

  update public.chore_templates set
    title = btrim(p_title),
    details = nullif(btrim(p_details), ''),
    cadence = p_cadence,
    interval_count = p_interval_count,
    starts_on = greatest(p_starts_on, current_date),
    due_time = p_due_time
  where id = p_template_id
  returning * into v_template;

  delete from public.chore_occurrences
  where template_id = p_template_id and completed_at is null;
  delete from public.chore_template_assignees where template_id = p_template_id;
  foreach v_member_id in array p_member_ids loop
    insert into public.chore_template_assignees (
      template_id, household_id, member_id, position
    ) values (p_template_id, v_template.household_id, v_member_id, v_position);
    v_position := v_position + 1;
  end loop;
  perform public.materialize_chore_occurrences(v_template.household_id, current_date + 14);
  return v_template;
end;
$$;

revoke all on function public.create_chore_template(
  uuid, text, text, text, integer, date, time, uuid[]
) from public, anon;
revoke all on function public.update_chore_template(
  uuid, text, text, text, integer, date, time, uuid[]
) from public, anon;
grant execute on function public.create_chore_template(
  uuid, text, text, text, integer, date, time, uuid[]
) to authenticated;
grant execute on function public.update_chore_template(
  uuid, text, text, text, integer, date, time, uuid[]
) to authenticated;
