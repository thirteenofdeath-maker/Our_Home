-- 0024_profile_enhancement.sql
-- Expand-only profile identity fields plus private, owner-scoped avatars.

create type public.profile_gender as enum ('MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY');

alter table public.profiles
  add column gender public.profile_gender,
  add column birthday date,
  add constraint profiles_birthday_not_future check (birthday is null or birthday <= current_date);

-- Household peers need presentation fields, but birthday stays private.
revoke select on public.profiles from authenticated;
grant select (id, display_name, email, avatar_url, gender, created_at, updated_at)
  on public.profiles to authenticated;

create function public.get_own_profile()
returns public.profiles
language sql
security definer
set search_path = ''
stable
as $$
  select p from public.profiles p where p.id = auth.uid();
$$;

create function public.update_profile_details(
  p_household_id uuid,
  p_display_name text,
  p_gender public.profile_gender,
  p_birthday date,
  p_member_color text,
  p_avatar_url text
)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if nullif(btrim(p_display_name), '') is null or length(btrim(p_display_name)) > 80 then
    raise exception 'Display name must contain 1 to 80 characters' using errcode = '22023';
  end if;
  if p_birthday is not null and p_birthday > current_date then
    raise exception 'Birthday cannot be in the future' using errcode = '22023';
  end if;
  if p_member_color not in ('#7A9E7E', '#7C9DBD', '#D49A89', '#C5A3C7', '#D2AD62', '#789F97') then
    raise exception 'Invalid member color' using errcode = '22023';
  end if;

  select * into v_profile from public.profiles where id = auth.uid();
  if not found then
    raise exception 'Profile not found' using errcode = 'P0002';
  end if;
  -- Preserve pre-Storage URLs, but only permit newly changed values in the
  -- authenticated user's deterministic Storage path.
  if p_avatar_url is distinct from v_profile.avatar_url
     and p_avatar_url is not null
     and p_avatar_url !~ ('^' || auth.uid()::text || '/avatar\.(jpg|png|webp)$') then
    raise exception 'Invalid avatar path' using errcode = '22023';
  end if;

  update public.household_members
  set member_color = p_member_color
  where household_id = p_household_id and user_id = auth.uid();
  if not found then
    raise exception 'Household membership not found' using errcode = '42501';
  end if;

  update public.profiles
  set display_name = btrim(p_display_name), gender = p_gender,
      birthday = p_birthday, avatar_url = p_avatar_url
  where id = auth.uid()
  returning * into v_profile;
  return v_profile;
end;
$$;

revoke execute on function public.get_own_profile() from public, anon;
revoke execute on function public.update_profile_details(uuid, text, public.profile_gender, date, text, text) from public, anon;
grant execute on function public.get_own_profile() to authenticated;
grant execute on function public.update_profile_details(uuid, text, public.profile_gender, date, text, text) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy avatars_insert_own on storage.objects for insert to authenticated
with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy avatars_update_own on storage.objects for update to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy avatars_delete_own on storage.objects for delete to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy avatars_select_household on storage.objects for select to authenticated
using (
  bucket_id = 'avatars' and (
    (storage.foldername(name))[1] = auth.uid()::text
    or exists (
      select 1 from public.household_members mine
      join public.household_members theirs on theirs.household_id = mine.household_id
      where mine.user_id = auth.uid()
        and theirs.user_id::text = (storage.foldername(name))[1]
    )
  )
);

-- Rollback: drop avatar policies/bucket objects manually, drop functions,
-- restore prior profile SELECT grant, drop columns, then drop profile_gender.
