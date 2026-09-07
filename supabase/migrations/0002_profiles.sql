-- 0002_profiles.sql
-- Application-level user profile, separate from auth.users. One row per
-- Supabase Auth user, same primary key, created automatically on signup.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  -- Denormalized copy of auth.users.email, kept in sync at signup only.
  -- Exists solely so household invites can look a person up by email
  -- without exposing auth.users to clients. Never used for authentication.
  email text not null,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'Application profile data, 1:1 with auth.users. auth.users remains the sole identity/credential store.';

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Creates the profiles row automatically whenever a new auth.users row is
-- inserted, regardless of auth provider (email today; Google/Apple later
-- need no changes here). SECURITY DEFINER is required: this runs as part of
-- the Supabase Auth signup flow, before the new user has any session, so it
-- cannot rely on RLS as themselves.
create function public.handle_new_user()
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
    new.email
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;

create policy profiles_select_own
  on public.profiles for select
  using (id = auth.uid());

create policy profiles_update_own
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- No insert/delete policy: rows are created only by handle_new_user() and
-- deleted only via auth.users cascade. Clients never insert/delete directly.
