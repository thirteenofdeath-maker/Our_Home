-- Home dashboard reads the three latest active care records for a household.
-- Keep that bounded read index-only for ordering instead of sorting all history.
create index pet_care_records_household_recent_idx
  on public.pet_care_records(household_id, created_at desc)
  where archived_at is null;
