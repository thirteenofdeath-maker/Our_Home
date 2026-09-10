-- 0025_pets_foundation.sql
-- Pet identity, household-scoped caregivers, archive lifecycle, and private photos.

create type public.pet_species as enum ('CAT', 'DOG', 'RABBIT', 'BIRD', 'FISH', 'OTHER');
create type public.pet_sex as enum ('MALE', 'FEMALE', 'UNKNOWN');

create table public.pets (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete restrict,
  name text not null check (length(btrim(name)) between 1 and 80),
  species public.pet_species not null,
  breed text check (breed is null or length(btrim(breed)) between 1 and 100),
  sex public.pet_sex,
  birthday date check (birthday is null or birthday <= current_date),
  photo_path text,
  archived_at timestamptz,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, household_id)
);
create index pets_household_active_idx on public.pets(household_id, archived_at, created_at);
create trigger pets_set_updated_at before update on public.pets
for each row execute function public.set_updated_at();

alter table public.household_members add constraint household_members_id_household_unique unique (id, household_id);
create table public.pet_caregivers (
  pet_id uuid not null,
  household_member_id uuid not null,
  household_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (pet_id, household_member_id),
  foreign key (pet_id, household_id) references public.pets(id, household_id) on delete cascade,
  foreign key (household_member_id, household_id) references public.household_members(id, household_id) on delete cascade
);
create index pet_caregivers_household_idx on public.pet_caregivers(household_id);

alter table public.pets enable row level security;
alter table public.pet_caregivers enable row level security;
create policy pets_select_household on public.pets for select to authenticated
using (public.is_household_member(household_id));
create policy pet_caregivers_select_household on public.pet_caregivers for select to authenticated
using (public.is_household_member(household_id));

revoke all on public.pets, public.pet_caregivers from anon, authenticated;
grant select on public.pets, public.pet_caregivers to authenticated;

create function public.replace_pet_caregivers_internal(
  p_pet_id uuid, p_household_id uuid, p_caregiver_member_ids uuid[]
) returns void language plpgsql security definer set search_path = '' as $$
declare v_requested int; v_valid int;
begin
  v_requested := cardinality(coalesce(p_caregiver_member_ids, array[]::uuid[]));
  select count(distinct hm.id) into v_valid from public.household_members hm
    where hm.household_id = p_household_id and hm.id = any(coalesce(p_caregiver_member_ids, array[]::uuid[]));
  if v_valid <> v_requested then
    raise exception 'Every caregiver must be a unique member of the pet household' using errcode = '22023';
  end if;
  delete from public.pet_caregivers where pet_id = p_pet_id;
  insert into public.pet_caregivers(pet_id, household_member_id, household_id)
    select p_pet_id, unnest(coalesce(p_caregiver_member_ids, array[]::uuid[])), p_household_id;
end; $$;
revoke execute on function public.replace_pet_caregivers_internal(uuid, uuid, uuid[]) from public, anon, authenticated;

create function public.create_pet(
  p_id uuid, p_household_id uuid, p_name text, p_species public.pet_species, p_breed text,
  p_sex public.pet_sex, p_birthday date, p_photo_path text, p_caregiver_member_ids uuid[]
) returns public.pets language plpgsql security definer set search_path = '' as $$
declare v_pet public.pets;
begin
  if not public.has_household_role(p_household_id, array['owner','admin']::public.household_role[]) then
    raise exception 'Pet management requires owner or admin role' using errcode = '42501'; end if;
  if p_birthday is not null and p_birthday > current_date then raise exception 'Birthday cannot be in the future' using errcode = '22023'; end if;
  if p_photo_path is not null and p_photo_path !~ ('^' || p_household_id || '/' || p_id || '/profile\.(jpg|png|webp)$') then
    raise exception 'Invalid pet photo path' using errcode = '22023'; end if;
  insert into public.pets(id, household_id, name, species, breed, sex, birthday, photo_path, created_by)
  values (p_id, p_household_id, btrim(p_name), p_species, nullif(btrim(p_breed), ''), p_sex, p_birthday, p_photo_path, auth.uid())
  returning * into v_pet;
  perform public.replace_pet_caregivers_internal(p_id, p_household_id, p_caregiver_member_ids);
  return v_pet;
end; $$;

create function public.update_pet(
  p_pet_id uuid, p_name text, p_species public.pet_species, p_breed text,
  p_sex public.pet_sex, p_birthday date, p_photo_path text, p_caregiver_member_ids uuid[]
) returns public.pets language plpgsql security definer set search_path = '' as $$
declare v_pet public.pets;
begin
  select * into v_pet from public.pets where id = p_pet_id;
  if not found then raise exception 'Pet not found' using errcode = 'P0002'; end if;
  if not public.has_household_role(v_pet.household_id, array['owner','admin']::public.household_role[]) then
    raise exception 'Pet management requires owner or admin role' using errcode = '42501'; end if;
  if p_birthday is not null and p_birthday > current_date then raise exception 'Birthday cannot be in the future' using errcode = '22023'; end if;
  if p_photo_path is not null and p_photo_path !~ ('^' || v_pet.household_id || '/' || p_pet_id || '/profile\.(jpg|png|webp)$') then
    raise exception 'Invalid pet photo path' using errcode = '22023'; end if;
  update public.pets set name=btrim(p_name), species=p_species, breed=nullif(btrim(p_breed), ''),
    sex=p_sex, birthday=p_birthday, photo_path=p_photo_path where id=p_pet_id returning * into v_pet;
  perform public.replace_pet_caregivers_internal(p_pet_id, v_pet.household_id, p_caregiver_member_ids);
  return v_pet;
end; $$;

create function public.set_pet_archived(p_pet_id uuid, p_archived boolean)
returns public.pets language plpgsql security definer set search_path = '' as $$
declare v_pet public.pets;
begin
  select * into v_pet from public.pets where id=p_pet_id;
  if not found then raise exception 'Pet not found' using errcode = 'P0002'; end if;
  if not public.has_household_role(v_pet.household_id, array['owner','admin']::public.household_role[]) then
    raise exception 'Pet management requires owner or admin role' using errcode = '42501'; end if;
  update public.pets set archived_at=case when p_archived then coalesce(archived_at, now()) else null end
    where id=p_pet_id returning * into v_pet;
  return v_pet;
end; $$;

revoke execute on function public.create_pet(uuid,uuid,text,public.pet_species,text,public.pet_sex,date,text,uuid[]) from public, anon;
revoke execute on function public.update_pet(uuid,text,public.pet_species,text,public.pet_sex,date,text,uuid[]) from public, anon;
revoke execute on function public.set_pet_archived(uuid,boolean) from public, anon;
grant execute on function public.create_pet(uuid,uuid,text,public.pet_species,text,public.pet_sex,date,text,uuid[]) to authenticated;
grant execute on function public.update_pet(uuid,text,public.pet_species,text,public.pet_sex,date,text,uuid[]) to authenticated;
grant execute on function public.set_pet_archived(uuid,boolean) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('pet-photos','pet-photos',false,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create policy pet_photos_read on storage.objects for select to authenticated using (
  bucket_id='pet-photos' and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/profile\.(jpg|png|webp)$'
  and public.is_household_member(((storage.foldername(name))[1])::uuid));
create policy pet_photos_insert on storage.objects for insert to authenticated with check (
  bucket_id='pet-photos' and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/profile\.(jpg|png|webp)$'
  and public.has_household_role(((storage.foldername(name))[1])::uuid,array['owner','admin']::public.household_role[]));
create policy pet_photos_update on storage.objects for update to authenticated using (
  bucket_id='pet-photos' and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/profile\.(jpg|png|webp)$'
  and public.has_household_role(((storage.foldername(name))[1])::uuid,array['owner','admin']::public.household_role[]))
with check (bucket_id='pet-photos' and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/profile\.(jpg|png|webp)$'
  and public.has_household_role(((storage.foldername(name))[1])::uuid,array['owner','admin']::public.household_role[]));
create policy pet_photos_delete on storage.objects for delete to authenticated using (
  bucket_id='pet-photos' and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/profile\.(jpg|png|webp)$'
  and public.has_household_role(((storage.foldername(name))[1])::uuid,array['owner','admin']::public.household_role[]));

-- Rollback before Pet Care depends on pets: remove Storage policies/bucket objects,
-- drop RPCs/tables/enums, then drop household_members_id_household_unique.
