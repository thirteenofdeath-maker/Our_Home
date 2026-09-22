-- Cover every inventory foreign-key access path reported by the database
-- advisor. The composite index also covers item_id-only lookups.
drop index if exists public.inventory_documents_item_idx;
create index inventory_documents_item_household_fk_idx
  on public.inventory_documents(item_id, household_id, created_at);
create index inventory_documents_household_idx
  on public.inventory_documents(household_id);
