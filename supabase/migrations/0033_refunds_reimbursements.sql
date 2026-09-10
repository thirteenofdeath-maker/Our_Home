-- 0033_refunds_reimbursements.sql
-- Phase D: Refunds + Reimbursements.
--
-- Audit finding (see docs/FINANCE.md Phase D for the full writeup): the
-- least disruptive representation does NOT need a new transaction_type
-- enum value at all. get_wallet_balance/get_pocket_balance (0010) already
-- sum every transaction_entries row with no type filter whatsoever, and
-- get_finance_hub_summary's (0028) monthly/category CTEs already do
-- `sum(-amount) filter (where transaction_type = 'EXPENSE')` grouped by
-- category_id. A refund/reimbursement stored as an ordinary
-- transaction_type = 'EXPENSE' row with a POSITIVE ledger entry and the
-- ORIGINAL expense's own category_id nets into every one of those sums
-- completely correctly, with ZERO changes to 0010 or 0028 — arithmetically
-- identical to the exact worked example in the product brief (Expense
-- 8,000 + Refund 500 + Reimburse 300 all type='EXPENSE' => sum(-amount) =
-- -(-8000+500+300) = 7,200 net expense; Income is untouched because
-- refunds are never type='INCOME'). This mirrors the exact pattern
-- already used for Pocket Transfer vs Wallet Transfer: one underlying DB
-- type ('TRANSFER'), split into UI-level sub-kinds by a small amount of
-- structure alongside it — here, a metadata table instead of a same-
-- wallet/different-wallet comparison.
--
-- What IS new: `expense_adjustments`, a metadata/link table marking which
-- EXPENSE-typed transactions are actually refund/reimbursement
-- adjustments against an earlier EXPENSE, plus the one authoritative
-- create RPC and refund-cap-aware extensions to the three Phase B RPCs
-- that must now know about it (edit-immutability + amount floor on the
-- original, void-blocked-while-active-adjustments-exist, and restore's
-- cap re-check).

create type public.expense_adjustment_kind as enum ('REFUND', 'REIMBURSEMENT');

create table public.expense_adjustments (
  transaction_id uuid primary key references public.transactions (id) on delete cascade,
  original_expense_transaction_id uuid not null references public.transactions (id),
  adjustment_kind public.expense_adjustment_kind not null,
  created_at timestamptz not null default now()
);

comment on table public.expense_adjustments is
  'Marks a transaction (transaction_id) as a REFUND or REIMBURSEMENT against an earlier EXPENSE (original_expense_transaction_id). The marked transaction itself is stored as an ordinary transaction_type = ''EXPENSE'' row with a POSITIVE ledger entry and the original''s category_id — see the migration header comment for why this already nets correctly through every existing balance/summary query with no changes there. Write-only through create_expense_adjustment_transaction (SECURITY DEFINER); no direct INSERT/DELETE grant, same lockdown as transaction_tags.';

create index expense_adjustments_original_expense_transaction_id_idx on public.expense_adjustments (original_expense_transaction_id);

alter table public.expense_adjustments enable row level security;

create policy expense_adjustments_select
  on public.expense_adjustments for select
  using (
    exists (
      select 1 from public.transactions t
      where t.id = expense_adjustments.transaction_id
        and (
          (t.scope = 'PERSONAL' and t.owner_user_id = auth.uid())
          or
          (t.scope = 'HOUSEHOLD' and public.is_household_member(t.household_id))
        )
    )
  );

grant select on public.expense_adjustments to authenticated;

-- ---------------------------------------------------------------------
-- get_expense_adjustment_total: the authoritative "how much has already
-- been refunded/reimbursed against this original expense, right now"
-- figure. Reused by create_expense_adjustment_transaction (cap check),
-- update_income_expense_transaction (amount floor), void_transaction
-- (block-if-active-adjustments), and restore_transaction (cap re-check —
-- the transaction being restored is, by construction, still voided at
-- the moment this is called, so `t.deleted_at is null` already excludes
-- it from its own total; no separate "exclude self" logic needed).
-- ---------------------------------------------------------------------

create function public.get_expense_adjustment_total(p_original_expense_transaction_id uuid)
returns numeric
language sql
security invoker
set search_path = public
stable
as $$
  select coalesce(sum(e.amount), 0)
  from public.expense_adjustments a
  join public.transactions t on t.id = a.transaction_id
  join public.transaction_entries e on e.transaction_id = a.transaction_id
  where a.original_expense_transaction_id = p_original_expense_transaction_id
    and t.deleted_at is null;
$$;

comment on function public.get_expense_adjustment_total(uuid) is
  'SUM of active (non-voided) refund/reimbursement ledger entries linked against this original expense. Always the CURRENT figure — recomputed live, never cached — so it stays correct across edits to the original''s own amount.';

revoke execute on function public.get_expense_adjustment_total(uuid) from public, anon;
grant execute on function public.get_expense_adjustment_total(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- get_expense_refundable_summary: the read model for the Expense detail
-- page ("คืน/เบิกคืนรวม ฿500 / เหลือคืนได้ ฿1,000") and the refund/
-- reimbursement create form. Every figure is a decimal string at the
-- wire boundary — no client-side subtraction as financial truth (see
-- docs/FINANCE.md Phase D "Refundable amount read model").
-- ---------------------------------------------------------------------

create function public.get_expense_refundable_summary(p_transaction_id uuid)
returns jsonb
language sql
security invoker
set search_path = public
stable
as $$
  select jsonb_build_object(
    'original_amount', (select abs(e.amount) from public.transaction_entries e where e.transaction_id = p_transaction_id)::text,
    'active_refund_total', coalesce((
      select sum(e.amount)
      from public.expense_adjustments a
      join public.transactions t on t.id = a.transaction_id
      join public.transaction_entries e on e.transaction_id = a.transaction_id
      where a.original_expense_transaction_id = p_transaction_id and a.adjustment_kind = 'REFUND' and t.deleted_at is null
    ), 0)::text,
    'active_reimbursement_total', coalesce((
      select sum(e.amount)
      from public.expense_adjustments a
      join public.transactions t on t.id = a.transaction_id
      join public.transaction_entries e on e.transaction_id = a.transaction_id
      where a.original_expense_transaction_id = p_transaction_id and a.adjustment_kind = 'REIMBURSEMENT' and t.deleted_at is null
    ), 0)::text,
    'remaining_adjustable_amount', (
      (select abs(e.amount) from public.transaction_entries e where e.transaction_id = p_transaction_id)
      - public.get_expense_adjustment_total(p_transaction_id)
    )::text
  );
$$;

comment on function public.get_expense_refundable_summary(uuid) is
  'RLS-scoped read model: original_amount, active_refund_total, active_reimbursement_total, remaining_adjustable_amount, all as decimal strings. Refund and reimbursement totals are reported separately even though both draw from the same combined cap.';

revoke execute on function public.get_expense_refundable_summary(uuid) from public, anon;
grant execute on function public.get_expense_refundable_summary(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- create_expense_adjustment_transaction: the one authoritative mutation
-- for both REFUND and REIMBURSEMENT (kept as one RPC, not two, because
-- the authorization/validation/cap logic is identical either way — only
-- the stored adjustment_kind and the UI labels differ).
-- ---------------------------------------------------------------------

create function public.create_expense_adjustment_transaction(
  p_original_expense_id uuid,
  p_adjustment_kind public.expense_adjustment_kind,
  p_wallet_id uuid,
  p_pocket_id uuid,
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
  v_original public.transactions%rowtype;
  v_original_wallet_id uuid;
  v_original_currency text;
  v_destination_currency text;
  v_original_amount numeric(14, 2);
  v_active_total numeric(14, 2);
  v_wallet public.wallets%rowtype;
  v_pocket public.pockets%rowtype;
  v_transaction_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be a positive number' using errcode = '22023';
  end if;

  if not public.is_transaction_authorized(p_original_expense_id) then
    raise exception 'Expense % not found or not authorized', p_original_expense_id using errcode = '42501';
  end if;

  -- Lock the original expense's own row for the rest of this call. Any
  -- concurrent create_expense_adjustment_transaction (or an edit/void
  -- touching this same original) blocks here until this transaction
  -- commits or rolls back — this is what makes the refund-cap check
  -- below race-safe rather than a plain read-then-write. See
  -- docs/FINANCE.md Phase D "Concurrency safety".
  select * into v_original from public.transactions where id = p_original_expense_id for update;

  if v_original.transaction_type <> 'EXPENSE' then
    raise exception 'Only an EXPENSE transaction can receive a refund or reimbursement' using errcode = '22023';
  end if;

  if v_original.deleted_at is not null then
    raise exception 'Expense % is voided and cannot receive a refund or reimbursement', p_original_expense_id
      using errcode = '22023';
  end if;

  -- Immutable per docs/FINANCE.md Phase D: a refund/reimbursement is
  -- itself never a valid "original" for a further adjustment.
  if exists (select 1 from public.expense_adjustments where transaction_id = p_original_expense_id) then
    raise exception 'Transaction % is itself a refund/reimbursement and cannot be adjusted again', p_original_expense_id
      using errcode = '22023';
  end if;

  if not public.is_wallet_authorized(p_wallet_id) then
    raise exception 'Wallet % not found or not authorized', p_wallet_id using errcode = '42501';
  end if;

  select * into v_wallet from public.wallets where id = p_wallet_id;

  -- No scope laundering: the destination wallet must belong to the exact
  -- same owner/household as the original expense — it need not be the
  -- SAME wallet or pocket (see docs/FINANCE.md Phase D "Destination").
  if v_wallet.scope <> v_original.scope
    or v_wallet.owner_user_id is distinct from v_original.owner_user_id
    or v_wallet.household_id is distinct from v_original.household_id
  then
    raise exception 'Destination wallet must belong to the same owner/household as the original expense'
      using errcode = '23514';
  end if;

  if v_wallet.is_archived then
    raise exception 'Wallet % is archived and cannot receive new transactions', p_wallet_id using errcode = '23514';
  end if;

  select * into v_pocket from public.pockets where id = p_pocket_id;
  if not found then
    raise exception 'Pocket % not found', p_pocket_id using errcode = 'P0002';
  end if;
  if v_pocket.wallet_id <> p_wallet_id then
    raise exception 'Pocket % does not belong to wallet %', p_pocket_id, p_wallet_id using errcode = '23514';
  end if;
  if v_pocket.is_archived then
    raise exception 'Pocket % is archived and cannot receive new transactions', p_pocket_id using errcode = '23514';
  end if;

  -- Currency must match the ORIGINAL EXPENSE's wallet currency exactly —
  -- no FX conversion, regardless of the destination wallet's own currency
  -- (which is otherwise unconstrained beyond "same owner/household").
  select e.wallet_id into v_original_wallet_id from public.transaction_entries e where e.transaction_id = p_original_expense_id;
  select currency into v_original_currency from public.wallets where id = v_original_wallet_id;
  select currency into v_destination_currency from public.wallets where id = p_wallet_id;
  if v_original_currency <> v_destination_currency then
    raise exception 'Refund/reimbursement currency (%) must match the original expense''s currency (%); no FX conversion',
      v_destination_currency, v_original_currency
      using errcode = '23514';
  end if;

  -- Race-safe cap check — v_original is already locked above.
  select abs(e.amount) into v_original_amount from public.transaction_entries e where e.transaction_id = p_original_expense_id;
  v_active_total := public.get_expense_adjustment_total(p_original_expense_id);

  if v_active_total + p_amount > v_original_amount then
    raise exception 'Refund/reimbursement would exceed the original expense amount (% already adjusted of %, % remaining)',
      v_active_total, v_original_amount, v_original_amount - v_active_total
      using errcode = '23514';
  end if;

  -- The adjustment's own transaction row: category_id is COPIED from the
  -- original (never client-supplied) so it attributes to the same
  -- Category in every existing report with no further code — see
  -- docs/FINANCE.md Phase D "Category attribution". An already-archived
  -- original category is still copied; archived-category-history rules
  -- apply exactly as they do for a plain edit (Phase B).
  insert into public.transactions (
    scope, owner_user_id, household_id, transaction_type, category_id,
    title, note, occurred_at, created_by
  )
  values (
    v_original.scope, v_original.owner_user_id, v_original.household_id, 'EXPENSE', v_original.category_id,
    p_title, p_note, coalesce(p_occurred_at, now()), auth.uid()
  )
  returning id into v_transaction_id;

  insert into public.transaction_entries (transaction_id, wallet_id, pocket_id, amount)
  values (v_transaction_id, p_wallet_id, p_pocket_id, p_amount);

  insert into public.expense_adjustments (transaction_id, original_expense_transaction_id, adjustment_kind)
  values (v_transaction_id, p_original_expense_id, p_adjustment_kind);

  if p_tag_ids is not null and array_length(p_tag_ids, 1) > 0 then
    perform public.assign_transaction_tags(v_transaction_id, p_tag_ids);
  end if;

  return v_transaction_id;
end;
$$;

comment on function public.create_expense_adjustment_transaction(uuid, public.expense_adjustment_kind, uuid, uuid, numeric, text, text, timestamptz, uuid[]) is
  'SECURITY DEFINER: atomically creates a REFUND or REIMBURSEMENT against an active EXPENSE — locks the original row (race-safe cap check), validates destination wallet/pocket scope+currency+active status, rejects over-refund, inserts the transaction + its single POSITIVE entry + the expense_adjustments link + optional tags. Never accepts a category_id — always copies the original''s.';

revoke execute on function public.create_expense_adjustment_transaction(uuid, public.expense_adjustment_kind, uuid, uuid, numeric, text, text, timestamptz, uuid[]) from public, anon;
grant execute on function public.create_expense_adjustment_transaction(uuid, public.expense_adjustment_kind, uuid, uuid, numeric, text, text, timestamptz, uuid[]) to authenticated;

-- ---------------------------------------------------------------------
-- update_income_expense_transaction: same signature as 0032 (CREATE OR
-- REPLACE is safe here — no argument list change), extended with two
-- refund-aware rules:
--   1. A transaction that is ITSELF a refund/reimbursement is immutable
--      via this RPC (V1 — see docs/FINANCE.md Phase D "Refund editing").
--   2. An EXPENSE's amount cannot be edited below its current active
--      adjustment total. The row is now locked FOR UPDATE before this
--      check, serializing against a concurrent
--      create_expense_adjustment_transaction on the same original.
-- ---------------------------------------------------------------------

create or replace function public.update_income_expense_transaction(
  p_transaction_id uuid,
  p_pocket_id uuid,
  p_category_id uuid,
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
  v_transaction public.transactions%rowtype;
  v_entry public.transaction_entries%rowtype;
  v_wallet public.wallets%rowtype;
  v_pocket public.pockets%rowtype;
  v_category public.categories%rowtype;
  v_signed_amount numeric(14, 2);
  v_active_adjustment_total numeric(14, 2);
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be a positive number' using errcode = '22023';
  end if;

  if not public.is_transaction_authorized(p_transaction_id) then
    raise exception 'Transaction % not found or not authorized', p_transaction_id using errcode = '42501';
  end if;

  -- Locked for the duration of this call — see the cap check below.
  select * into v_transaction from public.transactions where id = p_transaction_id for update;

  if v_transaction.transaction_type not in ('INCOME', 'EXPENSE') then
    raise exception 'Only INCOME or EXPENSE transactions can be edited this way; % is a %',
      p_transaction_id, v_transaction.transaction_type
      using errcode = '22023';
  end if;

  if v_transaction.deleted_at is not null then
    raise exception 'Transaction % is voided and cannot be edited; restore it first', p_transaction_id
      using errcode = '22023';
  end if;

  if exists (select 1 from public.expense_adjustments where transaction_id = p_transaction_id) then
    raise exception 'A refund/reimbursement is immutable — void it and create a corrected one instead' using errcode = '22023';
  end if;

  -- INCOME/EXPENSE always has exactly one ledger entry (0010); that entry's
  -- wallet_id is this transaction's wallet and is never itself editable.
  select * into v_entry from public.transaction_entries where transaction_id = p_transaction_id;
  if not found then
    raise exception 'Transaction % has no ledger entry', p_transaction_id using errcode = 'P0002';
  end if;

  select * into v_wallet from public.wallets where id = v_entry.wallet_id;

  select * into v_pocket from public.pockets where id = p_pocket_id;
  if not found then
    raise exception 'Pocket % not found', p_pocket_id using errcode = 'P0002';
  end if;
  if v_pocket.wallet_id <> v_entry.wallet_id then
    raise exception 'Pocket % does not belong to this transaction''s wallet; moving a transaction between wallets is not supported', p_pocket_id
      using errcode = '23514';
  end if;
  if v_pocket.is_archived then
    raise exception 'Pocket % is archived and cannot receive transactions', p_pocket_id using errcode = '23514';
  end if;

  -- Category is only re-validated when it actually changes — an already
  -- assigned (possibly since-archived) category stays valid for a
  -- transaction that isn't touching it. See docs/FINANCE.md Phase B.
  if p_category_id is distinct from v_transaction.category_id then
    select * into v_category from public.categories where id = p_category_id;
    if not found then
      raise exception 'Category % not found or not accessible', p_category_id using errcode = 'P0002';
    end if;

    if v_category.transaction_type::text <> v_transaction.transaction_type::text then
      raise exception 'Category % is a % category and cannot be used for a % transaction',
        p_category_id, v_category.transaction_type, v_transaction.transaction_type
        using errcode = '23514';
    end if;

    if v_category.archived_at is not null then
      raise exception 'Category % is archived and cannot be used for new transactions', p_category_id
        using errcode = '23514';
    end if;

    if not v_category.is_system and (
      v_category.scope <> v_wallet.scope
      or v_category.owner_user_id is distinct from v_wallet.owner_user_id
      or v_category.household_id is distinct from v_wallet.household_id
    ) then
      raise exception 'Category % does not belong to the same owner/household as wallet %', p_category_id, v_wallet.id
        using errcode = '23514';
    end if;
  end if;

  -- Refund-aware amount floor: an EXPENSE cannot be edited below whatever
  -- has already been actively refunded/reimbursed against it. Harmless
  -- (always 0) for INCOME or an EXPENSE with no adjustments.
  v_active_adjustment_total := public.get_expense_adjustment_total(p_transaction_id);
  if v_active_adjustment_total > 0 and p_amount < v_active_adjustment_total then
    raise exception 'Amount cannot be reduced below % — that much has already been refunded/reimbursed against this expense',
      v_active_adjustment_total
      using errcode = '23514';
  end if;

  v_signed_amount := case when v_transaction.transaction_type = 'INCOME' then p_amount else -p_amount end;

  update public.transactions
  set category_id = p_category_id,
      title = p_title,
      note = p_note,
      occurred_at = coalesce(p_occurred_at, occurred_at)
  where id = p_transaction_id;

  update public.transaction_entries
  set pocket_id = p_pocket_id,
      amount = v_signed_amount
  where id = v_entry.id;

  if p_tag_ids is not null then
    perform public.assign_transaction_tags(p_transaction_id, p_tag_ids);
  end if;

  return p_transaction_id;
end;
$$;

comment on function public.update_income_expense_transaction(uuid, uuid, uuid, numeric, text, text, timestamptz, uuid[]) is
  'SECURITY DEFINER: atomically corrects an INCOME/EXPENSE transaction, rebuilds its single ledger entry, and (when p_tag_ids is not null) replaces its tag set. Refuses to edit a transaction that is itself a refund/reimbursement, and refuses to reduce an EXPENSE''s amount below its current active refund/reimbursement total (0033). Wallet and transaction_type remain immutable; balances recompute automatically.';

-- ---------------------------------------------------------------------
-- void_transaction: same signature as 0031 — extended to reject voiding
-- an EXPENSE that still has active linked refunds/reimbursements.
-- ---------------------------------------------------------------------

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
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if not public.is_transaction_authorized(p_transaction_id) then
    raise exception 'Transaction % not found or not authorized', p_transaction_id using errcode = '42501';
  end if;

  -- Locked for the duration of this call — a concurrent
  -- create_expense_adjustment_transaction against this same original
  -- blocks here (or vice versa) rather than racing past this check.
  select * into v_transaction from public.transactions where id = p_transaction_id for update;

  if v_transaction.transaction_type = 'TRANSFER' then
    raise exception 'Transfers cannot be voided in this version' using errcode = '22023';
  end if;

  if v_transaction.deleted_at is not null then
    raise exception 'Transaction % is already voided' using errcode = '22023';
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

comment on function public.void_transaction(uuid, text) is
  'SECURITY DEFINER: sets deleted_at (+ voided_by/void_reason). Rejects voiding an EXPENSE that still has an active (non-voided) linked refund/reimbursement (0033) — void those first. Ledger entries and tag associations are untouched; every balance/summary function already excludes voided transactions. Idempotency: voiding an already-voided transaction raises rather than silently succeeding.';

-- ---------------------------------------------------------------------
-- restore_transaction: same signature as 0031 — extended so restoring a
-- refund/reimbursement re-validates the original is still active and
-- that restoring it would not exceed the original's refundable cap.
-- ---------------------------------------------------------------------

create or replace function public.restore_transaction(p_transaction_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_transaction public.transactions%rowtype;
  v_entry public.transaction_entries%rowtype;
  v_wallet public.wallets%rowtype;
  v_pocket public.pockets%rowtype;
  v_adjustment public.expense_adjustments%rowtype;
  v_original public.transactions%rowtype;
  v_original_amount numeric(14, 2);
  v_active_adjustment_total numeric(14, 2);
  v_own_amount numeric(14, 2);
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if not public.is_transaction_authorized(p_transaction_id) then
    raise exception 'Transaction % not found or not authorized', p_transaction_id using errcode = '42501';
  end if;

  select * into v_transaction from public.transactions where id = p_transaction_id;

  if v_transaction.deleted_at is null then
    raise exception 'Transaction % is not voided' using errcode = '22023';
  end if;

  -- If this transaction is itself a refund/reimbursement, re-validate the
  -- original expense and the combined cap before touching anything else.
  select * into v_adjustment from public.expense_adjustments where transaction_id = p_transaction_id;
  if found then
    -- Lock the ORIGINAL's row — serializes against a concurrent
    -- create_expense_adjustment_transaction or edit on that same original.
    select * into v_original from public.transactions where id = v_adjustment.original_expense_transaction_id for update;

    if v_original.deleted_at is not null then
      raise exception 'Original expense % is voided; restore it first', v_adjustment.original_expense_transaction_id
        using errcode = '23514';
    end if;

    select abs(e.amount) into v_original_amount from public.transaction_entries e where e.transaction_id = v_original.id;
    -- This transaction is still deleted_at IS NOT NULL at this point, so
    -- get_expense_adjustment_total already excludes it from the total —
    -- no separate "exclude self" step needed.
    v_active_adjustment_total := public.get_expense_adjustment_total(v_original.id);
    select e.amount into v_own_amount from public.transaction_entries e where e.transaction_id = p_transaction_id;

    if v_active_adjustment_total + v_own_amount > v_original_amount then
      raise exception 'Restoring this % would exceed the original expense''s remaining refundable amount (% already active, % restoring, % original)',
        v_adjustment.adjustment_kind, v_active_adjustment_total, v_own_amount, v_original_amount
        using errcode = '23514';
    end if;
  end if;

  -- Reactivating must restore the exact original financial effect, so
  -- every wallet/pocket it moved money through must still be usable.
  -- INCOME/EXPENSE has one entry; TRANSFER (voided by some future path)
  -- would have two — checked in a loop so this stays correct either way,
  -- even though void_transaction currently never lets a TRANSFER reach
  -- this state.
  for v_entry in select * from public.transaction_entries where transaction_id = p_transaction_id loop
    select * into v_wallet from public.wallets where id = v_entry.wallet_id;
    if not found or v_wallet.is_archived then
      raise exception 'Wallet % is archived or no longer exists; restore is not safe', v_entry.wallet_id
        using errcode = '23514';
    end if;

    select * into v_pocket from public.pockets where id = v_entry.pocket_id;
    if not found or v_pocket.is_archived then
      raise exception 'Pocket % is archived or no longer exists; restore is not safe', v_entry.pocket_id
        using errcode = '23514';
    end if;
  end loop;

  update public.transactions
  set deleted_at = null, voided_by = null, void_reason = null
  where id = p_transaction_id;

  return p_transaction_id;
end;
$$;

comment on function public.restore_transaction(uuid) is
  'SECURITY DEFINER: clears deleted_at/voided_by/void_reason after validating every wallet/pocket the transaction touches is still active. If the transaction is itself a refund/reimbursement (0033), additionally requires the original expense to still be active and re-checks the combined refund/reimbursement cap (race-safe: locks the original''s row first). Rejects (does not silently rewrite) when a dependency is archived or the cap would be exceeded. Restoring an already-active transaction raises rather than silently succeeding.';
