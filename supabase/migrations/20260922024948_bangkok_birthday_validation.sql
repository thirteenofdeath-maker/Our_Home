-- Birthday validation follows the product's Asia/Bangkok calendar day.
-- current_date otherwise uses the database session timezone (UTC), which
-- rejects a birthday entered between 00:00 and 06:59 Bangkok time.
alter table public.profiles
  drop constraint if exists profiles_birthday_not_future;
alter table public.profiles
  add constraint profiles_birthday_not_future check (
    birthday is null
    or birthday <= timezone('Asia/Bangkok', now())::date
  );

alter table public.pets
  drop constraint if exists pets_birthday_check;
alter table public.pets
  add constraint pets_birthday_not_future check (
    birthday is null
    or birthday <= timezone('Asia/Bangkok', now())::date
  );

-- These RPCs perform the same validation before reaching the constraints.
alter function public.update_profile_details(uuid, text, public.profile_gender, date, text, text)
  set timezone to 'Asia/Bangkok';
alter function public.create_pet(uuid, uuid, text, public.pet_species, text, public.pet_sex, date, text, uuid[])
  set timezone to 'Asia/Bangkok';
alter function public.update_pet(uuid, text, public.pet_species, text, public.pet_sex, date, text, uuid[])
  set timezone to 'Asia/Bangkok';
