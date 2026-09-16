-- Dispatch due notifications once per minute. URL, publishable key and the
-- additional scheduler secret remain encrypted in Supabase Vault.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'dispatch-our-home-notifications',
  '* * * * *',
  $$
  select net.http_post(
    url := (
      select decrypted_secret from vault.decrypted_secrets
      where name = 'our_home_supabase_url'
    ) || '/functions/v1/dispatch-notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret from vault.decrypted_secrets
        where name = 'our_home_publishable_key'
      ),
      'x-cron-secret', (
        select decrypted_secret from vault.decrypted_secrets
        where name = 'our_home_notification_cron_secret'
      )
    ),
    body := jsonb_build_object('mode', 'scheduled', 'invoked_at', now())
  );
  $$
);
