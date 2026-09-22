-- Calendar exports expose only month/day for birthdays. Member birthdays
-- require explicit sharing and remain invisible to observers; pet birthdays
-- follow normal household visibility.
create function public.get_calendar_export_birthdays(p_household_id uuid)
returns table(
  subject_type text,
  subject_id uuid,
  display_name text,
  month_day text
)
language plpgsql
security definer
stable
set search_path = ''
as $$
declare v_role public.household_role;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  select hm.role into v_role
  from public.household_members hm
  where hm.household_id = p_household_id and hm.user_id = auth.uid();
  if v_role is null then
    raise exception 'Household membership required' using errcode = '42501';
  end if;

  if v_role <> 'observer' then
    return query
      select 'MEMBER'::text, p.id, p.display_name,
        to_char(p.birthday, 'MM-DD')
      from public.household_members hm
      join public.profiles p on p.id = hm.user_id
      where hm.household_id = p_household_id
        and hm.role <> 'observer'
        and p.birthday is not null
        and p.share_birthday_with_household = true;
  end if;

  return query
    select 'PET'::text, pet.id, pet.name, to_char(pet.birthday, 'MM-DD')
    from public.pets pet
    where pet.household_id = p_household_id
      and pet.archived_at is null
      and pet.birthday is not null;
end;
$$;

revoke execute on function public.get_calendar_export_birthdays(uuid)
  from public, anon;
grant execute on function public.get_calendar_export_birthdays(uuid)
  to authenticated;

comment on function public.get_calendar_export_birthdays(uuid) is
  'Privacy-safe shared birthday feed: no birth year and no member birthdays for observers.';
