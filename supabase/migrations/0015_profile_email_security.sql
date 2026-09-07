-- 0015_profile_email_security.sql
-- Milestone 1 hardening pass, item 4.
--
-- profiles.email is used as the lookup key for household invites
-- (add_household_member, redesigned in 0016). Before this migration,
-- `grant update on public.profiles to authenticated` plus
-- `profiles_update_own` (using id = auth.uid()) meant any authenticated
-- user could PATCH their OWN profiles.email to any string at all via
-- PostgREST — letting them impersonate someone else's invite address, or
-- simply drift out of sync with their real auth.users.email.

-- ---------------------------------------------------------------------
-- Column-level privilege instead of table-level: authenticated may update
-- their own display_name/avatar_url, and nothing else on this table (not
-- email, not id, not created_at). This is enforced before RLS is even
-- evaluated — a request that references the email column in its SET
-- clause is rejected outright, regardless of whose row it targets.
-- ---------------------------------------------------------------------

revoke update on public.profiles from authenticated;
grant update (display_name, avatar_url) on public.profiles to authenticated;

-- 0011 also granted table-level INSERT on profiles to authenticated. It
-- was already inert (profiles has no RLS INSERT policy, so RLS denies
-- every insert attempt by a non-owner role regardless of the grant) —
-- rows are created only by handle_new_user. Revoked anyway: an unused
-- grant is a latent risk if a permissive INSERT policy is ever added
-- later without this being reconsidered at the same time.
revoke insert on public.profiles from authenticated;

-- ---------------------------------------------------------------------
-- Case-insensitive uniqueness: without this, "person@example.com" and
-- "Person@Example.com" would be two different lookup keys even though
-- they are the same mailbox, and (had email still been client-writable)
-- two profile rows could both plausibly claim to "be" the same invite
-- address. Enforced as a unique index on lower(email), which also gives
-- add_household_member (0016) a fast, race-safe lookup.
-- ---------------------------------------------------------------------

create unique index profiles_email_unique_ci_idx on public.profiles (lower(email));

-- ---------------------------------------------------------------------
-- handle_new_user (0002) is redefined here — CREATE OR REPLACE, not an
-- edit to the original migration file — solely to normalize the copied
-- email to lowercase, so it always matches the unique index above and
-- invite lookups are consistent regardless of how a user typed their
-- email at signup.
-- ---------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    lower(new.email)
  );
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- Auth email changes: Supabase Auth lets a user change auth.users.email
-- (with its own confirmation flow). Milestone 1's profiles.email was only
-- ever synced at signup, so a later email change would silently desync
-- profiles.email from the user's real login email, and invites sent to
-- their old address would keep "working" (finding the profile) even
-- though it no longer reflects how they sign in. This trigger keeps them
-- in sync going forward. It is documented here rather than left as a
-- known gap because it is a small, mechanical extension of the existing
-- handle_new_user pattern — not a new feature, and not in scope creep
-- territory (Bills/Tasks/Calendar/etc. remain untouched).
-- ---------------------------------------------------------------------

create function public.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is distinct from old.email then
    update public.profiles set email = lower(new.email) where id = new.id;
  end if;
  return new;
end;
$$;

comment on function public.handle_user_email_change() is
  'Keeps profiles.email in sync when a user changes their Supabase Auth email after signup.';

create trigger on_auth_user_email_updated
  after update of email on auth.users
  for each row execute function public.handle_user_email_change();
