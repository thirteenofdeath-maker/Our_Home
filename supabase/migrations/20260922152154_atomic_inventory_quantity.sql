create function public.adjust_inventory_quantity(p_item_id uuid, p_delta numeric)
returns public.inventory_items
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.inventory_items;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_delta is null or p_delta not in (-1, 1) then
    raise exception 'Quantity delta must be -1 or 1' using errcode = '22023';
  end if;

  select * into v_item
  from public.inventory_items
  where id = p_item_id and archived_at is null
  for update;
  if not found then
    raise exception 'Inventory item not found' using errcode = 'P0002';
  end if;
  if not public.has_household_role(
    v_item.household_id,
    array['owner','admin','member']::public.household_role[]
  ) then
    raise exception 'Inventory changes require a household member role' using errcode = '42501';
  end if;

  update public.inventory_items
  set quantity = greatest(quantity + p_delta, 0)
  where id = p_item_id
  returning * into v_item;
  return v_item;
end;
$$;

revoke execute on function public.adjust_inventory_quantity(uuid,numeric) from public, anon;
grant execute on function public.adjust_inventory_quantity(uuid,numeric) to authenticated;
