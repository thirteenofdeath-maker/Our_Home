-- Daily and weekly summary notifications reuse the existing Push delivery
-- ledger so each device receives at most one copy of a digest window.
alter table public.notification_preferences
  add column digest_mode_enabled boolean not null default true,
  add column daily_digest_enabled boolean not null default true,
  add column weekly_digest_enabled boolean not null default true;

alter table public.notification_deliveries
  drop constraint if exists notification_deliveries_source_type_check,
  add constraint notification_deliveries_source_type_check check (
    source_type in (
      'REMINDER','TASK','EVENT','PET','BILL','CARD','TEST',
      'MEMBER_BIRTHDAY','PET_BIRTHDAY','DAILY_DIGEST','WEEKLY_DIGEST'
    )
  ),
  drop constraint if exists notification_deliveries_notification_kind_check,
  add constraint notification_deliveries_notification_kind_check check (
    notification_kind in (
      'AT_TIME','WEEK_BEFORE','DAY_BEFORE','DUE_DAY','DIGEST','TEST'
    )
  );

comment on column public.notification_preferences.digest_mode_enabled is
  'When enabled, suppresses individual scheduled pushes in favor of summaries.';
