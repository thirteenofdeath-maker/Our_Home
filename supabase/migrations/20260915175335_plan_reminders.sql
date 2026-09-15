-- First-class reminders for the unified Plan workspace.
-- Calendar and Today compose these rows for reading; they never copy them.

create table public.plan_reminders (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references public.households(id) on delete restrict,
  created_by uuid not null references public.profiles(id) on delete restrict,
  scope public.calendar_event_scope not null,
  title text not null check (length(btrim(title)) between 1 and 160),
  note text check (note is null or length(note) <= 5000),
  reminds_at timestamptz not null,
  recurrence text not null default 'NONE'
    check (recurrence in ('NONE', 'DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY')),
  is_completed boolean not null default false,
  completed_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (scope = 'PERSONAL' and household_id is null)
    or (scope = 'HOUSEHOLD' and household_id is not null)
  ),
  check (
    (is_completed and completed_at is not null)
    or (not is_completed and completed_at is null)
  )
);

create index plan_reminders_personal_time_idx
  on public.plan_reminders(created_by, archived_at, is_completed, reminds_at);
create index plan_reminders_household_time_idx
  on public.plan_reminders(household_id, archived_at, is_completed, reminds_at);
create trigger plan_reminders_set_updated_at
before update on public.plan_reminders
for each row execute function public.set_updated_at();

create function public.protect_plan_reminder_identity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.created_by <> old.created_by
    or new.scope <> old.scope
    or new.household_id is distinct from old.household_id then
    raise exception 'Reminder identity fields are immutable' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger plan_reminders_protect_identity
before update on public.plan_reminders
for each row execute function public.protect_plan_reminder_identity();
revoke execute on function public.protect_plan_reminder_identity()
from public, anon, authenticated;

alter table public.plan_reminders enable row level security;

create policy plan_reminders_select_visible
on public.plan_reminders for select to authenticated
using (
  (scope = 'PERSONAL' and created_by = (select auth.uid()))
  or (scope = 'HOUSEHOLD' and public.is_household_member(household_id))
);
create policy plan_reminders_insert_allowed
on public.plan_reminders for insert to authenticated
with check (
  created_by = (select auth.uid())
  and (
    (scope = 'PERSONAL' and household_id is null)
    or (scope = 'HOUSEHOLD' and public.is_household_member(household_id))
  )
);
create policy plan_reminders_update_allowed
on public.plan_reminders for update to authenticated
using (
  (scope = 'PERSONAL' and created_by = (select auth.uid()))
  or (scope = 'HOUSEHOLD' and public.is_household_member(household_id))
)
with check (
  (scope = 'PERSONAL' and created_by = (select auth.uid()))
  or (scope = 'HOUSEHOLD' and public.is_household_member(household_id))
);
create policy plan_reminders_delete_allowed
on public.plan_reminders for delete to authenticated
using (
  (scope = 'PERSONAL' and created_by = (select auth.uid()))
  or (scope = 'HOUSEHOLD' and public.is_household_member(household_id))
);

revoke all on public.plan_reminders from anon, authenticated;
grant select, insert, update, delete on public.plan_reminders to authenticated;

comment on table public.plan_reminders is
  'First-class personal/household reminders composed into Today and Calendar without duplicating source rows.';
