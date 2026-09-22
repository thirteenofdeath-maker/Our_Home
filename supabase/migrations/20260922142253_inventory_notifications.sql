-- Inventory alerts can be disabled independently and use the existing
-- idempotent Push delivery ledger.
alter table public.notification_preferences
  add column inventory_enabled boolean not null default true;

alter table public.notification_deliveries
  drop constraint if exists notification_deliveries_source_type_check,
  add constraint notification_deliveries_source_type_check check (
    source_type in (
      'REMINDER','TASK','EVENT','PET','BILL','CARD','TEST',
      'MEMBER_BIRTHDAY','PET_BIRTHDAY','DAILY_DIGEST','WEEKLY_DIGEST',
      'INVENTORY'
    )
  );

comment on column public.notification_preferences.inventory_enabled is
  'Controls low-stock, expiry, and warranty Push notifications.';
