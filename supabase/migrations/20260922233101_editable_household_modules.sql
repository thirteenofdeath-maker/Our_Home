-- Editable household modules. Every exposed SECURITY DEFINER function checks
-- authentication and the household role before mutating a locked row.

-- Respect an edited future start date while retaining completed history.
create or replace function public.materialize_chore_occurrences(
  p_household_id uuid,
  p_through_date date default (current_date + 14)
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_template public.chore_templates%rowtype;
  v_date date;
  v_last_date date;
  v_existing_count integer;
  v_assignee_id uuid;
  v_inserted integer := 0;
begin
  if not public.has_household_role(
    p_household_id,
    array['owner','admin','member']::public.household_role[]
  ) then
    raise exception 'Chore changes require a household member role' using errcode = '42501';
  end if;
  if p_through_date > current_date + 62 then
    raise exception 'Chores may only be generated 62 days ahead' using errcode = '22023';
  end if;

  for v_template in
    select * from public.chore_templates
    where household_id = p_household_id and is_active
    order by created_at, id
  loop
    select max(due_date), count(*)
    into v_last_date, v_existing_count
    from public.chore_occurrences
    where template_id = v_template.id;

    v_date := greatest(
      v_template.starts_on,
      case
        when v_last_date is null then v_template.starts_on
        when v_template.cadence = 'DAILY' then v_last_date + 1
        else v_last_date + 7
      end
    );

    while v_date <= p_through_date loop
      select member_id into v_assignee_id
      from public.chore_template_assignees
      where template_id = v_template.id
      order by position
      offset (v_existing_count % greatest((
        select count(*) from public.chore_template_assignees
        where template_id = v_template.id
      ), 1))
      limit 1;

      if v_assignee_id is not null then
        insert into public.chore_occurrences (
          template_id, household_id, due_date,
          assigned_member_id, original_assigned_member_id
        ) values (
          v_template.id, p_household_id, v_date,
          v_assignee_id, v_assignee_id
        ) on conflict (template_id, due_date) do nothing;
        if found then
          v_inserted := v_inserted + 1;
          v_existing_count := v_existing_count + 1;
        end if;
      end if;

      v_date := case
        when v_template.cadence = 'DAILY' then v_date + 1
        else v_date + 7
      end;
    end loop;
  end loop;
  return v_inserted;
end;
$$;

create function public.update_shopping_item(
  p_item_id uuid,
  p_name text,
  p_note text,
  p_store text,
  p_quantity numeric,
  p_unit text,
  p_estimated_amount numeric,
  p_currency text,
  p_assigned_member_id uuid
)
returns public.shopping_items
language plpgsql
security definer
set search_path = ''
as $$
declare v_item public.shopping_items;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  select * into v_item from public.shopping_items
  where id = p_item_id and archived_at is null for update;
  if not found then raise exception 'Shopping item not found' using errcode = 'P0002'; end if;
  if not public.has_household_role(
    v_item.household_id,
    array['owner','admin','member']::public.household_role[]
  ) then
    raise exception 'Shopping list changes require a household member role' using errcode = '42501';
  end if;
  if p_assigned_member_id is not null and not exists (
    select 1 from public.household_members hm
    where hm.id = p_assigned_member_id
      and hm.household_id = v_item.household_id
      and hm.role <> 'observer'
  ) then
    raise exception 'Assignee must be an editable household member' using errcode = '22023';
  end if;

  update public.shopping_items set
    name = btrim(p_name),
    note = nullif(btrim(p_note), ''),
    store = nullif(btrim(p_store), ''),
    quantity = p_quantity,
    unit = nullif(btrim(p_unit), ''),
    estimated_amount = p_estimated_amount,
    currency = upper(p_currency),
    assigned_member_id = p_assigned_member_id
  where id = p_item_id
  returning * into v_item;
  return v_item;
end;
$$;

create function public.update_inventory_item(
  p_item_id uuid,
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
  select * into v_item from public.inventory_items
  where id = p_item_id and archived_at is null for update;
  if not found then raise exception 'Inventory item not found' using errcode = 'P0002'; end if;
  if not public.has_household_role(
    v_item.household_id,
    array['owner','admin','member']::public.household_role[]
  ) then
    raise exception 'Inventory changes require a household member role' using errcode = '42501';
  end if;

  update public.inventory_items set
    name = btrim(p_name),
    category = upper(p_category),
    note = nullif(btrim(p_note), ''),
    quantity = p_quantity,
    unit = nullif(btrim(p_unit), ''),
    restock_threshold = p_restock_threshold,
    expiry_date = p_expiry_date,
    warranty_expires_on = p_warranty_expires_on,
    purchase_date = p_purchase_date,
    location = nullif(btrim(p_location), ''),
    estimated_restock_amount = p_estimated_restock_amount,
    currency = upper(p_currency)
  where id = p_item_id
  returning * into v_item;
  return v_item;
end;
$$;

create function public.update_chore_template(
  p_template_id uuid,
  p_title text,
  p_details text,
  p_cadence text,
  p_starts_on date,
  p_due_time time,
  p_member_ids uuid[]
)
returns public.chore_templates
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_template public.chore_templates;
  v_member_id uuid;
  v_position integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  select * into v_template from public.chore_templates
  where id = p_template_id for update;
  if not found then raise exception 'Chore template not found' using errcode = 'P0002'; end if;
  if not public.has_household_role(
    v_template.household_id,
    array['owner','admin']::public.household_role[]
  ) then
    raise exception 'Only household owners and administrators may edit chores' using errcode = '42501';
  end if;
  if p_member_ids is null or cardinality(p_member_ids) = 0 then
    raise exception 'Choose at least one chore assignee' using errcode = '22023';
  end if;

  foreach v_member_id in array p_member_ids loop
    if not exists (
      select 1 from public.household_members
      where id = v_member_id
        and household_id = v_template.household_id
        and role <> 'observer'
    ) then
      raise exception 'Every assignee must be an editable household member' using errcode = '22023';
    end if;
  end loop;

  update public.chore_templates set
    title = btrim(p_title),
    details = nullif(btrim(p_details), ''),
    cadence = p_cadence,
    starts_on = greatest(p_starts_on, current_date),
    due_time = p_due_time
  where id = p_template_id
  returning * into v_template;

  -- Preserve completed history; only the not-yet-completed schedule is rebuilt.
  delete from public.chore_occurrences
  where template_id = p_template_id and completed_at is null;
  delete from public.chore_template_assignees where template_id = p_template_id;
  foreach v_member_id in array p_member_ids loop
    insert into public.chore_template_assignees (
      template_id, household_id, member_id, position
    ) values (p_template_id, v_template.household_id, v_member_id, v_position);
    v_position := v_position + 1;
  end loop;
  perform public.materialize_chore_occurrences(v_template.household_id, current_date + 14);
  return v_template;
end;
$$;

alter table public.pet_care_records
  add column updated_by uuid references public.profiles(id) on delete restrict;

create or replace function public.protect_pet_care_record_identity()
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
  new.updated_by := auth.uid();
  return new;
end;
$$;

drop policy pet_care_records_update_creator_or_admin on public.pet_care_records;
create policy pet_care_records_update_creator_or_admin
on public.pet_care_records for update to authenticated
using (
  public.has_household_role(
    household_id,
    array['owner','admin']::public.household_role[]
  )
  or (
    created_by = (select auth.uid())
    and public.has_household_role(
      household_id,
      array['member']::public.household_role[]
    )
  )
)
with check (
  public.has_household_role(
    household_id,
    array['owner','admin']::public.household_role[]
  )
  or (
    created_by = (select auth.uid())
    and public.has_household_role(
      household_id,
      array['member']::public.household_role[]
    )
  )
);

create function public.update_pet_care_record(
  p_record_id uuid,
  p_record_type text,
  p_title text,
  p_note text,
  p_recorded_at timestamptz,
  p_scheduled_at timestamptz,
  p_value numeric,
  p_unit text,
  p_provider text,
  p_transaction_id uuid
)
returns public.pet_care_records
language plpgsql
security definer
set search_path = ''
as $$
declare v_record public.pet_care_records;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  select * into v_record from public.pet_care_records
  where id = p_record_id and archived_at is null for update;
  if not found then raise exception 'Pet care record not found' using errcode = 'P0002'; end if;
  if not (
    public.has_household_role(
      v_record.household_id,
      array['owner','admin']::public.household_role[]
    )
    or (
      v_record.created_by = auth.uid()
      and public.has_household_role(
        v_record.household_id,
        array['member']::public.household_role[]
      )
    )
  ) then
    raise exception 'Pet care record edit is not allowed' using errcode = '42501';
  end if;
  if p_record_type = 'EXPENSE' and (
    p_transaction_id is null or not exists (
      select 1 from public.transactions t
      where t.id = p_transaction_id
        and t.transaction_type = 'EXPENSE'
        and t.deleted_at is null
        and (
          (t.scope = 'PERSONAL' and t.owner_user_id = auth.uid())
          or (t.scope = 'HOUSEHOLD' and t.household_id = v_record.household_id)
        )
    )
  ) then
    raise exception 'Expense transaction is unavailable' using errcode = '22023';
  end if;

  update public.pet_care_records set
    record_type = p_record_type,
    title = btrim(p_title),
    note = nullif(btrim(p_note), ''),
    recorded_at = p_recorded_at,
    scheduled_at = p_scheduled_at,
    value = case when p_record_type = 'WEIGHT' then p_value else null end,
    unit = case when p_record_type = 'WEIGHT' then nullif(btrim(p_unit), '') else null end,
    provider = nullif(btrim(p_provider), ''),
    transaction_id = case when p_record_type = 'EXPENSE' then p_transaction_id else null end,
    updated_by = auth.uid()
  where id = p_record_id
  returning * into v_record;
  return v_record;
end;
$$;

revoke execute on function public.update_shopping_item(
  uuid,text,text,text,numeric,text,numeric,text,uuid
) from public, anon;
revoke execute on function public.update_inventory_item(
  uuid,text,text,text,numeric,text,numeric,date,date,date,text,numeric,text
) from public, anon;
revoke execute on function public.update_chore_template(
  uuid,text,text,text,date,time,uuid[]
) from public, anon;
revoke execute on function public.update_pet_care_record(
  uuid,text,text,text,timestamptz,timestamptz,numeric,text,text,uuid
) from public, anon;

grant execute on function public.update_shopping_item(
  uuid,text,text,text,numeric,text,numeric,text,uuid
) to authenticated;
grant execute on function public.update_inventory_item(
  uuid,text,text,text,numeric,text,numeric,date,date,date,text,numeric,text
) to authenticated;
grant execute on function public.update_chore_template(
  uuid,text,text,text,date,time,uuid[]
) to authenticated;
grant execute on function public.update_pet_care_record(
  uuid,text,text,text,timestamptz,timestamptz,numeric,text,text,uuid
) to authenticated;
