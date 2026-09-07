-- 0001_extensions_and_helpers.sql
-- Extensions and generic helper functions used by every later migration.

create extension if not exists pgcrypto; -- gen_random_uuid()

-- Generic "touch updated_at on every UPDATE" trigger function, reused by
-- every table below that has an updated_at column. SECURITY INVOKER
-- (default) is fine: it only ever writes NEW.updated_at, which the caller
-- is already allowed to write because they're updating the row.
create function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'Generic BEFORE UPDATE trigger: sets updated_at = now() on every row update.';
