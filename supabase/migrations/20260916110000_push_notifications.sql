-- Native-like Web Push preferences and subscriptions. Delivery is performed
-- by the dispatch-notifications Edge Function; no private VAPID material is
-- exposed through the public API.

create table public.push_public_config (
  id boolean primary key default true check (id),
  vapid_public_key text not null check (length(vapid_public_key) >= 80),
  vapid_subject text not null default 'mailto:notifications@our-home.app',
  updated_at timestamptz not null default now()
);

create table public.notification_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  plan_enabled boolean not null default true,
  pets_enabled boolean not null default true,
  finance_enabled boolean not null default true,
  day_before_enabled boolean not null default true,
  due_day_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger notification_preferences_set_updated_at
before update on public.notification_preferences
for each row execute function public.set_updated_at();

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique check (length(endpoint) between 20 and 4096),
  p256dh text not null check (length(p256dh) between 40 and 512),
  auth_key text not null check (length(auth_key) between 8 and 256),
  user_agent text check (user_agent is null or length(user_agent) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index push_subscriptions_user_idx on public.push_subscriptions(user_id);
create trigger push_subscriptions_set_updated_at
before update on public.push_subscriptions
for each row execute function public.set_updated_at();

create table public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  subscription_id uuid not null references public.push_subscriptions(id) on delete cascade,
  source_type text not null check (source_type in ('REMINDER','TASK','EVENT','PET','BILL','CARD','TEST')),
  source_id text not null,
  occurrence_key text not null,
  notification_kind text not null check (notification_kind in ('AT_TIME','DAY_BEFORE','DUE_DAY','TEST')),
  scheduled_for timestamptz not null,
  status text not null default 'PENDING' check (status in ('PENDING','SENT','FAILED')),
  attempts integer not null default 1 check (attempts between 1 and 3),
  sent_at timestamptz,
  error text check (error is null or length(error) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (subscription_id, source_type, source_id, occurrence_key, notification_kind)
);

create index notification_deliveries_user_time_idx
  on public.notification_deliveries(user_id, scheduled_for desc);
create trigger notification_deliveries_set_updated_at
before update on public.notification_deliveries
for each row execute function public.set_updated_at();

alter table public.push_public_config enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.notification_deliveries enable row level security;

create policy notification_preferences_select_own
on public.notification_preferences for select to authenticated
using (user_id = (select auth.uid()));
create policy notification_preferences_insert_own
on public.notification_preferences for insert to authenticated
with check (user_id = (select auth.uid()));
create policy notification_preferences_update_own
on public.notification_preferences for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy push_subscriptions_select_own
on public.push_subscriptions for select to authenticated
using (user_id = (select auth.uid()));
create policy push_subscriptions_insert_own
on public.push_subscriptions for insert to authenticated
with check (user_id = (select auth.uid()));
create policy push_subscriptions_update_own
on public.push_subscriptions for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));
create policy push_subscriptions_delete_own
on public.push_subscriptions for delete to authenticated
using (user_id = (select auth.uid()));

revoke all on public.push_public_config, public.notification_preferences,
  public.push_subscriptions, public.notification_deliveries
from public, anon, authenticated;
grant select, insert, update on public.notification_preferences to authenticated;
grant select, insert, update, delete on public.push_subscriptions to authenticated;

create function public.get_push_public_config()
returns table(vapid_public_key text, vapid_subject text)
language sql
security definer
stable
set search_path = ''
as $$
  select c.vapid_public_key, c.vapid_subject
  from public.push_public_config c
  where c.id = true;
$$;
revoke execute on function public.get_push_public_config() from public, anon;
grant execute on function public.get_push_public_config() to authenticated, service_role;

create function public.get_push_server_secrets()
returns table(vapid_private_key text, cron_secret text)
language sql
security definer
stable
set search_path = ''
as $$
  select
    max(decrypted_secret) filter (where name = 'our_home_vapid_private_key'),
    max(decrypted_secret) filter (where name = 'our_home_notification_cron_secret')
  from vault.decrypted_secrets;
$$;
revoke execute on function public.get_push_server_secrets() from public, anon, authenticated;
grant execute on function public.get_push_server_secrets() to service_role;

create function public.claim_notification_delivery(
  p_user_id uuid,
  p_subscription_id uuid,
  p_source_type text,
  p_source_id text,
  p_occurrence_key text,
  p_notification_kind text,
  p_scheduled_for timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_id uuid;
begin
  insert into public.notification_deliveries(
    user_id, subscription_id, source_type, source_id, occurrence_key,
    notification_kind, scheduled_for
  ) values (
    p_user_id, p_subscription_id, p_source_type, p_source_id, p_occurrence_key,
    p_notification_kind, p_scheduled_for
  )
  on conflict (subscription_id, source_type, source_id, occurrence_key, notification_kind)
  do update set
    status = 'PENDING',
    attempts = public.notification_deliveries.attempts + 1,
    error = null,
    updated_at = now()
  where public.notification_deliveries.status = 'FAILED'
    and public.notification_deliveries.attempts < 3
  returning id into v_id;
  return v_id;
end;
$$;
revoke execute on function public.claim_notification_delivery(uuid,uuid,text,text,text,text,timestamptz)
from public, anon, authenticated;
grant execute on function public.claim_notification_delivery(uuid,uuid,text,text,text,text,timestamptz)
to service_role;

comment on table public.push_subscriptions is
  'Per-device Web Push subscriptions. RLS limits each user to their own devices.';
comment on table public.notification_deliveries is
  'Server-only delivery ledger and idempotency key for scheduled Push notifications.';
