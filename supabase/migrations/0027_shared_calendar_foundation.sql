-- 0027_shared_calendar_foundation.sql
-- Standalone personal/household events. No recurrence, reminders, or source polymorphism.

create type public.calendar_event_scope as enum ('PERSONAL', 'HOUSEHOLD');

create table public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references public.households(id) on delete restrict,
  created_by uuid not null references public.profiles(id) on delete restrict,
  title text not null check (length(btrim(title)) between 1 and 120),
  note text check (note is null or length(note) <= 2000),
  scope public.calendar_event_scope not null,
  starts_at timestamptz,
  ends_at timestamptz,
  is_all_day boolean not null default false,
  all_day_date date,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, household_id),
  check ((scope='PERSONAL' and household_id is null) or (scope='HOUSEHOLD' and household_id is not null)),
  check (
    (is_all_day and all_day_date is not null and starts_at is null and ends_at is null)
    or
    (not is_all_day and all_day_date is null and starts_at is not null and (ends_at is null or ends_at >= starts_at))
  )
);
create index calendar_events_creator_time_idx on public.calendar_events(created_by, archived_at, starts_at);
create index calendar_events_household_time_idx on public.calendar_events(household_id, archived_at, starts_at);
create index calendar_events_all_day_idx on public.calendar_events(all_day_date) where is_all_day;
create trigger calendar_events_set_updated_at before update on public.calendar_events
for each row execute function public.set_updated_at();

create table public.calendar_event_participants (
  event_id uuid not null,
  household_member_id uuid not null,
  household_id uuid not null,
  created_at timestamptz not null default now(),
  primary key(event_id, household_member_id),
  foreign key(event_id, household_id) references public.calendar_events(id, household_id) on delete cascade,
  foreign key(household_member_id, household_id) references public.household_members(id, household_id) on delete cascade
);
create index calendar_event_participants_household_idx on public.calendar_event_participants(household_id);

alter table public.calendar_events enable row level security;
alter table public.calendar_event_participants enable row level security;
create policy calendar_events_select_visible on public.calendar_events for select to authenticated using (
  (scope='PERSONAL' and created_by=auth.uid())
  or (scope='HOUSEHOLD' and public.is_household_member(household_id))
);
create policy calendar_event_participants_select_visible on public.calendar_event_participants for select to authenticated
using (public.is_household_member(household_id));
revoke all on public.calendar_events, public.calendar_event_participants from anon, authenticated;
grant select on public.calendar_events, public.calendar_event_participants to authenticated;

create function public.replace_calendar_participants_internal(p_event_id uuid,p_household_id uuid,p_member_ids uuid[])
returns void language plpgsql security definer set search_path='' as $$
declare v_requested int; v_valid int;
begin
  if p_household_id is null and cardinality(coalesce(p_member_ids,array[]::uuid[])) > 0 then
    raise exception 'Personal events cannot have participants' using errcode='22023';
  end if;
  v_requested:=cardinality(coalesce(p_member_ids,array[]::uuid[]));
  select count(distinct hm.id) into v_valid from public.household_members hm
    where hm.household_id=p_household_id and hm.id=any(coalesce(p_member_ids,array[]::uuid[]));
  if v_valid<>v_requested then raise exception 'Participants must be unique members of the event household' using errcode='22023'; end if;
  delete from public.calendar_event_participants where event_id=p_event_id;
  insert into public.calendar_event_participants(event_id,household_member_id,household_id)
    select p_event_id,unnest(coalesce(p_member_ids,array[]::uuid[])),p_household_id;
end; $$;
revoke execute on function public.replace_calendar_participants_internal(uuid,uuid,uuid[]) from public,anon,authenticated;

create function public.create_calendar_event(
  p_id uuid,p_scope public.calendar_event_scope,p_household_id uuid,p_title text,p_note text,
  p_is_all_day boolean,p_all_day_date date,p_starts_at timestamptz,p_ends_at timestamptz,p_member_ids uuid[]
) returns public.calendar_events language plpgsql security definer set search_path='' as $$
declare v_event public.calendar_events;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if p_scope='PERSONAL' then
    if p_household_id is not null or cardinality(coalesce(p_member_ids,array[]::uuid[]))>0 then raise exception 'Personal events cannot have a household or participants' using errcode='22023'; end if;
  elsif not public.is_household_member(p_household_id) then raise exception 'Household membership required' using errcode='42501';
  end if;
  insert into public.calendar_events(id,household_id,created_by,title,note,scope,starts_at,ends_at,is_all_day,all_day_date)
  values(p_id,p_household_id,auth.uid(),btrim(p_title),nullif(btrim(p_note),''),p_scope,p_starts_at,p_ends_at,p_is_all_day,p_all_day_date)
  returning * into v_event;
  perform public.replace_calendar_participants_internal(p_id,p_household_id,p_member_ids);
  return v_event;
end; $$;

create function public.update_calendar_event(
  p_event_id uuid,p_title text,p_note text,p_is_all_day boolean,p_all_day_date date,
  p_starts_at timestamptz,p_ends_at timestamptz,p_member_ids uuid[]
) returns public.calendar_events language plpgsql security definer set search_path='' as $$
declare v_event public.calendar_events; v_allowed boolean;
begin
  select * into v_event from public.calendar_events where id=p_event_id;
  if not found then raise exception 'Event not found' using errcode='P0002'; end if;
  v_allowed := v_event.created_by=auth.uid() or (v_event.scope='HOUSEHOLD' and public.has_household_role(v_event.household_id,array['owner','admin']::public.household_role[]));
  if not v_allowed then raise exception 'Event edit not allowed' using errcode='42501'; end if;
  if v_event.scope='PERSONAL' and cardinality(coalesce(p_member_ids,array[]::uuid[]))>0 then raise exception 'Personal events cannot have participants' using errcode='22023'; end if;
  update public.calendar_events set title=btrim(p_title),note=nullif(btrim(p_note),''),is_all_day=p_is_all_day,
    all_day_date=p_all_day_date,starts_at=p_starts_at,ends_at=p_ends_at where id=p_event_id returning * into v_event;
  perform public.replace_calendar_participants_internal(p_event_id,v_event.household_id,p_member_ids);
  return v_event;
end; $$;

create function public.set_calendar_event_archived(p_event_id uuid,p_archived boolean)
returns public.calendar_events language plpgsql security definer set search_path='' as $$
declare v_event public.calendar_events; v_allowed boolean;
begin
  select * into v_event from public.calendar_events where id=p_event_id;
  if not found then raise exception 'Event not found' using errcode='P0002'; end if;
  v_allowed:=v_event.created_by=auth.uid() or (v_event.scope='HOUSEHOLD' and public.has_household_role(v_event.household_id,array['owner','admin']::public.household_role[]));
  if not v_allowed then raise exception 'Event archive not allowed' using errcode='42501'; end if;
  update public.calendar_events set archived_at=case when p_archived then coalesce(archived_at,now()) else null end where id=p_event_id returning * into v_event;
  return v_event;
end; $$;

revoke execute on function public.create_calendar_event(uuid,public.calendar_event_scope,uuid,text,text,boolean,date,timestamptz,timestamptz,uuid[]) from public,anon;
revoke execute on function public.update_calendar_event(uuid,text,text,boolean,date,timestamptz,timestamptz,uuid[]) from public,anon;
revoke execute on function public.set_calendar_event_archived(uuid,boolean) from public,anon;
grant execute on function public.create_calendar_event(uuid,public.calendar_event_scope,uuid,text,text,boolean,date,timestamptz,timestamptz,uuid[]) to authenticated;
grant execute on function public.update_calendar_event(uuid,text,text,boolean,date,timestamptz,timestamptz,uuid[]) to authenticated;
grant execute on function public.set_calendar_event_archived(uuid,boolean) to authenticated;

-- Rollback before downstream domains reference events: drop RPCs, participant/event tables, then enum.
