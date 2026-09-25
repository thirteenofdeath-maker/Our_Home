-- One logical in-app notification per user. Push deliveries stay device-level
-- in notification_deliveries, while this table is the user-facing history and
-- therefore never duplicates an item when one person has several devices.
create table public.notification_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  source_type text not null check (source_type in (
    'REMINDER','TASK','EVENT','PET','BILL','CARD','MEMBER_BIRTHDAY',
    'PET_BIRTHDAY','DAILY_DIGEST','WEEKLY_DIGEST','INVENTORY','TEST'
  )),
  source_id text not null,
  occurrence_key text not null,
  notification_kind text not null check (notification_kind in (
    'AT_TIME','WEEK_BEFORE','DAY_BEFORE','DUE_DAY','DIGEST','TEST'
  )),
  category text not null check (category in ('plan','pets','finance','inventory')),
  title text not null check (length(title) between 1 and 200),
  body text not null check (length(body) between 1 and 2000),
  url text not null check (length(url) between 1 and 1000 and url like '/%'),
  scheduled_for timestamptz not null,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, source_type, source_id, occurrence_key, notification_kind)
);

create index notification_history_user_time_idx
  on public.notification_history(user_id, scheduled_for desc);
create index notification_history_user_unread_idx
  on public.notification_history(user_id, scheduled_for desc)
  where read_at is null;

alter table public.notification_history enable row level security;

create policy notification_history_select_own
on public.notification_history for select to authenticated
using ((select auth.uid()) = user_id);

create policy notification_history_mark_read_own
on public.notification_history for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

revoke all on public.notification_history from public, anon, authenticated;
grant select, update(read_at) on public.notification_history to authenticated;
grant select, insert, update on public.notification_history to service_role;

comment on table public.notification_history is
  'User-facing notification inbox. One row per logical candidate and user, independent of Push devices.';
