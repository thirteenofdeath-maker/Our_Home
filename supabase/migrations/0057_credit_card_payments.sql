-- 0057_credit_card_payments.sql
-- Pay a managed credit card from a normal wallet as one real TRANSFER.
-- The transfer changes no income/expense totals. Its immutable liability
-- event classifies the card-side posting without becoming another balance.

create function public.create_credit_card_payment(
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
  v_principal_outstanding numeric(14, 2);
  v_transaction_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Payment amount must be positive' using errcode = '22023';
  end if;

  -- Every card writer locks the same metadata row. Purchase, refund and
  -- payment operations for one card therefore cannot race their limits.
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

  if not public.is_wallet_authorized(p_from_wallet_id) then
    raise exception 'Source wallet not found or not authorized' using errcode = '42501';
  end if;
  select * into v_source_wallet from public.wallets where id = p_from_wallet_id;
  if v_source_wallet.wallet_type = 'CREDIT_CARD' then
    raise exception 'A credit-card payment must come from a non-card wallet' using errcode = '23514';
  end if;

  -- Principal is the only payable component in this slice. Interest, fee
  -- and late-fee writers arrive later and will add their own immutable
  -- allocation rows/event kinds rather than mutating this payment.
  select coalesce(sum(e.amount), 0)
  into v_principal_outstanding
  from public.credit_card_liability_events e
  join public.transactions t on t.id = e.transaction_id
  where e.card_account_id = p_card_account_id
    and e.event_kind in ('PURCHASE', 'PURCHASE_REFUND', 'PAYMENT_PRINCIPAL')
    and t.deleted_at is null;

  if p_amount > greatest(v_principal_outstanding, 0) then
    raise exception 'Payment exceeds current card principal' using errcode = '23514';
  end if;

  -- create_wallet_transfer revalidates both wallets, both pockets, scope,
  -- household identity, archive state and currency. The bypass permits
  -- only this transaction's classified card entry and is transaction-local.
  perform set_config('app.creating_classified_card_entry', 'true', true);
  v_transaction_id := public.create_wallet_transfer(
    p_from_wallet_id, p_from_pocket_id, v_card.wallet_id,
    v_card.system_pocket_id, p_amount, p_title, p_note,
    coalesce(p_occurred_at, now()), null, null, null, null, null
  );

  insert into public.credit_card_liability_events (
    card_account_id, event_kind, amount, transaction_id, created_by
  ) values (
    p_card_account_id, 'PAYMENT_PRINCIPAL', -p_amount,
    v_transaction_id, auth.uid()
  );

  return v_transaction_id;
end;
$$;

comment on function public.create_credit_card_payment(uuid,uuid,uuid,numeric,text,text,timestamptz) is
  'SECURITY DEFINER: atomically moves a principal payment from an authorized same-scope, same-currency non-card wallet into the managed card wallet and records one negative PAYMENT_PRINCIPAL liability event. Rejects overpayment so principal never becomes negative. The TRANSFER remains excluded from income/expense reporting.';

revoke execute on function public.create_credit_card_payment(uuid,uuid,uuid,numeric,text,text,timestamptz) from public, anon;
grant execute on function public.create_credit_card_payment(uuid,uuid,uuid,numeric,text,text,timestamptz) to authenticated;

-- A refund also reduces principal. Once payments exist, the original
-- purchase cap alone is insufficient: a refund must not reduce aggregate
-- active principal below zero.
create or replace function public.create_card_purchase_refund(
  p_original_purchase_transaction_id uuid,
  p_amount numeric,
  p_title text default null,
  p_note text default null,
  p_occurred_at timestamptz default now(),
  p_tag_ids uuid[] default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_purchase public.credit_card_liability_events%rowtype;
  v_card public.credit_card_accounts%rowtype;
  v_principal_outstanding numeric(14, 2);
  v_transaction_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Amount must be positive' using errcode = '22023'; end if;

  select * into v_purchase
  from public.credit_card_liability_events
  where transaction_id = p_original_purchase_transaction_id and event_kind = 'PURCHASE'
  for update;
  if not found then raise exception 'Card purchase not found' using errcode = 'P0002'; end if;

  select * into v_card
  from public.credit_card_accounts
  where id = v_purchase.card_account_id
  for update;
  if not public.is_wallet_authorized(v_card.wallet_id) then
    raise exception 'Card purchase not found or not authorized' using errcode = '42501';
  end if;

  select coalesce(sum(e.amount), 0)
  into v_principal_outstanding
  from public.credit_card_liability_events e
  join public.transactions t on t.id = e.transaction_id
  where e.card_account_id = v_purchase.card_account_id
    and e.event_kind in ('PURCHASE', 'PURCHASE_REFUND', 'PAYMENT_PRINCIPAL')
    and t.deleted_at is null;
  if p_amount > greatest(v_principal_outstanding, 0) then
    raise exception 'Refund exceeds current card principal after payments' using errcode = '23514';
  end if;

  perform set_config('app.creating_classified_card_entry', 'true', true);
  perform set_config('app.creating_card_purchase_refund', 'true', true);
  v_transaction_id := public.create_expense_adjustment_transaction(
    p_original_purchase_transaction_id, 'REFUND', v_card.wallet_id,
    v_card.system_pocket_id, p_amount, p_title, p_note,
    coalesce(p_occurred_at, now()), p_tag_ids
  );
  insert into public.credit_card_liability_events (
    card_account_id, event_kind, amount, transaction_id, reverses_event_id, created_by
  ) values (
    v_purchase.card_account_id, 'PURCHASE_REFUND', -p_amount,
    v_transaction_id, v_purchase.id, auth.uid()
  );
  return v_transaction_id;
end;
$$;

-- Void/restore can change whether a purchase, refund or payment contributes
-- to principal. Reject any transition whose projected active principal is
-- negative. Cashback and future unallocated card credit are deliberately
-- outside this principal-only invariant.
create function public.prevent_negative_card_principal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_card_account_id uuid;
  v_projected_principal numeric(14, 2);
begin
  select e.card_account_id into v_card_account_id
  from public.credit_card_liability_events e
  where e.transaction_id = new.id
    and e.event_kind in ('PURCHASE', 'PURCHASE_REFUND', 'PAYMENT_PRINCIPAL')
  limit 1;
  if not found then return new; end if;

  select coalesce(sum(e.amount), 0)
  into v_projected_principal
  from public.credit_card_liability_events e
  join public.transactions t on t.id = e.transaction_id
  where e.card_account_id = v_card_account_id
    and e.event_kind in ('PURCHASE', 'PURCHASE_REFUND', 'PAYMENT_PRINCIPAL')
    and (
      (e.transaction_id <> new.id and t.deleted_at is null)
      or (e.transaction_id = new.id and new.deleted_at is null)
    );

  if v_projected_principal < 0 then
    raise exception 'Card principal cannot become negative; void or restore dependent payments/refunds first' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger transactions_prevent_negative_card_principal
  before update of deleted_at on public.transactions
  for each row execute function public.prevent_negative_card_principal();

revoke execute on function public.prevent_negative_card_principal() from public, anon, authenticated;

-- 0052 rejected every plain transfer. Card payments are also transfers,
-- but their immutable card event makes them classified and safely voidable.
create or replace function public.void_transaction(
  p_transaction_id uuid,
  p_void_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_transaction public.transactions%rowtype;
  v_active_adjustment_total numeric(14, 2);
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if not public.is_transaction_authorized(p_transaction_id) then
    raise exception 'Transaction % not found or not authorized', p_transaction_id using errcode = '42501';
  end if;

  select * into v_transaction from public.transactions where id = p_transaction_id for update;
  if v_transaction.transaction_type = 'TRANSFER'
    and not exists (select 1 from public.transfer_ledger_links where transfer_transaction_id = p_transaction_id)
    and not exists (select 1 from public.credit_card_liability_events where transaction_id = p_transaction_id)
  then
    raise exception 'Transfers cannot be voided in this version' using errcode = '22023';
  end if;
  if v_transaction.deleted_at is not null then
    raise exception 'Transaction % is already voided', p_transaction_id using errcode = '22023';
  end if;

  v_active_adjustment_total := public.get_expense_adjustment_total(p_transaction_id);
  if v_active_adjustment_total > 0 then
    raise exception 'ยกเลิกรายการนี้ไม่ได้ เนื่องจากมีรายการคืนเงิน/เบิกคืนที่ยังใช้งานอยู่' using errcode = '23514';
  end if;

  update public.transactions
  set deleted_at = now(), voided_by = auth.uid(), void_reason = p_void_reason
  where id = p_transaction_id;
  return p_transaction_id;
end;
$$;

comment on function public.void_transaction(uuid,text) is
  'SECURITY DEFINER: voids authorized income/expense, linked transfer groups, or classified credit-card transfers. Plain unclassified transfers remain blocked. Card principal invariants are checked by transactions_prevent_negative_card_principal before the state change.';

-- Extend the existing logical export instead of creating a card-only path.
-- These are stable IDs/classifications, not title-text heuristics.
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
  id uuid,
  occurred_at timestamptz,
  transaction_type public.transaction_type,
  title text,
  note text,
  category text,
  wallets text,
  pockets text,
  currency text,
  amount numeric,
  tags text,
  scope public.money_scope,
  linked_transfer_id uuid,
  transfer_charge_kind text,
  card_account_id uuid,
  card_event_kind text
)
language sql
security invoker
stable
set search_path = ''
as $$
  with entry_summary as (
    select
      t.id,
      string_agg(distinct w.name, ' | ') as wallets,
      string_agg(distinct p.name, ' | ') as pockets,
      min(w.currency) as currency,
      case
        when t.transaction_type = 'INCOME' then sum(e.amount)
        when t.transaction_type = 'EXPENSE' then sum(-e.amount)
        else max(abs(e.amount))
      end as amount
    from public.transactions as t
    join public.transaction_entries as e on e.transaction_id = t.id
    join public.wallets as w on w.id = e.wallet_id
    join public.pockets as p on p.id = e.pocket_id
    group by t.id
  )
  select
    t.id,
    t.occurred_at,
    t.transaction_type,
    t.title,
    t.note,
    coalesce(c.name, hc.name || ' (ครอบครัว: ' || h.name || ')'),
    s.wallets,
    s.pockets,
    s.currency,
    s.amount,
    (
      select string_agg(tag.name, ' | ' order by tag.name)
      from public.transaction_tags tt
      join public.tags tag on tag.id = tt.tag_id
      where tt.transaction_id = t.id
    ),
    t.scope,
    tll.transfer_transaction_id,
    tll.kind,
    ccle.card_account_id,
    ccle.event_kind
  from public.transactions as t
  join entry_summary as s on s.id = t.id
  left join public.categories as c on c.id = t.category_id
  left join public.household_expense_attributions as hea on hea.transaction_id = t.id
  left join public.categories as hc on hc.id = hea.household_category_id
  left join public.households as h on h.id = hea.household_id
  left join public.transfer_ledger_links as tll on tll.charge_transaction_id = t.id
  left join public.credit_card_liability_events as ccle on ccle.transaction_id = t.id
  where t.deleted_at is null
    and (p_from is null or t.occurred_at >= p_from)
    and (p_to is null or t.occurred_at < p_to)
    and (p_category_id is null or t.category_id = p_category_id)
    and (p_type is null or t.transaction_type = p_type)
    and (p_wallet_id is null or exists (
      select 1 from public.transaction_entries x
      where x.transaction_id = t.id and x.wallet_id = p_wallet_id
    ))
    and (p_pocket_id is null or exists (
      select 1 from public.transaction_entries x
      where x.transaction_id = t.id and x.pocket_id = p_pocket_id
    ))
    and (p_tag_id is null or exists (
      select 1 from public.transaction_tags x
      where x.transaction_id = t.id and x.tag_id = p_tag_id
    ))
  order by t.occurred_at, t.id
$$;

comment on function public.get_finance_export(timestamptz,timestamptz,uuid,uuid,uuid,public.transaction_type,uuid) is
  'RLS-scoped logical export. Keeps transfer linkage from 0053 and adds stable card_account_id/card_event_kind classification for purchases, refunds and payments. It does not infer event type from mutable title text.';

revoke execute on function public.get_finance_export(timestamptz,timestamptz,uuid,uuid,uuid,public.transaction_type,uuid) from public, anon;
grant execute on function public.get_finance_export(timestamptz,timestamptz,uuid,uuid,uuid,public.transaction_type,uuid) to authenticated;
