drop index if exists public.shopping_items_assignee_idx;

create index shopping_items_assignee_household_fk_idx
  on public.shopping_items(assigned_member_id, household_id);

create index shopping_items_created_by_idx
  on public.shopping_items(created_by);

create index shopping_items_purchased_by_idx
  on public.shopping_items(purchased_by)
  where purchased_by is not null;
