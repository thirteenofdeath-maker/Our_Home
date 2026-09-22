-- Keep private profile fields behind owner-only RPCs. Supabase projects can
-- inherit broad default table privileges, so revoke them explicitly here.
revoke all privileges on table public.profiles from anon, authenticated;

grant select (id, display_name, email, avatar_url, gender, created_at, updated_at)
  on table public.profiles to authenticated;
grant update (display_name, avatar_url)
  on table public.profiles to authenticated;
