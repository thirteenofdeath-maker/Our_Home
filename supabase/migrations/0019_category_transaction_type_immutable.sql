-- 0019_category_transaction_type_immutable.sql
-- Second Milestone 1 hardening pass, item 1.
--
-- categories.transaction_type was previously left mutable (0014 only froze
-- scope/owner_user_id/household_id/created_by/is_system). That was a real
-- gap: historical transactions reference a category by id, and their
-- classification (INCOME vs EXPENSE) implicitly depends on the category's
-- transaction_type at the time they were created. Letting an EXPENSE
-- category silently become INCOME later would make every historical
-- transaction that used it internally inconsistent — and if the category
-- is a root with children, it would also desync from its children (the
-- hierarchy trigger enforces "child matches parent" at write time, but
-- retroactively changing the parent does not walk back down and revalidate
-- every child).
--
-- Fix: add 'transaction_type' to the same generic immutability trigger
-- used for the other identity columns (0014's
-- prevent_immutable_column_changes). A trigger cannot have its argument
-- list "amended" — it is dropped and recreated with the fuller list here,
-- which is a schema-only operation (the trigger's underlying table rows
-- are untouched) and does not conflict with "don't rewrite committed
-- migrations": migration 0014 still stands as written; this migration
-- supersedes what the trigger *does* going forward, the same way 0018
-- superseded categories_validate_hierarchy's body via CREATE OR REPLACE.

drop trigger if exists categories_prevent_identity_changes on public.categories;

create trigger categories_prevent_identity_changes
  before update on public.categories
  for each row execute function public.prevent_immutable_column_changes(
    'scope', 'owner_user_id', 'household_id', 'created_by', 'is_system', 'transaction_type'
  );
