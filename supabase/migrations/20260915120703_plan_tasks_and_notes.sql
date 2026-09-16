-- Unified Plan workspace: task and note primitives inspired by familiar productivity apps.
-- Calendar events stay authoritative in calendar_events; these tables compose
-- beside them without copying or mutating existing calendar data.

create table public.plan_tasks (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references public.households(id) on delete restrict,
  created_by uuid not null references public.profiles(id) on delete restrict,
  scope public.calendar_event_scope not null,
  title text not null check (length(btrim(title)) between 1 and 160),
  details text check (details is null or length(details) <= 5000),
  list_name text not null default 'งานของฉัน'
    check (length(btrim(list_name)) between 1 and 80),
  due_date date,
  due_time time,
  priority text not null default 'NORMAL'
    check (priority in ('LOW', 'NORMAL', 'HIGH')),
  is_completed boolean not null default false,
  completed_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (scope = 'PERSONAL' and household_id is null)
    or (scope = 'HOUSEHOLD' and household_id is not null)
  ),
  check (due_time is null or due_date is not null),
  check (
    (is_completed and completed_at is not null)
    or (not is_completed and completed_at is null)
  )
);

create index plan_tasks_personal_due_idx
  on public.plan_tasks(created_by, archived_at, is_completed, due_date, due_time);
create index plan_tasks_household_due_idx
  on public.plan_tasks(household_id, archived_at, is_completed, due_date, due_time);
create index plan_tasks_list_idx
  on public.plan_tasks(created_by, list_name, created_at);
create trigger plan_tasks_set_updated_at
before update on public.plan_tasks
for each row execute function public.set_updated_at();

create table public.plan_task_steps (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.plan_tasks(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete restrict,
  title text not null check (length(btrim(title)) between 1 and 240),
  position integer not null default 0 check (position >= 0),
  is_completed boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (is_completed and completed_at is not null)
    or (not is_completed and completed_at is null)
  )
);

create index plan_task_steps_task_position_idx
  on public.plan_task_steps(task_id, position, created_at);
create trigger plan_task_steps_set_updated_at
before update on public.plan_task_steps
for each row execute function public.set_updated_at();

create table public.plan_notes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references public.households(id) on delete restrict,
  created_by uuid not null references public.profiles(id) on delete restrict,
  scope public.calendar_event_scope not null,
  title text check (title is null or length(title) <= 160),
  content text check (content is null or length(content) <= 20000),
  color text not null default 'SAGE'
    check (color in ('SAGE', 'SKY', 'SAND', 'ROSE', 'LILAC', 'WHITE')),
  pinned_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (scope = 'PERSONAL' and household_id is null)
    or (scope = 'HOUSEHOLD' and household_id is not null)
  ),
  check (
    length(btrim(coalesce(title, ''))) > 0
    or length(btrim(coalesce(content, ''))) > 0
  )
);

create index plan_notes_personal_sort_idx
  on public.plan_notes(created_by, archived_at, pinned_at desc, updated_at desc);
create index plan_notes_household_sort_idx
  on public.plan_notes(household_id, archived_at, pinned_at desc, updated_at desc);
create trigger plan_notes_set_updated_at
before update on public.plan_notes
for each row execute function public.set_updated_at();

create function public.protect_plan_identity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_table_name = 'plan_task_steps' then
    if new.task_id <> old.task_id or new.created_by <> old.created_by then
      raise exception 'Task step identity fields are immutable' using errcode = '22023';
    end if;
  elsif new.created_by <> old.created_by
    or new.scope <> old.scope
    or new.household_id is distinct from old.household_id then
    raise exception 'Plan item identity fields are immutable' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger plan_tasks_protect_identity
before update on public.plan_tasks
for each row execute function public.protect_plan_identity();
create trigger plan_task_steps_protect_identity
before update on public.plan_task_steps
for each row execute function public.protect_plan_identity();
create trigger plan_notes_protect_identity
before update on public.plan_notes
for each row execute function public.protect_plan_identity();

revoke execute on function public.protect_plan_identity() from public, anon, authenticated;

alter table public.plan_tasks enable row level security;
alter table public.plan_task_steps enable row level security;
alter table public.plan_notes enable row level security;

create policy plan_tasks_select_visible
on public.plan_tasks for select to authenticated
using (
  (scope = 'PERSONAL' and created_by = (select auth.uid()))
  or (scope = 'HOUSEHOLD' and public.is_household_member(household_id))
);
create policy plan_tasks_insert_allowed
on public.plan_tasks for insert to authenticated
with check (
  created_by = (select auth.uid())
  and (
    (scope = 'PERSONAL' and household_id is null)
    or (scope = 'HOUSEHOLD' and public.is_household_member(household_id))
  )
);
create policy plan_tasks_update_allowed
on public.plan_tasks for update to authenticated
using (
  (scope = 'PERSONAL' and created_by = (select auth.uid()))
  or (scope = 'HOUSEHOLD' and public.is_household_member(household_id))
)
with check (
  (scope = 'PERSONAL' and created_by = (select auth.uid()))
  or (scope = 'HOUSEHOLD' and public.is_household_member(household_id))
);
create policy plan_tasks_delete_allowed
on public.plan_tasks for delete to authenticated
using (
  (scope = 'PERSONAL' and created_by = (select auth.uid()))
  or (scope = 'HOUSEHOLD' and public.is_household_member(household_id))
);

create policy plan_task_steps_select_visible
on public.plan_task_steps for select to authenticated
using (
  exists (
    select 1 from public.plan_tasks task
    where task.id = plan_task_steps.task_id
  )
);
create policy plan_task_steps_insert_allowed
on public.plan_task_steps for insert to authenticated
with check (
  created_by = (select auth.uid())
  and exists (
    select 1 from public.plan_tasks task
    where task.id = plan_task_steps.task_id
  )
);
create policy plan_task_steps_update_allowed
on public.plan_task_steps for update to authenticated
using (
  exists (
    select 1 from public.plan_tasks task
    where task.id = plan_task_steps.task_id
  )
)
with check (
  exists (
    select 1 from public.plan_tasks task
    where task.id = plan_task_steps.task_id
  )
);
create policy plan_task_steps_delete_allowed
on public.plan_task_steps for delete to authenticated
using (
  exists (
    select 1 from public.plan_tasks task
    where task.id = plan_task_steps.task_id
  )
);

create policy plan_notes_select_visible
on public.plan_notes for select to authenticated
using (
  (scope = 'PERSONAL' and created_by = (select auth.uid()))
  or (scope = 'HOUSEHOLD' and public.is_household_member(household_id))
);
create policy plan_notes_insert_allowed
on public.plan_notes for insert to authenticated
with check (
  created_by = (select auth.uid())
  and (
    (scope = 'PERSONAL' and household_id is null)
    or (scope = 'HOUSEHOLD' and public.is_household_member(household_id))
  )
);
create policy plan_notes_update_allowed
on public.plan_notes for update to authenticated
using (
  (scope = 'PERSONAL' and created_by = (select auth.uid()))
  or (scope = 'HOUSEHOLD' and public.is_household_member(household_id))
)
with check (
  (scope = 'PERSONAL' and created_by = (select auth.uid()))
  or (scope = 'HOUSEHOLD' and public.is_household_member(household_id))
);
create policy plan_notes_delete_allowed
on public.plan_notes for delete to authenticated
using (
  (scope = 'PERSONAL' and created_by = (select auth.uid()))
  or (scope = 'HOUSEHOLD' and public.is_household_member(household_id))
);

revoke all on public.plan_tasks, public.plan_task_steps, public.plan_notes
from anon, authenticated;
grant select, insert, update, delete
on public.plan_tasks, public.plan_task_steps, public.plan_notes
to authenticated;
