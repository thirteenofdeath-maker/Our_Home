-- Household inventory, low-stock tracking, expiry/warranty dates, and private
-- supporting documents. Observers can read but every mutation requires a
-- full household role.
create table public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 120),
  category text not null default 'OTHER' check (
    category in ('MEDICINE','PET_SUPPLY','HOUSEHOLD','FOOD','WARRANTY','OTHER')
  ),
  note text check (note is null or length(note) <= 1000),
  quantity numeric(12,3) not null default 1 check (quantity >= 0),
  unit text check (unit is null or length(btrim(unit)) between 1 and 40),
  restock_threshold numeric(12,3) check (restock_threshold is null or restock_threshold >= 0),
  expiry_date date,
  warranty_expires_on date,
  purchase_date date,
  location text check (location is null or length(btrim(location)) between 1 and 120),
  estimated_restock_amount numeric(18,2) check (
    estimated_restock_amount is null or estimated_restock_amount > 0
  ),
  currency text not null default 'THB' check (currency ~ '^[A-Z]{3}$'),
  shopping_item_id uuid references public.shopping_items(id) on delete set null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(id, household_id)
);

create index inventory_items_household_active_idx
  on public.inventory_items(household_id, archived_at, category, name);
create index inventory_items_expiry_idx
  on public.inventory_items(household_id, expiry_date)
  where archived_at is null and expiry_date is not null;
create index inventory_items_warranty_idx
  on public.inventory_items(household_id, warranty_expires_on)
  where archived_at is null and warranty_expires_on is not null;
create index inventory_items_creator_idx on public.inventory_items(created_by);
create index inventory_items_shopping_idx on public.inventory_items(shopping_item_id)
  where shopping_item_id is not null;

create trigger inventory_items_set_updated_at
  before update on public.inventory_items
  for each row execute function public.set_updated_at();

alter table public.inventory_items enable row level security;
create policy inventory_items_select_household
  on public.inventory_items for select to authenticated
  using (public.is_household_member(household_id));
revoke all privileges on table public.inventory_items from public, anon, authenticated;
grant select on table public.inventory_items to authenticated;

create table public.inventory_documents (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.inventory_items(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  document_type text not null default 'OTHER' check (
    document_type in ('RECEIPT','MANUAL','WARRANTY','OTHER')
  ),
  title text not null check (length(btrim(title)) between 1 and 160),
  storage_path text not null unique,
  mime_type text not null check (
    mime_type in ('image/jpeg','image/png','image/webp','application/pdf')
  ),
  file_size bigint not null check (file_size between 1 and 6291456),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  foreign key (item_id, household_id)
    references public.inventory_items(id, household_id) on delete cascade
);

create index inventory_documents_item_idx on public.inventory_documents(item_id, created_at);
create index inventory_documents_creator_idx on public.inventory_documents(created_by);

alter table public.inventory_documents enable row level security;
create policy inventory_documents_select_household
  on public.inventory_documents for select to authenticated
  using (public.is_household_member(household_id));
create policy inventory_documents_insert_member
  on public.inventory_documents for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and public.has_household_role(
      household_id,
      array['owner','admin','member']::public.household_role[]
    )
    and storage_path ~ ('^' || household_id::text || '/' || item_id::text || '/[0-9a-f-]{36}/[^/]+$')
    and exists (
      select 1 from public.inventory_items i
      where i.id = item_id and i.household_id = household_id and i.archived_at is null
    )
  );
create policy inventory_documents_delete_creator_or_admin
  on public.inventory_documents for delete to authenticated
  using (
    created_by = (select auth.uid())
    or public.has_household_role(
      household_id,
      array['owner','admin']::public.household_role[]
    )
  );
revoke all privileges on table public.inventory_documents from public, anon, authenticated;
grant select, insert, delete on table public.inventory_documents to authenticated;

create function public.create_inventory_item(
  p_household_id uuid,
  p_name text,
  p_category text,
  p_note text,
  p_quantity numeric,
  p_unit text,
  p_restock_threshold numeric,
  p_expiry_date date,
  p_warranty_expires_on date,
  p_purchase_date date,
  p_location text,
  p_estimated_restock_amount numeric,
  p_currency text
)
returns public.inventory_items
language plpgsql
security definer
set search_path = ''
as $$
declare v_item public.inventory_items;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if not public.has_household_role(
    p_household_id,
    array['owner','admin','member']::public.household_role[]
  ) then
    raise exception 'Inventory changes require a household member role' using errcode = '42501';
  end if;

  insert into public.inventory_items (
    household_id, name, category, note, quantity, unit, restock_threshold,
    expiry_date, warranty_expires_on, purchase_date, location,
    estimated_restock_amount, currency, created_by
  ) values (
    p_household_id, btrim(p_name), upper(p_category), nullif(btrim(p_note), ''),
    p_quantity, nullif(btrim(p_unit), ''), p_restock_threshold,
    p_expiry_date, p_warranty_expires_on, p_purchase_date,
    nullif(btrim(p_location), ''), p_estimated_restock_amount,
    upper(p_currency), auth.uid()
  ) returning * into v_item;
  return v_item;
end;
$$;

create function public.set_inventory_quantity(p_item_id uuid, p_quantity numeric)
returns public.inventory_items
language plpgsql
security definer
set search_path = ''
as $$
declare v_item public.inventory_items;
begin
  select * into v_item from public.inventory_items
  where id = p_item_id and archived_at is null for update;
  if not found then raise exception 'Inventory item not found' using errcode = 'P0002'; end if;
  if not public.has_household_role(
    v_item.household_id,
    array['owner','admin','member']::public.household_role[]
  ) then
    raise exception 'Inventory changes require a household member role' using errcode = '42501';
  end if;
  if p_quantity < 0 then raise exception 'Quantity cannot be negative' using errcode = '22023'; end if;
  update public.inventory_items set quantity = p_quantity where id = p_item_id returning * into v_item;
  return v_item;
end;
$$;

create function public.set_inventory_item_archived(p_item_id uuid, p_archived boolean)
returns public.inventory_items
language plpgsql
security definer
set search_path = ''
as $$
declare v_item public.inventory_items;
begin
  select * into v_item from public.inventory_items where id = p_item_id for update;
  if not found then raise exception 'Inventory item not found' using errcode = 'P0002'; end if;
  if not public.has_household_role(
    v_item.household_id,
    array['owner','admin','member']::public.household_role[]
  ) then
    raise exception 'Inventory changes require a household member role' using errcode = '42501';
  end if;
  update public.inventory_items
    set archived_at = case when p_archived then coalesce(archived_at, now()) else null end
    where id = p_item_id returning * into v_item;
  return v_item;
end;
$$;

create function public.send_inventory_item_to_shopping(p_item_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.inventory_items;
  v_existing public.shopping_items;
  v_shopping public.shopping_items;
  v_needed numeric;
begin
  select * into v_item from public.inventory_items
  where id = p_item_id and archived_at is null for update;
  if not found then raise exception 'Inventory item not found' using errcode = 'P0002'; end if;
  if not public.has_household_role(
    v_item.household_id,
    array['owner','admin','member']::public.household_role[]
  ) then
    raise exception 'Inventory changes require a household member role' using errcode = '42501';
  end if;

  if v_item.shopping_item_id is not null then
    select * into v_existing from public.shopping_items
    where id = v_item.shopping_item_id and archived_at is null and purchased_at is null;
    if found then return v_existing.id; end if;
  end if;

  v_needed := greatest(coalesce(v_item.restock_threshold, v_item.quantity + 1) - v_item.quantity, 1);
  v_shopping := public.create_shopping_item(
    v_item.household_id, v_item.name, 'เติมจากคลังของในบ้าน', null,
    v_needed, v_item.unit, v_item.estimated_restock_amount, v_item.currency, null
  );
  update public.inventory_items set shopping_item_id = v_shopping.id where id = v_item.id;
  return v_shopping.id;
end;
$$;

revoke execute on function public.create_inventory_item(
  uuid,text,text,text,numeric,text,numeric,date,date,date,text,numeric,text
) from public, anon;
revoke execute on function public.set_inventory_quantity(uuid,numeric) from public, anon;
revoke execute on function public.set_inventory_item_archived(uuid,boolean) from public, anon;
revoke execute on function public.send_inventory_item_to_shopping(uuid) from public, anon;
grant execute on function public.create_inventory_item(
  uuid,text,text,text,numeric,text,numeric,date,date,date,text,numeric,text
) to authenticated;
grant execute on function public.set_inventory_quantity(uuid,numeric) to authenticated;
grant execute on function public.set_inventory_item_archived(uuid,boolean) to authenticated;
grant execute on function public.send_inventory_item_to_shopping(uuid) to authenticated;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values (
  'inventory-documents', 'inventory-documents', false, 6291456,
  array['image/jpeg','image/png','image/webp','application/pdf']
)
on conflict(id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy inventory_assets_read
  on storage.objects for select to authenticated
  using (
    bucket_id = 'inventory-documents'
    and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}/[^/]+$'
    and public.is_household_member(((storage.foldername(name))[1])::uuid)
  );
create policy inventory_assets_insert
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'inventory-documents'
    and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}/[^/]+$'
    and public.has_household_role(
      ((storage.foldername(name))[1])::uuid,
      array['owner','admin','member']::public.household_role[]
    )
  );
create policy inventory_assets_delete
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'inventory-documents'
    and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}/[^/]+$'
    and (
      owner_id = (select auth.uid()::text)
      or public.has_household_role(
        ((storage.foldername(name))[1])::uuid,
        array['owner','admin']::public.household_role[]
      )
    )
  );

comment on table public.inventory_items is
  'Household stock, expiry, warranty, and restock source of truth.';
comment on table public.inventory_documents is
  'Private receipts, manuals, warranties, and other inventory documents.';
