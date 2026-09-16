-- Credit-card flows must reason about the managed card Pocket, not the
-- containing Wallet, because one Wallet may hold several currencies/cards.

create or replace function public.create_credit_card_payment(
  p_card_account_id uuid,
  p_from_wallet_id uuid,
  p_from_pocket_id uuid,
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
  v_card_pocket public.pockets%rowtype;
  v_source_pocket public.pockets%rowtype;
  v_principal numeric(14,2);
  v_interest numeric(14,2);
  v_fee numeric(14,2);
  v_late_fee numeric(14,2);
  v_total numeric(14,2);
  v_remaining numeric(14,2);
  v_pay_principal numeric(14,2) := 0;
  v_pay_interest numeric(14,2) := 0;
  v_pay_fee numeric(14,2) := 0;
  v_pay_late_fee numeric(14,2) := 0;
  v_transaction_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if p_amount is null or p_amount<=0 then raise exception 'Payment amount must be positive' using errcode='22023'; end if;

  select * into v_card from public.credit_card_accounts
  where id=p_card_account_id for update;
  if not found or not public.is_wallet_authorized(v_card.wallet_id) then
    raise exception 'Credit card not found or not authorized' using errcode='42501';
  end if;
  select * into v_card_pocket from public.pockets
  where id=v_card.system_pocket_id and wallet_id=v_card.wallet_id;
  if not found or v_card_pocket.is_archived then
    raise exception 'Credit-card pocket is unavailable' using errcode='23514';
  end if;
  if not public.is_wallet_authorized(p_from_wallet_id) then
    raise exception 'Source wallet not found or not authorized' using errcode='42501';
  end if;
  select * into v_source_pocket from public.pockets
  where id=p_from_pocket_id and wallet_id=p_from_wallet_id;
  if not found or v_source_pocket.is_archived or v_source_pocket.pocket_type='CREDIT_CARD' then
    raise exception 'Payment source must be an active non-card pocket' using errcode='23514';
  end if;

  select c.principal,c.interest,c.fee,c.late_fee,c.total
  into v_principal,v_interest,v_fee,v_late_fee,v_total
  from public.get_credit_card_outstanding_components(p_card_account_id) c;
  if p_amount>v_total then raise exception 'Payment exceeds current card liability' using errcode='23514'; end if;

  v_remaining:=p_amount;
  v_pay_late_fee:=least(v_remaining,v_late_fee); v_remaining:=v_remaining-v_pay_late_fee;
  v_pay_fee:=least(v_remaining,v_fee); v_remaining:=v_remaining-v_pay_fee;
  v_pay_interest:=least(v_remaining,v_interest); v_remaining:=v_remaining-v_pay_interest;
  v_pay_principal:=least(v_remaining,v_principal); v_remaining:=v_remaining-v_pay_principal;
  if v_remaining<>0 then raise exception 'Payment allocation did not consume the full amount' using errcode='23514'; end if;

  perform set_config('app.creating_classified_card_entry','true',true);
  v_transaction_id:=public.create_wallet_transfer(
    p_from_wallet_id,p_from_pocket_id,v_card.wallet_id,v_card.system_pocket_id,
    p_amount,coalesce(nullif(trim(p_title),''),'ชำระบัตรเครดิต'),nullif(trim(p_note),''),
    coalesce(p_occurred_at,now()),null,null,null,null,null
  );
  if v_pay_late_fee>0 then insert into public.credit_card_liability_events(card_account_id,event_kind,amount,transaction_id,created_by) values(p_card_account_id,'PAYMENT_LATE_FEE',-v_pay_late_fee,v_transaction_id,auth.uid()); end if;
  if v_pay_fee>0 then insert into public.credit_card_liability_events(card_account_id,event_kind,amount,transaction_id,created_by) values(p_card_account_id,'PAYMENT_FEE',-v_pay_fee,v_transaction_id,auth.uid()); end if;
  if v_pay_interest>0 then insert into public.credit_card_liability_events(card_account_id,event_kind,amount,transaction_id,created_by) values(p_card_account_id,'PAYMENT_INTEREST',-v_pay_interest,v_transaction_id,auth.uid()); end if;
  if v_pay_principal>0 then insert into public.credit_card_liability_events(card_account_id,event_kind,amount,transaction_id,created_by) values(p_card_account_id,'PAYMENT_PRINCIPAL',-v_pay_principal,v_transaction_id,auth.uid()); end if;
  return v_transaction_id;
end;
$$;

create or replace function public.create_credit_card_cash_advance(
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
  v_card_pocket public.pockets%rowtype;
  v_destination_pocket public.pockets%rowtype;
  v_available_credit numeric(14,2);
  v_transaction_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if p_amount is null or p_amount<=0 then raise exception 'Cash-advance amount must be positive' using errcode='22023'; end if;

  select * into v_card from public.credit_card_accounts
  where id=p_card_account_id for update;
  if not found or not public.is_wallet_authorized(v_card.wallet_id) then
    raise exception 'Credit card not found or not authorized' using errcode='42501';
  end if;
  select * into v_card_pocket from public.pockets
  where id=v_card.system_pocket_id and wallet_id=v_card.wallet_id;
  if not found or v_card_pocket.is_archived then
    raise exception 'Credit-card pocket is unavailable' using errcode='23514';
  end if;
  if not public.is_wallet_authorized(p_to_wallet_id) then
    raise exception 'Destination wallet not found or not authorized' using errcode='42501';
  end if;
  select * into v_destination_pocket from public.pockets
  where id=p_to_pocket_id and wallet_id=p_to_wallet_id;
  if not found or v_destination_pocket.is_archived or v_destination_pocket.pocket_type='CREDIT_CARD' then
    raise exception 'Cash advance destination must be an active non-card pocket' using errcode='23514';
  end if;

  v_available_credit:=v_card.credit_limit+public.get_pocket_balance(v_card.system_pocket_id);
  if p_amount>v_available_credit then raise exception 'Cash advance exceeds available credit' using errcode='23514'; end if;

  perform set_config('app.creating_classified_card_entry','true',true);
  v_transaction_id:=public.create_wallet_transfer(
    v_card.wallet_id,v_card.system_pocket_id,p_to_wallet_id,p_to_pocket_id,
    p_amount,coalesce(nullif(trim(p_title),''),'กดเงินสดจากบัตรเครดิต'),nullif(trim(p_note),''),
    coalesce(p_occurred_at,now()),null,null,null,null,null
  );
  insert into public.credit_card_liability_events(card_account_id,event_kind,amount,transaction_id,created_by)
  values(p_card_account_id,'CASH_ADVANCE',p_amount,v_transaction_id,auth.uid());
  return v_transaction_id;
end;
$$;
