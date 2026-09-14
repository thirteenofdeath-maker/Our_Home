-- Cash advance moves money from a managed card to an authorized non-card
-- wallet. It creates principal liability but never creates income/expense.

create function public.create_credit_card_cash_advance(
  p_card_account_id uuid,
  p_to_wallet_id uuid,
  p_to_pocket_id uuid,
  p_amount numeric,
  p_title text default null,
  p_note text default null,
  p_occurred_at timestamptz default now()
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_card public.credit_card_accounts%rowtype;
  v_card_wallet public.wallets%rowtype;
  v_destination_wallet public.wallets%rowtype;
  v_available_credit numeric(14, 2);
  v_transaction_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Cash-advance amount must be positive' using errcode = '22023';
  end if;

  select * into v_card
  from public.credit_card_accounts
  where id = p_card_account_id
  for update;
  if not found or not public.is_wallet_authorized(v_card.wallet_id) then
    raise exception 'Credit card not found or not authorized' using errcode = '42501';
  end if;

  select * into v_card_wallet from public.wallets where id = v_card.wallet_id;
  if v_card_wallet.is_archived then
    raise exception 'Credit card is archived' using errcode = '23514';
  end if;

  if not public.is_wallet_authorized(p_to_wallet_id) then
    raise exception 'Destination wallet not found or not authorized' using errcode = '42501';
  end if;
  select * into v_destination_wallet from public.wallets where id = p_to_wallet_id;
  if v_destination_wallet.wallet_type = 'CREDIT_CARD' then
    raise exception 'Cash advance must go to a non-card wallet' using errcode = '23514';
  end if;

  v_available_credit := v_card.credit_limit + public.get_wallet_balance(v_card.wallet_id);
  if p_amount > v_available_credit then
    raise exception 'Cash advance exceeds available credit' using errcode = '23514';
  end if;

  perform set_config('app.creating_classified_card_entry', 'true', true);
  v_transaction_id := public.create_wallet_transfer(
    v_card.wallet_id, v_card.system_pocket_id, p_to_wallet_id, p_to_pocket_id,
    p_amount, coalesce(nullif(trim(p_title), ''), 'กดเงินสดจากบัตรเครดิต'),
    nullif(trim(p_note), ''), coalesce(p_occurred_at, now()),
    null, null, null, null, null
  );

  insert into public.credit_card_liability_events (
    card_account_id, event_kind, amount, transaction_id, created_by
  ) values (
    p_card_account_id, 'CASH_ADVANCE', p_amount, v_transaction_id, auth.uid()
  );

  return v_transaction_id;
end;
$$;

comment on function public.create_credit_card_cash_advance(uuid,uuid,uuid,numeric,text,text,timestamptz) is
  'SECURITY DEFINER: creates one net-worth-neutral wallet TRANSFER from the card to an authorized same-scope, same-currency non-card wallet plus one matching CASH_ADVANCE principal event. Available credit is derived and locked server-side.';

revoke execute on function public.create_credit_card_cash_advance(uuid,uuid,uuid,numeric,text,text,timestamptz) from public, anon;
grant execute on function public.create_credit_card_cash_advance(uuid,uuid,uuid,numeric,text,text,timestamptz) to authenticated;
