-- Birthday notifications are opt-in for people and enabled per recipient.
-- The private birthday value never becomes directly selectable by household peers.
alter table public.profiles
  add column share_birthday_with_household boolean not null default false,
  add constraint profiles_shared_birthday_requires_date check (
    not share_birthday_with_household or birthday is not null
  );

alter table public.notification_preferences
  add column member_birthdays_enabled boolean not null default true,
  add column pet_birthdays_enabled boolean not null default true,
  add column birthday_week_before_enabled boolean not null default true;

alter table public.notification_deliveries
  drop constraint if exists notification_deliveries_source_type_check,
  add constraint notification_deliveries_source_type_check check (
    source_type in (
      'REMINDER','TASK','EVENT','PET','BILL','CARD','TEST',
      'MEMBER_BIRTHDAY','PET_BIRTHDAY'
    )
  ),
  drop constraint if exists notification_deliveries_notification_kind_check,
  add constraint notification_deliveries_notification_kind_check check (
    notification_kind in ('AT_TIME','WEEK_BEFORE','DAY_BEFORE','DUE_DAY','TEST')
  );

-- Add the sharing choice to the existing atomic profile update boundary.
create function public.update_profile_details(
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
  if p_member_color not in ('#7A9E7E', '#7C9DBD', '#D49A89', '#C5A3C7', '#D2AD62', '#789F97') then
    raise exception 'Invalid member color' using errcode = '22023';
  end if;

  select * into v_profile from public.profiles where id = auth.uid();
  if not found then
    raise exception 'Profile not found' using errcode = 'P0002';
  end if;
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

revoke execute on function public.update_profile_details(
  uuid,text,public.profile_gender,date,boolean,text,text
) from public, anon;
grant execute on function public.update_profile_details(
  uuid,text,public.profile_gender,date,boolean,text,text
) to authenticated;
drop function public.update_profile_details(
  uuid,text,public.profile_gender,date,text,text
);
