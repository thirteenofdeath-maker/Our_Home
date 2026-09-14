-- Reconcile a card to an issuer-reported balance using one real ledger posting.

drop function public.get_credit_card_outstanding_components(uuid);

create function public.get_credit_card_outstanding_components(p_card_account_id uuid)
returns table(principal numeric, interest numeric, fee numeric, late_fee numeric, unallocated_credit numeric, total numeric)
language plpgsql security definer stable set search_path = ''
as $$
declare v_wallet_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  select wallet_id into v_wallet_id from public.credit_card_accounts where id=p_card_account_id;
  if not found or not public.is_wallet_authorized(v_wallet_id) then
    raise exception 'Credit card not found or not authorized' using errcode = '42501';
  end if;
  return query
    with active as (
      select e.event_kind,e.amount from public.credit_card_liability_events e
      join public.transactions t on t.id=e.transaction_id
      where e.card_account_id=p_card_account_id and t.deleted_at is null
    ), base as (
      select
        greatest(0,coalesce(sum(amount) filter (where event_kind in ('PURCHASE','CASH_ADVANCE','PURCHASE_REFUND','PAYMENT_PRINCIPAL')),0)
          + greatest(0,coalesce(sum(amount) filter (where event_kind='BALANCE_ADJUSTMENT'),0))) as principal,
        greatest(0,coalesce(sum(amount) filter (where event_kind in ('INTEREST_CHARGE','PAYMENT_INTEREST')),0)) as interest,
        greatest(0,coalesce(sum(amount) filter (where event_kind in ('FEE_CHARGE','PAYMENT_FEE')),0)) as fee,
        greatest(0,coalesce(sum(amount) filter (where event_kind in ('LATE_FEE_CHARGE','PAYMENT_LATE_FEE')),0)) as late_fee,
        greatest(0,-coalesce(sum(amount) filter (where event_kind='CASHBACK'),0))
          + greatest(0,-coalesce(sum(amount) filter (where event_kind='BALANCE_ADJUSTMENT'),0)) as credit
      from active
    ), net as (
      select
        greatest(0,b.principal-greatest(0,b.credit-b.late_fee-b.fee-b.interest)) as principal,
        greatest(0,b.interest-greatest(0,b.credit-b.late_fee-b.fee)) as interest,
        greatest(0,b.fee-greatest(0,b.credit-b.late_fee)) as fee,
        greatest(0,b.late_fee-b.credit) as late_fee,
        greatest(0,b.credit-b.late_fee-b.fee-b.interest-b.principal) as unallocated_credit
      from base b
    )
    select n.principal,n.interest,n.fee,n.late_fee,n.unallocated_credit,
      n.principal+n.interest+n.fee+n.late_fee from net n;
end;
$$;

comment on function public.get_credit_card_outstanding_components(uuid) is
  'Authorized current component view. Cashback and liability-reducing reconciliations offset late fee, fee, interest, then principal; excess is derived card credit. Liability-increasing reconciliations become principal. Nothing is cached.';
revoke execute on function public.get_credit_card_outstanding_components(uuid) from public, anon;
grant execute on function public.get_credit_card_outstanding_components(uuid) to authenticated;

create function public.create_credit_card_balance_adjustment(
  p_card_account_id uuid,
  p_target_wallet_balance numeric,
  p_note text default null,
  p_occurred_at timestamptz default now()
)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  v_card public.credit_card_accounts%rowtype;
  v_wallet public.wallets%rowtype;
  v_current numeric(14,2);
  v_delta numeric(14,2);
  v_transaction_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if p_target_wallet_balance is null then raise exception 'Target balance is required' using errcode='22023'; end if;
  select * into v_card from public.credit_card_accounts where id=p_card_account_id for update;
  if not found or not public.is_wallet_authorized(v_card.wallet_id) then
    raise exception 'Credit card not found or not authorized' using errcode='42501';
  end if;
  select * into v_wallet from public.wallets where id=v_card.wallet_id;
  if v_wallet.is_archived then raise exception 'Credit card is archived' using errcode='23514'; end if;
  v_current := public.get_wallet_balance(v_card.wallet_id);
  v_delta := p_target_wallet_balance-v_current;
  if v_delta=0 then raise exception 'Card balance already matches target' using errcode='22023'; end if;

  insert into public.transactions(scope,owner_user_id,household_id,transaction_type,category_id,title,note,occurred_at,created_by)
  values(v_wallet.scope,v_wallet.owner_user_id,v_wallet.household_id,'CARD_ADJUSTMENT',null,
    'ปรับยอดบัตรเครดิต',nullif(trim(p_note),''),coalesce(p_occurred_at,now()),auth.uid())
  returning id into v_transaction_id;
  perform set_config('app.creating_classified_card_entry','true',true);
  insert into public.transaction_entries(transaction_id,wallet_id,pocket_id,amount)
  values(v_transaction_id,v_card.wallet_id,v_card.system_pocket_id,v_delta);
  insert into public.credit_card_liability_events(card_account_id,event_kind,amount,transaction_id,created_by)
  values(p_card_account_id,'BALANCE_ADJUSTMENT',-v_delta,v_transaction_id,auth.uid());
  return v_transaction_id;
end;
$$;

comment on function public.create_credit_card_balance_adjustment(uuid,numeric,text,timestamptz) is
  'SECURITY DEFINER: reconciles the wallet-backed card to an issuer-reported signed wallet balance with one CARD_ADJUSTMENT posting and one exactly opposite BALANCE_ADJUSTMENT event. Negative target means liability; positive target means card credit. Not income or expense.';
revoke execute on function public.create_credit_card_balance_adjustment(uuid,numeric,text,timestamptz) from public, anon;
grant execute on function public.create_credit_card_balance_adjustment(uuid,numeric,text,timestamptz) to authenticated;
