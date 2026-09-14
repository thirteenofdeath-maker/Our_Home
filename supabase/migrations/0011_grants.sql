-- 0011_grants.sql
-- Explicit privilege grants. RLS (already enabled on every table above) is
-- the real authorization boundary; these GRANTs only control which
-- Postgres role may attempt a statement at all. We do not rely on a
-- hosting platform's implicit default privileges — they are stated here so
-- this schema behaves the same on any Postgres/Supabase instance.
--
-- `anon` (unauthenticated) gets nothing on these tables: every feature in
-- this app requires a signed-in user.

grant usage on schema public to authenticated;

grant select, insert, update on public.profiles to authenticated;

grant select, insert, update on public.households to authenticated;
grant select, insert, update, delete on public.household_members to authenticated;

grant select, insert, update on public.wallets to authenticated;
grant select, insert, update on public.pockets to authenticated;
grant select, insert, update, delete on public.categories to authenticated;

grant select, insert, update on public.transactions to authenticated;
grant select, insert on public.transaction_entries to authenticated;

grant execute on function public.is_household_member(uuid) to authenticated;
grant execute on function public.has_household_role(uuid, public.household_role[]) to authenticated;
grant execute on function public.add_household_member(uuid, text, public.household_role) to authenticated;
grant execute on function public.get_pocket_balance(uuid) to authenticated;
grant execute on function public.get_wallet_balance(uuid) to authenticated;
grant execute on function public.create_income_expense_transaction(public.transaction_type, uuid, uuid, uuid, numeric, text, text, timestamptz) to authenticated;
grant execute on function public.create_pocket_transfer(uuid, uuid, uuid, numeric, text, text, timestamptz) to authenticated;
grant execute on function public.create_wallet_transfer(uuid, uuid, uuid, uuid, numeric, text, text, timestamptz) to authenticated;
