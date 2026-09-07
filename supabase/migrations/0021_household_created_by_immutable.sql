-- 0021_household_created_by_immutable.sql
-- Second Milestone 1 hardening pass, item 8.
--
-- households.created_by is audit/identity metadata (who founded this
-- household) and was never protected by an immutability trigger — only
-- wallets/pockets/categories got one in 0014. An owner/admin could
-- currently PATCH created_by to any profile id via
-- households_update_owner_admin (0004), which only checks the caller's
-- role, not which columns they're touching.
--
-- Reuses the existing generic guard (0014's
-- prevent_immutable_column_changes) rather than writing a bespoke
-- trigger. Only `created_by` is listed, so renaming a household (updating
-- `name`, which households_update_owner_admin already allows) is
-- untouched.

create trigger households_prevent_created_by_changes
  before update on public.households
  for each row execute function public.prevent_immutable_column_changes('created_by');
