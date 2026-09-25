-- Let each member choose any valid six-digit HEX color while retaining a
-- database boundary against arbitrary CSS values.
alter table public.household_members
  drop constraint household_members_member_color_palette,
  add constraint household_members_member_color_hex
    check (member_color ~ '^#[0-9A-Fa-f]{6}$');

create or replace function public.update_member_presentation(
  p_household_id uuid,
  p_display_name text,
  p_member_color text
)
returns public.household_members
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result public.household_members;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if nullif(btrim(p_display_name), '') is null or length(btrim(p_display_name)) > 80 then
    raise exception 'Display name must contain 1 to 80 characters' using errcode = '22023';
  end if;
  if p_member_color is null or p_member_color !~ '^#[0-9A-Fa-f]{6}$' then
    raise exception 'Invalid member color' using errcode = '22023';
  end if;

  update public.household_members
  set member_color = upper(p_member_color)
  where household_id = p_household_id and user_id = auth.uid()
  returning * into v_result;
  if v_result.id is null then
    raise exception 'Household membership not found' using errcode = '42501';
  end if;

  update public.profiles
  set display_name = btrim(p_display_name)
  where id = auth.uid();
  return v_result;
end;
$$;

create or replace function public.update_profile_details(
  p_household_id uuid,
  p_display_name text,
  p_gender public.profile_gender,
  p_birthday date,
  p_share_birthday_with_household boolean,
  p_member_color text,
  p_avatar_url text
)
returns public.profiles
language plpgsql
security definer
set search_path = ''
set timezone = 'Asia/Bangkok'
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
  if p_share_birthday_with_household and p_birthday is null then
    raise exception 'Add a birthday before sharing it' using errcode = '22023';
  end if;
  if p_member_color is null or p_member_color !~ '^#[0-9A-Fa-f]{6}$' then
    raise exception 'Invalid member color' using errcode = '22023';
  end if;

  select * into v_profile
  from public.profiles
  where id = auth.uid();
  if not found then
    raise exception 'Profile not found' using errcode = 'P0002';
  end if;
  if p_avatar_url is distinct from v_profile.avatar_url
     and p_avatar_url is not null
     and p_avatar_url !~ ('^' || auth.uid()::text || '/avatar\.(jpg|png|webp)$') then
    raise exception 'Invalid avatar path' using errcode = '22023';
  end if;

  update public.household_members
  set member_color = upper(p_member_color)
  where household_id = p_household_id and user_id = auth.uid();
  if not found then
    raise exception 'Household membership not found' using errcode = '42501';
  end if;

  update public.profiles
  set display_name = btrim(p_display_name),
      gender = p_gender,
      birthday = p_birthday,
      share_birthday_with_household = p_share_birthday_with_household,
      avatar_url = p_avatar_url
  where id = auth.uid()
  returning * into v_profile;
  return v_profile;
end;
$$;

revoke execute on function public.update_member_presentation(uuid, text, text)
  from public, anon;
grant execute on function public.update_member_presentation(uuid, text, text)
  to authenticated;
revoke execute on function public.update_profile_details(
  uuid, text, public.profile_gender, date, boolean, text, text
) from public, anon;
grant execute on function public.update_profile_details(
  uuid, text, public.profile_gender, date, boolean, text, text
) to authenticated;

comment on function public.update_member_presentation(uuid, text, text) is
  'Updates only auth.uid() display name and membership color after membership and HEX validation.';
