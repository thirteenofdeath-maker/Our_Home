-- Shopping-list purchases are household expenses regardless of whether the
-- funding wallet is shared or personally owned. Chore schedules can also be
-- permanently removed by household owners/admins after UI confirmation.

create or replace function public.create_shopping_item_expense(
  p_item_id uuid,
  p_wallet_id uuid,
  p_pocket_id uuid,
  p_category_id uuid,
  p_amount numeric,
  p_title text,
  p_note text,
  p_occurred_at timestamptz,
  p_tag_ids uuid[] default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.shopping_items%rowtype;
  v_wallet public.wallets%rowtype;
  v_card_account_id uuid;
  v_transaction_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be positive' using errcode = '22023';
  end if;

  select * into v_item
  from public.shopping_items
  where id = p_item_id and archived_at is null
  for update;
  if not found then
    raise exception 'Shopping item not found' using errcode = 'P0002';
  end if;
  if not public.has_household_role(
    v_item.household_id,
    array['owner','admin','member']::public.household_role[]
  ) then
    raise exception 'Shopping list changes require a household member role'
      using errcode = '42501';
  end if;
  if v_item.expense_transaction_id is not null then
    raise exception 'Shopping item already has an expense' using errcode = '23505';
  end if;

  select * into v_wallet from public.wallets where id = p_wallet_id;
  if not found or not public.is_wallet_authorized(p_wallet_id) then
    raise exception 'Wallet not found or not authorized' using errcode = '42501';
  end if;
  if v_wallet.is_archived then
    raise exception 'Wallet is archived' using errcode = '23514';
  end if;

  select id into v_card_account_id
  from public.credit_card_accounts
  where wallet_id = p_wallet_id and system_pocket_id = p_pocket_id;

  if v_wallet.scope = 'HOUSEHOLD' then
    if v_wallet.household_id is distinct from v_item.household_id then
      raise exception 'Shopping expenses must use a wallet from the same household'
        using errcode = '23514';
    end if;
    if v_card_account_id is not null then
      v_transaction_id := public.create_card_purchase(
        v_card_account_id, p_category_id, p_amount,
        coalesce(nullif(btrim(p_title), ''), v_item.name), p_note,
        coalesce(p_occurred_at, now()), p_tag_ids
      );
    else
      v_transaction_id := public.create_income_expense_transaction(
        'EXPENSE', p_wallet_id, p_pocket_id, p_category_id, p_amount,
        coalesce(nullif(btrim(p_title), ''), v_item.name), p_note,
        coalesce(p_occurred_at, now()), p_tag_ids
      );
    end if;
  elsif v_wallet.scope = 'PERSONAL' then
    if v_wallet.owner_user_id is distinct from auth.uid() then
      raise exception 'A personal wallet must belong to the payer'
        using errcode = '42501';
    end if;
    if v_card_account_id is not null then
      v_transaction_id := public.create_attributed_card_purchase(
        v_card_account_id, v_item.household_id, p_category_id, p_amount,
        coalesce(nullif(btrim(p_title), ''), v_item.name), p_note,
        coalesce(p_occurred_at, now())
      );
    else
      v_transaction_id := public.create_attributed_household_expense(
        v_item.household_id, p_category_id, p_wallet_id, p_pocket_id,
        p_amount, coalesce(nullif(btrim(p_title), ''), v_item.name), p_note,
        coalesce(p_occurred_at, now())
      );
    end if;
  else
    raise exception 'Unsupported wallet scope' using errcode = '23514';
  end if;

  update public.shopping_items
  set purchased_at = coalesce(purchased_at, now()),
      purchased_by = coalesce(purchased_by, auth.uid()),
      expense_transaction_id = v_transaction_id
  where id = p_item_id;

  return v_transaction_id;
end;
$$;

comment on function public.create_shopping_item_expense(
  uuid,uuid,uuid,uuid,numeric,text,text,timestamptz,uuid[]
) is
  'Creates a HOUSEHOLD-classified shopping expense atomically. Shared wallets write a HOUSEHOLD transaction; personally owned wallets/cards write a PERSONAL transaction attributed to the shopping item household so every current member sees it in household finance.';

create or replace function public.delete_chore_template(p_template_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_household_id uuid;
begin
  select household_id into v_household_id
  from public.chore_templates
  where id = p_template_id;

  if v_household_id is null then
    raise exception 'Chore template not found' using errcode = 'P0002';
  end if;
  if not public.has_household_role(
    v_household_id,
    array['owner','admin']::public.household_role[]
  ) then
    raise exception 'Only household owners and administrators may delete chore schedules'
      using errcode = '42501';
  end if;

  delete from public.chore_templates where id = p_template_id;
end;
$$;

revoke execute on function public.delete_chore_template(uuid) from public, anon;
grant execute on function public.delete_chore_template(uuid) to authenticated;

comment on function public.delete_chore_template(uuid) is
  'Permanently deletes a chore template and its cascaded assignees/occurrences; restricted to household owners/admins.';
