create or replace function private.save_household_expense(
  p_id uuid, p_household_id uuid, p_title text, p_category text,
  p_amount numeric, p_paid_on date, p_payer_id uuid, p_item_ids uuid[], p_edit boolean
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_item public.shopping_items;
  v_count integer := 0;
begin
  if auth.uid() is null or not public.has_household_role(
    p_household_id, array['owner','admin','member']::public.household_role[]
  ) then
    raise exception 'Household write access required' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.household_members
    where household_id = p_household_id and user_id = p_payer_id and role <> 'observer'
  ) and not (p_edit and exists (
    select 1 from public.household_expenses
    where id = p_id and household_id = p_household_id and payer_id = p_payer_id
  )) then
    raise exception 'Payer must be a member of this household' using errcode = '22023';
  end if;

  if p_edit then
    update public.household_expenses
    set title = btrim(p_title), category = p_category, amount = p_amount,
        paid_on = p_paid_on, payer_id = p_payer_id
    where id = p_id and household_id = p_household_id;
    if not found then
      raise exception 'Expense not found' using errcode = 'P0002';
    end if;
    return;
  end if;

  if coalesce(cardinality(p_item_ids), 0) > 100 then
    raise exception 'Too many shopping items' using errcode = '22023';
  end if;

  insert into public.household_expenses (id, household_id, title, category, amount, paid_on, payer_id)
  values (p_id, p_household_id, btrim(p_title), p_category, p_amount, p_paid_on, p_payer_id)
  on conflict (id) do nothing;

  if not found then
    if exists (
      select 1 from public.household_expenses
      where id=p_id and household_id=p_household_id and created_by=auth.uid()
        and title=btrim(p_title) and category=p_category and amount=p_amount
        and paid_on=p_paid_on and payer_id=p_payer_id
    ) and
      array(select id from public.shopping_items where household_expense_id=p_id order by id)
      = array(select unnest(coalesce(p_item_ids, array[]::uuid[])) order by 1)
    then
      return;
    end if;
    if exists (
      select 1 from public.household_expenses
      where id=p_id and household_id=p_household_id and created_by=auth.uid()
    ) then
      raise exception 'The saved expense has different data' using errcode='P0001';
    end if;
    raise exception 'Expense identifier already used' using errcode='23505';
  end if;

  for v_item in
    select * from public.shopping_items
    where id = any(p_item_ids) and household_id = p_household_id and archived_at is null
    order by id for update
  loop
    if v_item.household_expense_id is not null then
      raise exception 'Shopping item already has an expense' using errcode = '23505';
    end if;
    v_count := v_count + 1;
  end loop;

  if v_count <> coalesce(cardinality(p_item_ids), 0) then
    raise exception 'Shopping item not found' using errcode = 'P0002';
  end if;

  update public.shopping_items
  set household_expense_id = p_id,
      expense_transaction_id = null,
      purchased_at = coalesce(purchased_at, now()),
      purchased_by = coalesce(purchased_by, auth.uid())
  where id = any(p_item_ids) and household_id = p_household_id;
end;
$$;

-- Keep legacy photo paths readable while accepting immutable upload versions.
do $migration$
declare
  item record;
  definition text;
begin
  for item in
    select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in ('update_profile_details','create_pet','update_pet')
  loop
    definition := pg_get_functiondef(item.oid);
    definition := replace(definition, $old$/avatar\.$old$, $new$/avatar(-[0-9a-f-]{36})?\.$new$);
    definition := replace(definition, $old$/profile\.$old$, $new$/profile(-[0-9a-f-]{36})?\.$new$);
    execute definition;
  end loop;
  for item in select polname, pg_get_expr(polqual,polrelid) as qual,
    pg_get_expr(polwithcheck,polrelid) as checks
    from pg_policy where polrelid='storage.objects'::regclass
      and polname in ('pet_photos_read','pet_photos_insert','pet_photos_update','pet_photos_delete')
  loop
    definition := format('alter policy %I on storage.objects', item.polname);
    if item.qual is not null then
      definition := definition || ' using (' || replace(item.qual,$old$/profile\.$old$,$new$/profile(-[0-9a-f-]{36})?\.$new$) || ')';
    end if;
    if item.checks is not null then
      definition := definition || ' with check (' || replace(item.checks,$old$/profile\.$old$,$new$/profile(-[0-9a-f-]{36})?\.$new$) || ')';
    end if;
    execute definition;
  end loop;
end;
$migration$;
