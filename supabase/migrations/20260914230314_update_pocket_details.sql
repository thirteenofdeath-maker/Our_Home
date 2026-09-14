create or replace function public.update_pocket_details(
  p_pocket_id uuid,
  p_wallet_id uuid,
  p_name text,
  p_pocket_type public.wallet_type,
  p_target_balance numeric
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pocket public.pockets%rowtype;
  v_wallet public.wallets%rowtype;
  v_card_account_id uuid;
  v_current numeric(14,2);
  v_delta numeric(14,2);
  v_transaction_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if btrim(coalesce(p_name, '')) = '' or char_length(btrim(p_name)) > 60 then
    raise exception 'Pocket name is required and must be at most 60 characters'
      using errcode = '22023';
  end if;
  if p_target_balance is null then
    raise exception 'Target balance is required' using errcode = '22023';
  end if;

  select * into v_pocket
  from public.pockets
  where id = p_pocket_id and wallet_id = p_wallet_id
  for update;
  if not found or not public.is_wallet_authorized(p_wallet_id) then
    raise exception 'Pocket not found or not authorized' using errcode = '42501';
  end if;

  select * into v_wallet from public.wallets where id = p_wallet_id;
  if v_wallet.is_archived or v_pocket.is_archived then
    raise exception 'Archived Wallet or Pocket cannot be edited'
      using errcode = '23514';
  end if;

  if (v_pocket.pocket_type = 'CREDIT_CARD') <> (p_pocket_type = 'CREDIT_CARD') then
    raise exception 'Convert credit-card Pockets through the dedicated card flow'
      using errcode = '23514';
  end if;

  update public.pockets
  set name = btrim(p_name), pocket_type = p_pocket_type
  where id = p_pocket_id and wallet_id = p_wallet_id;

  v_current := public.get_pocket_balance(p_pocket_id);
  if v_current = p_target_balance then
    return;
  end if;

  if v_pocket.pocket_type = 'CREDIT_CARD' then
    select id into v_card_account_id
    from public.credit_card_accounts
    where wallet_id = p_wallet_id and system_pocket_id = p_pocket_id;
    if v_card_account_id is null then
      raise exception 'Managed credit-card account not found' using errcode = '23514';
    end if;
    perform public.create_credit_card_balance_adjustment(
      v_card_account_id,
      p_target_balance,
      'แก้ไขยอดเงินจากหน้าจัดการ Pocket',
      now()
    );
    return;
  end if;

  v_delta := p_target_balance - v_current;
  insert into public.transactions (
    scope, owner_user_id, household_id, transaction_type, category_id,
    title, note, occurred_at, created_by
  ) values (
    v_wallet.scope, v_wallet.owner_user_id, v_wallet.household_id,
    'OPENING_BALANCE', null, 'ปรับยอดเงิน Pocket',
    'แก้ไขยอดเงินจากหน้าจัดการ Pocket', now(), auth.uid()
  ) returning id into v_transaction_id;

  insert into public.transaction_entries (
    transaction_id, wallet_id, pocket_id, amount
  ) values (
    v_transaction_id, p_wallet_id, p_pocket_id, v_delta
  );
end;
$$;

revoke execute on function public.update_pocket_details(
  uuid, uuid, text, public.wallet_type, numeric
) from public, anon;
grant execute on function public.update_pocket_details(
  uuid, uuid, text, public.wallet_type, numeric
) to authenticated;
