-- 0022_backfill_missing_profiles.sql
-- Data repair: some rows in auth.users have no matching public.profiles
-- row, confirmed against a live Supabase project. Because
-- wallets.owner_user_id and categories.owner_user_id both reference
-- profiles(id) (not auth.users(id) directly — see docs/ARCHITECTURE.md
-- §4: auth.users is the identity/credential store, profiles is the
-- application-facing row everything else hangs off), any such user hits
-- `wallets_owner_user_id_fkey` / `categories_owner_user_id_fkey`
-- violations the moment they try to create a wallet or category, even
-- though they are a perfectly valid, authenticated user.
--
-- Likely cause: these auth.users rows were created (via the dashboard,
-- the admin API, or a signup attempt) at a point before
-- on_auth_user_created (0002) existed on this database, or before it
-- could run successfully — see the null-email hardening below. Either
-- way, the fix has two parts: make the forward-going trigger robust so
-- this cannot happen again, and backfill the rows that already exist
-- without one.
--
-- This migration does NOT loosen wallets_owner_user_id_fkey /
-- categories_owner_user_id_fkey, and does NOT remove profiles or its
-- foreign-key relationship to auth.users — the fix is to make sure the
-- row that should always exist actually does, not to relax what depends
-- on it existing.

-- ---------------------------------------------------------------------
-- 1. Harden handle_new_user against null/missing email.
--
-- profiles.display_name and profiles.email are both NOT NULL (0002). The
-- previous definition (0002, then 0015) did
-- `split_part(new.email, '@', 1)` and `lower(new.email)` unconditionally.
-- Milestone 1 only wires up email/password auth, but auth.users itself
-- does not enforce email being present (phone auth, anonymous sign-ins,
-- and some admin-created rows can leave it null) — if new.email were ever
-- null, split_part/lower would both evaluate to null, the INSERT would
-- violate a NOT NULL constraint, and — because this trigger runs AFTER
-- INSERT on auth.users, in the same transaction — that failure would roll
-- back the entire signup, not just the profile creation. A user could
-- exist in auth.users with no profile only via this failure mode, or via
-- a row inserted before this trigger existed at all; either way the fix
-- is the same defensive coalesce.
--
-- `on conflict (id) do nothing` makes the insert itself idempotent (a
-- retried/duplicated trigger firing for the same auth.users.id, which
-- should not happen in normal operation, becomes a no-op instead of an
-- error) without changing behavior for the normal case.
--
-- Re-created via CREATE OR REPLACE / DROP TRIGGER IF EXISTS + CREATE
-- TRIGGER, per the standing rule that 0002/0015 are not edited — this
-- migration is what actually governs the function/trigger's behavior
-- going forward, on top of them.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_display_name text;
begin
  -- A synthetic, still-unique placeholder if auth.users.email is genuinely
  -- null — never NULL itself, so the NOT NULL/unique-index constraints on
  -- profiles.email are always satisfiable regardless of the auth method.
  v_email := lower(coalesce(new.email, new.id::text || '@no-email.invalid'));
  v_display_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
    nullif(split_part(v_email, '@', 1), ''),
    'Member'
  );

  insert into public.profiles (id, display_name, email)
  values (new.id, v_display_name, v_email)
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- 2. Backfill: one profiles row for every auth.users row that doesn't
-- already have one. Existing profiles rows are never touched — the LEFT
-- JOIN ... WHERE p.id IS NULL only ever selects users with NO profile at
-- all, and ON CONFLICT (id) DO NOTHING is a second, redundant guarantee
-- of the same thing (this statement can be re-run safely; it only ever
-- inserts, never updates).
-- ---------------------------------------------------------------------

insert into public.profiles (id, display_name, email)
select
  u.id,
  coalesce(
    nullif(trim(u.raw_user_meta_data ->> 'display_name'), ''),
    nullif(split_part(lower(coalesce(u.email, u.id::text || '@no-email.invalid')), '@', 1), ''),
    'Member'
  ),
  lower(coalesce(u.email, u.id::text || '@no-email.invalid'))
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- Security note: nothing above is reachable by a normal client.
-- handle_new_user is SECURITY DEFINER but only ever fires as an AFTER
-- INSERT trigger on auth.users — it takes no parameters a client could
-- control beyond the NEW row Postgres itself supplies from the already-
-- authenticated signup, so there is no "call this with an arbitrary user
-- id" surface. The backfill above is a one-time statement executed by the
-- migration-running role, not a function left behind for anyone to call
-- again. profiles itself still has no client-facing INSERT grant
-- (revoked in 0015) and no INSERT RLS policy (0002) — an authenticated
-- client cannot create a profiles row for themselves OR anyone else via
-- PostgREST regardless; the trigger and this migration remain the only
-- two ways a row is ever created.
