-- 0058_credit_card_charges_and_allocations.sql
-- Record only amounts actually charged by the issuer, then allocate each
-- real card payment immutably across late fee, fee, interest and principal.
-- APR remains informational and is never used to calculate a charge.

create function public.get_credit_card_outstanding_components(p_card_account_id uuid)
returns table(
  principal numeric,
  interest numeric,
  fee numeric,
  late_fee numeric,
  total numeric
)
language plpgsql
security definer
stable
set search_path = ''
as $$
declare v_wallet_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '28000'; end if;
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
    ), components as (
      select
        coalesce(sum(amount) filter (where event_kind in ('PURCHASE', 'CASH_ADVANCE', 'PURCHASE_REFUND', 'PAYMENT_PRINCIPAL')), 0) as principal,
        coalesce(sum(amount) filter (where event_kind in ('INTEREST_CHARGE', 'PAYMENT_INTEREST')), 0) as interest,
        coalesce(sum(amount) filter (where event_kind in ('FEE_CHARGE', 'PAYMENT_FEE')), 0) as fee,
        coalesce(sum(amount) filter (where event_kind in ('LATE_FEE_CHARGE', 'PAYMENT_LATE_FEE')), 0) as late_fee
      from active
    )
    select c.principal, c.interest, c.fee, c.late_fee,
      c.principal + c.interest + c.fee + c.late_fee
    from components c;
end;
$$;

comment on function public.get_credit_card_outstanding_components(uuid) is
  'Authorized four-bucket read model derived only from active immutable liability events. It stores no balance and never calculates interest from APR.';

revoke execute on function public.get_credit_card_outstanding_components(uuid) from public, anon;
grant execute on function public.get_credit_card_outstanding_components(uuid) to authenticated;

create function public.create_credit_card_issuer_charge(
  p_card_account_id uuid,
  p_charge_kind text,
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
  v_event_kind text;
  v_category_key text;
  v_category_id uuid;
  v_transaction_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Charge amount must be positive' using errcode = '22023';
  end if;

  case p_charge_kind
    when 'INTEREST' then
      v_event_kind := 'INTEREST_CHARGE';
      v_category_key := 'expense.finance_fees.card_interest';
    when 'FEE' then
      v_event_kind := 'FEE_CHARGE';
      v_category_key := 'expense.finance_fees.card';
    when 'LATE_FEE' then
      v_event_kind := 'LATE_FEE_CHARGE';
      v_category_key := 'expense.finance_fees.penalties';
    else
      raise exception 'Charge kind must be INTEREST, FEE, or LATE_FEE' using errcode = '22023';
  end case;

  select * into v_card
  from public.credit_card_accounts
  where id = p_card_account_id
  for update;
  if not found or not public.is_wallet_authorized(v_card.wallet_id) then
    raise exception 'Credit card not found or not authorized' using errcode = '42501';
  end if;
  select * into v_wallet from public.wallets where id = v_card.wallet_id;
  if v_wallet.is_archived then raise exception 'Credit card is archived' using errcode = '23514'; end if;

  select id into v_category_id
  from public.categories
  where system_key = v_category_key
    and is_system
    and transaction_type = 'EXPENSE'
    and archived_at is null;
  if not found then
    raise exception 'Required system category % is unavailable', v_category_key using errcode = 'P0002';
  end if;

  perform set_config('app.creating_classified_card_entry', 'true', true);
  v_transaction_id := public.create_income_expense_transaction(
    'EXPENSE', v_card.wallet_id, v_card.system_pocket_id, v_category_id,
    p_amount, p_title, p_note, coalesce(p_occurred_at, now()), null
  );
  insert into public.credit_card_liability_events (
    card_account_id, event_kind, amount, transaction_id, created_by
  ) values (
    p_card_account_id, v_event_kind, p_amount, v_transaction_id, auth.uid()
  );
  return v_transaction_id;
end;
$$;

comment on function public.create_credit_card_issuer_charge(uuid,text,numeric,text,text,timestamptz) is
  'SECURITY DEFINER: records an issuer-reported interest, fee or late-fee amount as exactly one normal EXPENSE and one matching positive liability event. Category is derived from a fixed system key; APR is never read.';

revoke execute on function public.create_credit_card_issuer_charge(uuid,text,numeric,text,text,timestamptz) from public, anon;
grant execute on function public.create_credit_card_issuer_charge(uuid,text,numeric,text,text,timestamptz) to authenticated;

-- A generic REFUND against an issuer charge would reduce report expense
-- without reducing its immutable liability component. Keep purchase refunds
-- on their dedicated same-card flow and reject every other card refund.
create or replace function public.require_classified_card_purchase_refund()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_kind text;
  v_card_wallet_id uuid;
  v_refund_wallet_id uuid;
begin
  select e.event_kind, cca.wallet_id into v_event_kind, v_card_wallet_id
  from public.credit_card_liability_events e
  join public.credit_card_accounts cca on cca.id = e.card_account_id
  where e.transaction_id = new.original_expense_transaction_id
  order by e.event_kind
  limit 1;

  if found and new.adjustment_kind = 'REFUND' then
    if v_event_kind <> 'PURCHASE' then
      raise exception 'Issuer charges cannot use the generic refund flow; void the charge or use a future dedicated correction' using errcode = '23514';
    end if;
    if coalesce(current_setting('app.creating_card_purchase_refund', true), '') <> 'true' then
      raise exception 'Card purchases require the dedicated card refund flow' using errcode = '23514';
    end if;
    select wallet_id into v_refund_wallet_id
    from public.transaction_entries
    where transaction_id = new.transaction_id;
    if v_refund_wallet_id is distinct from v_card_wallet_id then
      raise exception 'A card purchase refund must return to the original card' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

-- Replace the principal-only payment implementation. The public signature
-- stays unchanged for application compatibility; allocation is derived and
-- validated server-side while the card row is locked.
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
  v_card_wallet public.wallets%rowtype;
  v_source_wallet public.wallets%rowtype;
  v_principal numeric(14, 2);
  v_interest numeric(14, 2);
  v_fee numeric(14, 2);
  v_late_fee numeric(14, 2);
  v_total numeric(14, 2);
  v_remaining numeric(14, 2);
  v_pay_principal numeric(14, 2) := 0;
  v_pay_interest numeric(14, 2) := 0;
  v_pay_fee numeric(14, 2) := 0;
  v_pay_late_fee numeric(14, 2) := 0;
  v_transaction_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Payment amount must be positive' using errcode = '22023';
  end if;

  select * into v_card
  from public.credit_card_accounts
  where id = p_card_account_id
  for update;
  if not found or not public.is_wallet_authorized(v_card.wallet_id) then
    raise exception 'Credit card not found or not authorized' using errcode = '42501';
  end if;
  select * into v_card_wallet from public.wallets where id = v_card.wallet_id;
  if v_card_wallet.is_archived then raise exception 'Credit card is archived' using errcode = '23514'; end if;

  if not public.is_wallet_authorized(p_from_wallet_id) then
    raise exception 'Source wallet not found or not authorized' using errcode = '42501';
  end if;
  select * into v_source_wallet from public.wallets where id = p_from_wallet_id;
  if v_source_wallet.wallet_type = 'CREDIT_CARD' then
    raise exception 'A credit-card payment must come from a non-card wallet' using errcode = '23514';
  end if;

  select c.principal, c.interest, c.fee, c.late_fee, c.total
  into v_principal, v_interest, v_fee, v_late_fee, v_total
  from public.get_credit_card_outstanding_components(p_card_account_id) c;
  if p_amount > v_total then
    raise exception 'Payment exceeds current card liability' using errcode = '23514';
  end if;

  -- Deterministic allocation: late fee -> fee -> interest -> principal.
  -- Each non-zero slice becomes its own immutable event on the one real
  -- transfer transaction; their absolute sum equals p_amount exactly.
  v_remaining := p_amount;
  v_pay_late_fee := least(v_remaining, v_late_fee);
  v_remaining := v_remaining - v_pay_late_fee;
  v_pay_fee := least(v_remaining, v_fee);
  v_remaining := v_remaining - v_pay_fee;
  v_pay_interest := least(v_remaining, v_interest);
  v_remaining := v_remaining - v_pay_interest;
  v_pay_principal := least(v_remaining, v_principal);
  v_remaining := v_remaining - v_pay_principal;
  if v_remaining <> 0 then
    raise exception 'Payment allocation did not consume the full amount' using errcode = '23514';
  end if;

  perform set_config('app.creating_classified_card_entry', 'true', true);
  v_transaction_id := public.create_wallet_transfer(
    p_from_wallet_id, p_from_pocket_id, v_card.wallet_id,
    v_card.system_pocket_id, p_amount, p_title, p_note,
    coalesce(p_occurred_at, now()), null, null, null, null, null
  );

  if v_pay_late_fee > 0 then
    insert into public.credit_card_liability_events (card_account_id,event_kind,amount,transaction_id,created_by)
    values (p_card_account_id,'PAYMENT_LATE_FEE',-v_pay_late_fee,v_transaction_id,auth.uid());
  end if;
  if v_pay_fee > 0 then
    insert into public.credit_card_liability_events (card_account_id,event_kind,amount,transaction_id,created_by)
    values (p_card_account_id,'PAYMENT_FEE',-v_pay_fee,v_transaction_id,auth.uid());
  end if;
  if v_pay_interest > 0 then
    insert into public.credit_card_liability_events (card_account_id,event_kind,amount,transaction_id,created_by)
    values (p_card_account_id,'PAYMENT_INTEREST',-v_pay_interest,v_transaction_id,auth.uid());
  end if;
  if v_pay_principal > 0 then
    insert into public.credit_card_liability_events (card_account_id,event_kind,amount,transaction_id,created_by)
    values (p_card_account_id,'PAYMENT_PRINCIPAL',-v_pay_principal,v_transaction_id,auth.uid());
  end if;
  return v_transaction_id;
end;
$$;

comment on function public.create_credit_card_payment(uuid,uuid,uuid,numeric,text,text,timestamptz) is
  'SECURITY DEFINER: creates one net-worth-neutral wallet TRANSFER and 1-4 immutable allocation events in late-fee, fee, interest, principal order. Already-recognized charges are never expensed again. Overpayment and cross-scope/currency/archive misuse are rejected server-side.';

-- Replace the principal-only void/restore invariant with all four buckets.
drop trigger transactions_prevent_negative_card_principal on public.transactions;
drop function public.prevent_negative_card_principal();

create function public.prevent_negative_card_components()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_card_account_id uuid;
  v_principal numeric(14, 2);
  v_interest numeric(14, 2);
  v_fee numeric(14, 2);
  v_late_fee numeric(14, 2);
begin
  select e.card_account_id into v_card_account_id
  from public.credit_card_liability_events e
  where e.transaction_id = new.id
    and e.event_kind in (
      'PURCHASE','CASH_ADVANCE','PURCHASE_REFUND','PAYMENT_PRINCIPAL',
      'INTEREST_CHARGE','PAYMENT_INTEREST','FEE_CHARGE','PAYMENT_FEE',
      'LATE_FEE_CHARGE','PAYMENT_LATE_FEE'
    )
  limit 1;
  if not found then return new; end if;

  select
    coalesce(sum(e.amount) filter (where e.event_kind in ('PURCHASE','CASH_ADVANCE','PURCHASE_REFUND','PAYMENT_PRINCIPAL')), 0),
    coalesce(sum(e.amount) filter (where e.event_kind in ('INTEREST_CHARGE','PAYMENT_INTEREST')), 0),
    coalesce(sum(e.amount) filter (where e.event_kind in ('FEE_CHARGE','PAYMENT_FEE')), 0),
    coalesce(sum(e.amount) filter (where e.event_kind in ('LATE_FEE_CHARGE','PAYMENT_LATE_FEE')), 0)
  into v_principal, v_interest, v_fee, v_late_fee
  from public.credit_card_liability_events e
  join public.transactions t on t.id = e.transaction_id
  where e.card_account_id = v_card_account_id
    and (
      (e.transaction_id <> new.id and t.deleted_at is null)
      or (e.transaction_id = new.id and new.deleted_at is null)
    );

  if v_principal < 0 or v_interest < 0 or v_fee < 0 or v_late_fee < 0 then
    raise exception 'A card liability component cannot become negative; void or restore dependent payments first' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger transactions_prevent_negative_card_components
  before update of deleted_at on public.transactions
  for each row execute function public.prevent_negative_card_components();

revoke execute on function public.prevent_negative_card_components() from public, anon, authenticated;

-- One payment can now carry multiple allocation events. Group activity by
-- transaction so the UI never displays one transfer as four payments.
drop function public.get_credit_card_activity(uuid,integer);

create function public.get_credit_card_activity(p_card_account_id uuid, p_limit integer default 50)
returns table (
  event_id uuid,
  event_kinds text[],
  amount numeric,
  transaction_id uuid,
  occurred_at timestamptz,
  title text,
  category_name text,
  is_voided boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare v_wallet_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  select wallet_id into v_wallet_id from public.credit_card_accounts where id = p_card_account_id;
  if not found or not public.is_wallet_authorized(v_wallet_id) then
    raise exception 'Credit card not found or not authorized' using errcode = '42501';
  end if;
  return query
    select (array_agg(e.id order by e.id))[1], array_agg(e.event_kind order by e.event_kind),
      sum(e.amount), e.transaction_id, t.occurred_at, t.title, c.name,
      t.deleted_at is not null
    from public.credit_card_liability_events e
    join public.transactions t on t.id = e.transaction_id
    left join public.categories c on c.id = t.category_id
    where e.card_account_id = p_card_account_id
    group by e.transaction_id, t.occurred_at, t.title, c.name, t.deleted_at
    order by t.occurred_at desc, max(e.created_at) desc
    limit greatest(1, least(coalesce(p_limit, 50), 200));
end;
$$;

revoke execute on function public.get_credit_card_activity(uuid,integer) from public, anon;
grant execute on function public.get_credit_card_activity(uuid,integer) to authenticated;

-- Keep one export row per ledger transaction even when a payment has four
-- immutable allocation events. card_event_kind is a stable pipe-delimited
-- classification list; card_liability_effect is the exact signed sum.
drop function public.get_finance_export(timestamptz,timestamptz,uuid,uuid,uuid,public.transaction_type,uuid);

create function public.get_finance_export(
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_wallet_id uuid default null,
  p_pocket_id uuid default null,
  p_category_id uuid default null,
  p_type public.transaction_type default null,
  p_tag_id uuid default null
)
returns table(
  id uuid, occurred_at timestamptz, transaction_type public.transaction_type,
  title text, note text, category text, wallets text, pockets text,
  currency text, amount numeric, tags text, scope public.money_scope,
  linked_transfer_id uuid, transfer_charge_kind text,
  card_account_id uuid, card_event_kind text, card_liability_effect numeric
)
language sql
security invoker
stable
set search_path = ''
as $$
  with entry_summary as (
    select t.id, string_agg(distinct w.name, ' | ') as wallets,
      string_agg(distinct p.name, ' | ') as pockets, min(w.currency) as currency,
      case when t.transaction_type = 'INCOME' then sum(e.amount)
        when t.transaction_type = 'EXPENSE' then sum(-e.amount)
        else max(abs(e.amount)) end as amount
    from public.transactions t
    join public.transaction_entries e on e.transaction_id = t.id
    join public.wallets w on w.id = e.wallet_id
    join public.pockets p on p.id = e.pocket_id
    group by t.id
  ), card_summary as (
    select e.transaction_id,
      (array_agg(e.card_account_id order by e.id))[1] as card_account_id,
      string_agg(e.event_kind, '|' order by e.event_kind) as event_kinds,
      sum(e.amount) as liability_effect
    from public.credit_card_liability_events e
    group by e.transaction_id
  )
  select t.id, t.occurred_at, t.transaction_type, t.title, t.note,
    coalesce(c.name, hc.name || ' (ครอบครัว: ' || h.name || ')'),
    s.wallets, s.pockets, s.currency, s.amount,
    (select string_agg(tag.name, ' | ' order by tag.name)
      from public.transaction_tags tt join public.tags tag on tag.id = tt.tag_id
      where tt.transaction_id = t.id),
    t.scope, tll.transfer_transaction_id, tll.kind,
    cs.card_account_id, cs.event_kinds, cs.liability_effect
  from public.transactions t
  join entry_summary s on s.id = t.id
  left join public.categories c on c.id = t.category_id
  left join public.household_expense_attributions hea on hea.transaction_id = t.id
  left join public.categories hc on hc.id = hea.household_category_id
  left join public.households h on h.id = hea.household_id
  left join public.transfer_ledger_links tll on tll.charge_transaction_id = t.id
  left join card_summary cs on cs.transaction_id = t.id
  where t.deleted_at is null
    and (p_from is null or t.occurred_at >= p_from)
    and (p_to is null or t.occurred_at < p_to)
    and (p_category_id is null or t.category_id = p_category_id)
    and (p_type is null or t.transaction_type = p_type)
    and (p_wallet_id is null or exists (select 1 from public.transaction_entries x where x.transaction_id = t.id and x.wallet_id = p_wallet_id))
    and (p_pocket_id is null or exists (select 1 from public.transaction_entries x where x.transaction_id = t.id and x.pocket_id = p_pocket_id))
    and (p_tag_id is null or exists (select 1 from public.transaction_tags x where x.transaction_id = t.id and x.tag_id = p_tag_id))
  order by t.occurred_at, t.id
$$;

comment on function public.get_finance_export(timestamptz,timestamptz,uuid,uuid,uuid,public.transaction_type,uuid) is
  'RLS-scoped logical export. One row per transaction with stable transfer linkage plus aggregated card allocation kinds and exact signed liability effect. Payment allocations never duplicate the transfer row or become expenses.';

revoke execute on function public.get_finance_export(timestamptz,timestamptz,uuid,uuid,uuid,public.transaction_type,uuid) from public, anon;
grant execute on function public.get_finance_export(timestamptz,timestamptz,uuid,uuid,uuid,public.transaction_type,uuid) to authenticated;
