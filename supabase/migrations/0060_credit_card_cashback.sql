-- Cashback is a classified card credit, never income or negative principal.
-- The card-wallet ledger remains the only authoritative total balance.

drop function public.get_credit_card_outstanding_components(uuid);

create function public.get_credit_card_outstanding_components(p_card_account_id uuid)
returns table(
  principal numeric,
  interest numeric,
  fee numeric,
  late_fee numeric,
  unallocated_credit numeric,
  total numeric
)
language plpgsql
security definer
stable
set search_path = ''
as $$
declare v_wallet_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  select wallet_id into v_wallet_id
  from public.credit_card_accounts
  where id = p_card_account_id;
  if not found or not public.is_wallet_authorized(v_wallet_id) then
    raise exception 'Credit card not found or not authorized' using errcode = '42501';
  end if;

  return query
    with active as (
      select e.event_kind, e.amount
      from public.credit_card_liability_events e
      join public.transactions t on t.id = e.transaction_id
      where e.card_account_id = p_card_account_id
        and t.deleted_at is null
    ), base as (
      select
        greatest(0, coalesce(sum(amount) filter (
          where event_kind in ('PURCHASE', 'CASH_ADVANCE', 'PURCHASE_REFUND', 'PAYMENT_PRINCIPAL')
        ), 0)) as principal,
        greatest(0, coalesce(sum(amount) filter (
          where event_kind in ('INTEREST_CHARGE', 'PAYMENT_INTEREST')
        ), 0)) as interest,
        greatest(0, coalesce(sum(amount) filter (
          where event_kind in ('FEE_CHARGE', 'PAYMENT_FEE')
        ), 0)) as fee,
        greatest(0, coalesce(sum(amount) filter (
          where event_kind in ('LATE_FEE_CHARGE', 'PAYMENT_LATE_FEE')
        ), 0)) as late_fee,
        greatest(0, -coalesce(sum(amount) filter (where event_kind = 'CASHBACK'), 0)) as cashback
      from active
    ), net as (
      select
        greatest(0, b.principal - greatest(0, b.cashback - b.late_fee - b.fee - b.interest)) as principal,
        greatest(0, b.interest - greatest(0, b.cashback - b.late_fee - b.fee)) as interest,
        greatest(0, b.fee - greatest(0, b.cashback - b.late_fee)) as fee,
        greatest(0, b.late_fee - b.cashback) as late_fee,
        greatest(0, b.cashback - b.late_fee - b.fee - b.interest - b.principal) as unallocated_credit
      from base b
    )
    select n.principal, n.interest, n.fee, n.late_fee, n.unallocated_credit,
      n.principal + n.interest + n.fee + n.late_fee
    from net n;
end;
$$;

comment on function public.get_credit_card_outstanding_components(uuid) is
  'Authorized current component view. Active cashback reduces late fee, fee, interest, then principal; excess remains derived unallocated card credit. No component or balance is cached.';

revoke execute on function public.get_credit_card_outstanding_components(uuid) from public, anon;
grant execute on function public.get_credit_card_outstanding_components(uuid) to authenticated;

create function public.create_credit_card_cashback(
  p_card_account_id uuid,
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
  v_wallet public.wallets%rowtype;
  v_transaction_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Cashback amount must be positive' using errcode = '22023';
  end if;

  select * into v_card
  from public.credit_card_accounts
  where id = p_card_account_id
  for update;
  if not found or not public.is_wallet_authorized(v_card.wallet_id) then
    raise exception 'Credit card not found or not authorized' using errcode = '42501';
  end if;

  select * into v_wallet
  from public.wallets
  where id = v_card.wallet_id;
  if v_wallet.is_archived then
    raise exception 'Credit card is archived' using errcode = '23514';
  end if;

  insert into public.transactions (
    scope, owner_user_id, household_id, transaction_type, category_id,
    title, note, occurred_at, created_by
  ) values (
    v_wallet.scope, v_wallet.owner_user_id, v_wallet.household_id,
    'CARD_ADJUSTMENT', null, coalesce(nullif(trim(p_title), ''), 'Cashback บัตรเครดิต'),
    nullif(trim(p_note), ''), coalesce(p_occurred_at, now()), auth.uid()
  ) returning id into v_transaction_id;

  perform set_config('app.creating_classified_card_entry', 'true', true);
  insert into public.transaction_entries (transaction_id, wallet_id, pocket_id, amount)
  values (v_transaction_id, v_card.wallet_id, v_card.system_pocket_id, p_amount);

  insert into public.credit_card_liability_events (
    card_account_id, event_kind, amount, transaction_id, created_by
  ) values (
    p_card_account_id, 'CASHBACK', -p_amount, v_transaction_id, auth.uid()
  );

  return v_transaction_id;
end;
$$;

comment on function public.create_credit_card_cashback(uuid,numeric,text,text,timestamptz) is
  'SECURITY DEFINER: atomically records issuer cashback as one positive CARD_ADJUSTMENT wallet posting and one matching negative CASHBACK event. It is not income. Amount beyond active liability becomes wallet-backed card credit.';

revoke execute on function public.create_credit_card_cashback(uuid,numeric,text,text,timestamptz) from public, anon;
grant execute on function public.create_credit_card_cashback(uuid,numeric,text,text,timestamptz) to authenticated;
