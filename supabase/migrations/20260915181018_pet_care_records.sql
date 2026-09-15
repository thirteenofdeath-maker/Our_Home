-- Household pet-care timeline. The record stays authoritative in Pets;
-- Today and Calendar only compose scheduled_at rows for reading.

create table public.pet_care_records (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null,
  household_id uuid not null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  record_type text not null check (
    record_type in ('HEALTH', 'VACCINE', 'MEDICATION', 'VET', 'WEIGHT', 'EXPENSE', 'DOCUMENT')
  ),
  title text not null check (length(btrim(title)) between 1 and 160),
  note text check (note is null or length(note) <= 5000),
  recorded_at timestamptz not null default now(),
  scheduled_at timestamptz,
  value numeric check (value is null or value > 0),
  unit text check (unit is null or length(btrim(unit)) between 1 and 24),
  provider text check (provider is null or length(btrim(provider)) between 1 and 160),
  transaction_id uuid references public.transactions(id) on delete set null,
  document_path text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (pet_id, household_id)
    references public.pets(id, household_id) on delete cascade,
  check (record_type = 'WEIGHT' or value is null),
  check (record_type = 'WEIGHT' or unit is null)
);

create index pet_care_records_pet_time_idx
  on public.pet_care_records(pet_id, archived_at, recorded_at desc);
create index pet_care_records_household_schedule_idx
  on public.pet_care_records(household_id, archived_at, scheduled_at)
  where scheduled_at is not null;
create index pet_care_records_transaction_idx
  on public.pet_care_records(transaction_id)
  where transaction_id is not null;
create trigger pet_care_records_set_updated_at
before update on public.pet_care_records
for each row execute function public.set_updated_at();

create function public.protect_pet_care_record_identity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.pet_id <> old.pet_id
    or new.household_id <> old.household_id
    or new.created_by <> old.created_by then
    raise exception 'Pet care record identity fields are immutable' using errcode = '22023';
  end if;
  return new;
end;
$$;
create trigger pet_care_records_protect_identity
before update on public.pet_care_records
for each row execute function public.protect_pet_care_record_identity();
revoke execute on function public.protect_pet_care_record_identity()
from public, anon, authenticated;

alter table public.pet_care_records enable row level security;
create policy pet_care_records_select_household
on public.pet_care_records for select to authenticated
using (public.is_household_member(household_id));
create policy pet_care_records_insert_household
on public.pet_care_records for insert to authenticated
with check (
  created_by = (select auth.uid())
  and public.is_household_member(household_id)
);
create policy pet_care_records_update_creator_or_admin
on public.pet_care_records for update to authenticated
using (
  created_by = (select auth.uid())
  or public.has_household_role(
    household_id,
    array['owner','admin']::public.household_role[]
  )
)
with check (
  created_by = (select auth.uid())
  or public.has_household_role(
    household_id,
    array['owner','admin']::public.household_role[]
  )
);
create policy pet_care_records_delete_creator_or_admin
on public.pet_care_records for delete to authenticated
using (
  created_by = (select auth.uid())
  or public.has_household_role(
    household_id,
    array['owner','admin']::public.household_role[]
  )
);
revoke all on public.pet_care_records from anon, authenticated;
grant select, insert, update, delete on public.pet_care_records to authenticated;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values (
  'pet-documents',
  'pet-documents',
  false,
  15728640,
  array['image/jpeg','image/png','image/webp','application/pdf']
)
on conflict(id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy pet_documents_read
on storage.objects for select to authenticated
using (
  bucket_id = 'pet-documents'
  and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}/[^/]+$'
  and public.is_household_member(((storage.foldername(name))[1])::uuid)
);
create policy pet_documents_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'pet-documents'
  and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}/[^/]+$'
  and public.is_household_member(((storage.foldername(name))[1])::uuid)
);
create policy pet_documents_update
on storage.objects for update to authenticated
using (
  bucket_id = 'pet-documents'
  and owner_id = (select auth.uid()::text)
)
with check (
  bucket_id = 'pet-documents'
  and owner_id = (select auth.uid()::text)
);
create policy pet_documents_delete
on storage.objects for delete to authenticated
using (
  bucket_id = 'pet-documents'
  and owner_id = (select auth.uid()::text)
);

comment on table public.pet_care_records is
  'Authoritative pet timeline for health, vaccine, medication, vet, weight, expense, and document records.';
