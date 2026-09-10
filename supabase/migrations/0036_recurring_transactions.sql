-- 0036_recurring_transactions.sql
-- Phase G: Recurring Transactions. A Recurring Rule is NOT a transaction —
-- creating/editing/pausing/archiving one produces zero ledger effect. An
-- Occurrence (a specific due date generated from a rule) is NOT a
-- transaction either, until a user explicitly opens it and presses
-- "บันทึกรายการ" (V1 SAFE CONFIRM-BEFORE-POST — no scheduled/cron posting).
-- Only INCOME/EXPENSE are supported; Transfer/Refund/Reimbursement/Bills
-- remain out of scope (Bills are Phase H, not built here).
--
-- Audit summary (see docs/ARCHITECTURE.md Phase G for the full writeup):
-- no existing recurring/schedule/cron/RRULE code exists anywhere in this
-- repository (Calendar, 0027, is explicitly "no recurrence" in its own
-- comment) — this migration introduces the concept from scratch.

-- ---------------------------------------------------------------------
-- recurring_transactions: the rule. Mirrors transaction_templates'
-- shape for its "default transaction fields" (scope/owner/household,
-- transaction_type restricted to INCOME/EXPENSE, nullable wallet/pocket/
-- category, title/note) plus a schedule. Unlike a Template, `amount` is
-- mandatory here — a Recurring Rule exists specifically to say "this
-- much money is expected on this schedule," which the Finance Hub's
-- upcoming list and the occurrence detail page both need a concrete
-- figure for; a Template's amount is only ever an optional hint.
-- ---------------------------------------------------------------------

create table public.recurring_transactions (
  id uuid primary key default gen_random_uuid(),
  scope public.money_scope not null,
  owner_user_id uuid references public.profiles (id),
  household_id uuid references public.households (id),
  transaction_type public.transaction_type not null,
  name text not null,
  wallet_id uuid references public.wallets (id),
  pocket_id uuid references public.pockets (id),
  category_id uuid references public.categories (id),
  amount numeric(14, 2) not null,
  title text,
  note text,
  frequency text not null,
  interval_count int not null default 1,
  start_date date not null,
  end_date date,
  -- Preserves the ORIGINAL calendar day of `start_date` forever, even
  -- after a clamped occurrence (e.g. 31 Jan -> 28 Feb) — the next
  -- clamp always targets this anchor, never the previous clamped
  -- result, so the schedule never drifts (see recurring_next_due_date
  -- and docs/FINANCE.md Phase G "Month-end anchoring"). Generated, not
  -- client-supplied: recomputes automatically if start_date is edited,
  -- so it can never go stale or be sent inconsistently by a client.
  anchor_day int generated always as (extract(day from start_date)::int) stored,
  paused_at timestamptz,
  archived_at timestamptz,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recurring_transactions_scope_ownership_chk check (
    (scope = 'PERSONAL' and owner_user_id is not null and household_id is null)
    or
    (scope = 'HOUSEHOLD' and household_id is not null and owner_user_id is null)
  ),
  constraint recurring_transactions_type_chk check (transaction_type in ('INCOME', 'EXPENSE')),
  constraint recurring_transactions_name_not_blank_chk check (btrim(name) <> ''),
  constraint recurring_transactions_name_length_chk check (char_length(name) <= 60),
  constraint recurring_transactions_amount_positive_chk check (amount > 0),
  constraint recurring_transactions_pocket_requires_wallet_chk check (pocket_id is null or wallet_id is not null),
  constraint recurring_transactions_frequency_chk check (frequency in ('WEEKLY', 'MONTHLY', 'YEARLY')),
  constraint recurring_transactions_interval_positive_chk check (interval_count >= 1),
  constraint recurring_transactions_end_after_start_chk check (end_date is null or end_date >= start_date)
);

comment on table public.recurring_transactions is
  'A schedule for an expected future INCOME/EXPENSE transaction. Never itself moves money: no transactions row, no transaction_entries row, no balance/Budget/report effect. V1 is SAFE CONFIRM-BEFORE-POST — occurrences (recurring_occurrences) are generated ahead of time but only ever become a real transaction when a user explicitly opens one and saves it through the existing writer.';
comment on column public.recurring_transactions.transaction_type is
  'INCOME or EXPENSE only — Pocket/Wallet Transfer, Refund, Reimbursement, and Bill/Installment recurrences are out of scope for V1.';
comment on column public.recurring_transactions.amount is
  'Mandatory and > 0, unlike a Template''s optional amount — a Recurring Rule must say how much is expected. Freely overridable by the user at posting time.';
comment on column public.recurring_transactions.wallet_id is
  'Optional. A generic rule (e.g. a utility bill with no fixed Wallet) can be created with this null; the occurrence-posting page then requires the user to choose which Wallet actually paid it — see docs/FINANCE.md Phase G "Optional references".';
comment on column public.recurring_transactions.frequency is
  'WEEKLY | MONTHLY | YEARLY (recurring_transactions_frequency_chk). No arbitrary RRULE complexity and no DAILY in V1.';
comment on column public.recurring_transactions.paused_at is
  'NULL = generating new occurrences normally. Set = stop generating new occurrences, but existing already-materialized UPCOMING occurrences remain individually postable/skippable (docs/FINANCE.md Phase G "Pause").';
comment on column public.recurring_transactions.archived_at is
  'NULL = active. Set (never deleted) to retire a rule — same "stops future generation, history remains" behavior as Pause; existing UPCOMING occurrences remain manageable, and any already-POSTED transaction is untouched.';

create index recurring_transactions_owner_user_id_idx on public.recurring_transactions (owner_user_id) where owner_user_id is not null;
create index recurring_transactions_household_id_idx on public.recurring_transactions (household_id) where household_id is not null;
create index recurring_transactions_wallet_id_idx on public.recurring_transactions (wallet_id) where wallet_id is not null;
create index recurring_transactions_category_id_idx on public.recurring_transactions (category_id) where category_id is not null;

create trigger recurring_transactions_set_updated_at
  before update on public.recurring_transactions
  for each row execute function public.set_updated_at();

-- Identity is frozen after creation, same as every other Money entity.
-- Unlike Template, the SCHEDULE (frequency/interval_count/start_date/
-- end_date) and the default fields (name/wallet/pocket/category/amount/
-- title/note) and paused_at/archived_at all remain freely editable —
-- their side effects on recurring_occurrences are handled by the two
-- AFTER UPDATE triggers below, not by freezing them.
create trigger recurring_transactions_prevent_identity_changes
  before update on public.recurring_transactions
  for each row execute function public.prevent_immutable_column_changes(
    'scope', 'owner_user_id', 'household_id', 'created_by', 'transaction_type'
  );

-- Cross-table validation of the three optional references — identical
-- rule shape to transaction_templates_validate_references (0035): a NEW
-- assignment (at create OR edit time) must target an ACTIVE,
-- scope-compatible Wallet/Pocket/Category. Fires only when one of these
-- columns (or an identity column that changes their validity) is part
-- of the write, so an amount/title/schedule-only edit never re-validates
-- an already-saved, possibly-since-archived reference.
create function public.recurring_transactions_validate_references()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_wallet public.wallets%rowtype;
  v_pocket public.pockets%rowtype;
  v_category public.categories%rowtype;
begin
  if new.wallet_id is not null then
    select * into v_wallet from public.wallets where id = new.wallet_id;
    if not found then
      raise exception 'Wallet % not found or not accessible', new.wallet_id using errcode = '23503';
    end if;
    if v_wallet.scope <> new.scope
      or v_wallet.owner_user_id is distinct from new.owner_user_id
      or v_wallet.household_id is distinct from new.household_id
    then
      raise exception 'Wallet % does not belong to the same owner/household as this Recurring rule', new.wallet_id
        using errcode = '23514';
    end if;
    if v_wallet.is_archived then
      raise exception 'Wallet % is archived and cannot be saved as a Recurring default', new.wallet_id
        using errcode = '23514';
    end if;
  end if;

  if new.pocket_id is not null then
    select * into v_pocket from public.pockets where id = new.pocket_id;
    if not found then
      raise exception 'Pocket % not found or not accessible', new.pocket_id using errcode = '23503';
    end if;
    if v_pocket.wallet_id is distinct from new.wallet_id then
      raise exception 'Pocket % does not belong to Wallet %', new.pocket_id, new.wallet_id using errcode = '23514';
    end if;
    if v_pocket.is_archived then
      raise exception 'Pocket % is archived and cannot be saved as a Recurring default', new.pocket_id
        using errcode = '23514';
    end if;
  end if;

  if new.category_id is not null then
    select * into v_category from public.categories where id = new.category_id;
    if not found then
      raise exception 'Category % not found or not accessible', new.category_id using errcode = '23503';
    end if;
    if v_category.transaction_type::text <> new.transaction_type::text then
      raise exception 'Category % is a % category and cannot be used for a % Recurring rule',
        new.category_id, v_category.transaction_type, new.transaction_type
        using errcode = '23514';
    end if;
    if v_category.archived_at is not null then
      raise exception 'Category % is archived and cannot be saved as a Recurring default', new.category_id
        using errcode = '23514';
    end if;
    if not v_category.is_system and (
      v_category.scope <> new.scope
      or v_category.owner_user_id is distinct from new.owner_user_id
      or v_category.household_id is distinct from new.household_id
    ) then
      raise exception 'Category % does not belong to the same owner/household as this Recurring rule', new.category_id
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

comment on function public.recurring_transactions_validate_references() is
  'Rejects newly assigning an archived or scope-incompatible Wallet/Pocket/Category to a Recurring rule, and rejects a Category whose transaction_type does not match. Mirrors transaction_templates_validate_references (0035).';

create trigger recurring_transactions_before_write_validate
  before insert or update of wallet_id, pocket_id, category_id, transaction_type, scope, owner_user_id, household_id
  on public.recurring_transactions
  for each row execute function public.recurring_transactions_validate_references();

alter table public.recurring_transactions enable row level security;

create policy recurring_transactions_select
  on public.recurring_transactions for select
  using (
    (scope = 'PERSONAL' and owner_user_id = auth.uid())
    or
    (scope = 'HOUSEHOLD' and public.is_household_member(household_id))
  );

create policy recurring_transactions_insert
  on public.recurring_transactions for insert
  with check (
    created_by = auth.uid()
    and (
      (scope = 'PERSONAL' and owner_user_id = auth.uid())
      or
      (scope = 'HOUSEHOLD' and public.is_household_member(household_id))
    )
  );

create policy recurring_transactions_update
  on public.recurring_transactions for update
  using (
    (scope = 'PERSONAL' and owner_user_id = auth.uid())
    or
    (scope = 'HOUSEHOLD' and public.is_household_member(household_id))
  )
  with check (
    (scope = 'PERSONAL' and owner_user_id = auth.uid())
    or
    (scope = 'HOUSEHOLD' and public.is_household_member(household_id))
  );

-- No delete policy/grant: hard delete is not part of V1 (archive instead).

grant select, insert, update on public.recurring_transactions to authenticated;

-- ---------------------------------------------------------------------
-- recurring_occurrences: one row per generated due date. Locked down
-- like transaction_template_tags/transaction_tags — SELECT only for
-- authenticated, every write (generation, posting, skipping) goes
-- through a SECURITY DEFINER RPC below. This is deliberate: occurrence
-- rows must only ever be produced by the deterministic generation
-- algorithm and only ever transition status through the vetted
-- post/skip RPCs, never by a freehand client INSERT/UPDATE.
-- ---------------------------------------------------------------------

create table public.recurring_occurrences (
  id uuid primary key default gen_random_uuid(),
  recurring_transaction_id uuid not null references public.recurring_transactions (id) on delete cascade,
  due_date date not null,
  status text not null default 'UPCOMING',
  posted_transaction_id uuid references public.transactions (id),
  posted_at timestamptz,
  skipped_at timestamptz,
  created_at timestamptz not null default now(),
  constraint recurring_occurrences_status_chk check (status in ('UPCOMING', 'POSTED', 'SKIPPED')),
  -- Keeps the three status-specific columns in lockstep with `status`
  -- itself, so a read model never has to guess which fields are
  -- meaningful for a given row.
  constraint recurring_occurrences_status_consistency_chk check (
    (status = 'UPCOMING' and posted_transaction_id is null and posted_at is null and skipped_at is null)
    or (status = 'POSTED' and posted_transaction_id is not null and posted_at is not null and skipped_at is null)
    or (status = 'SKIPPED' and posted_transaction_id is null and posted_at is null and skipped_at is not null)
  ),
  constraint recurring_occurrences_unique_due_date unique (recurring_transaction_id, due_date)
);

comment on table public.recurring_occurrences is
  'One row per generated due date for a Recurring rule. UPCOMING = due, not yet acted on (no ledger effect). POSTED = a real transaction was created from it (posted_transaction_id). SKIPPED = the user explicitly chose not to post it (no transaction, and this due_date is never regenerated). Write-only through materialize_recurring_occurrences / post_recurring_occurrence / skip_recurring_occurrence.';
comment on column public.recurring_occurrences.posted_transaction_id is
  'Provenance only — the created row is an ordinary Income/Expense transaction, indistinguishable from a manually-entered one. If it is later voided (Phase B), this occurrence stays POSTED (never silently reverts to UPCOMING) — see docs/FINANCE.md Phase G "Void interaction".';

create index recurring_occurrences_recurring_transaction_id_idx on public.recurring_occurrences (recurring_transaction_id);
create index recurring_occurrences_upcoming_due_date_idx on public.recurring_occurrences (due_date) where status = 'UPCOMING';
-- Extra guard against ever linking two occurrences to the same posted
-- transaction (defense in depth on top of the FOR UPDATE row lock in
-- post_recurring_occurrence, which is what actually prevents a double
-- post — see docs/FINANCE.md Phase G "Double-post protection").
create unique index recurring_occurrences_posted_transaction_unique_idx on public.recurring_occurrences (posted_transaction_id) where posted_transaction_id is not null;

alter table public.recurring_occurrences enable row level security;

create policy recurring_occurrences_select
  on public.recurring_occurrences for select
  using (
    exists (
      select 1 from public.recurring_transactions r
      where r.id = recurring_occurrences.recurring_transaction_id
        and (
          (r.scope = 'PERSONAL' and r.owner_user_id = auth.uid())
          or
          (r.scope = 'HOUSEHOLD' and public.is_household_member(r.household_id))
        )
    )
  );

grant select on public.recurring_occurrences to authenticated;

-- ---------------------------------------------------------------------
-- recurring_transaction_tags (join table). Same shape and lockdown as
-- transaction_template_tags (0035) — SELECT only, every write through
-- set_recurring_transaction_tags.
-- ---------------------------------------------------------------------

create table public.recurring_transaction_tags (
  recurring_transaction_id uuid not null references public.recurring_transactions (id) on delete cascade,
  tag_id uuid not null references public.tags (id),
  created_at timestamptz not null default now(),
  primary key (recurring_transaction_id, tag_id)
);

comment on table public.recurring_transaction_tags is
  'Many-to-many Recurring rule <-> Tag association (default tags, copied at posting time). Write-only through set_recurring_transaction_tags (SECURITY DEFINER).';

create index recurring_transaction_tags_recurring_transaction_id_idx on public.recurring_transaction_tags (recurring_transaction_id);
create index recurring_transaction_tags_tag_id_idx on public.recurring_transaction_tags (tag_id);

alter table public.recurring_transaction_tags enable row level security;

create policy recurring_transaction_tags_select
  on public.recurring_transaction_tags for select
  using (
    exists (
      select 1 from public.recurring_transactions r
      where r.id = recurring_transaction_tags.recurring_transaction_id
        and (
          (r.scope = 'PERSONAL' and r.owner_user_id = auth.uid())
          or
          (r.scope = 'HOUSEHOLD' and public.is_household_member(r.household_id))
        )
    )
  );

grant select on public.recurring_transaction_tags to authenticated;

create function public.set_recurring_transaction_tags(p_recurring_id uuid, p_tag_ids uuid[])
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rule public.recurring_transactions%rowtype;
  v_authorized boolean;
  v_unique_tag_ids uuid[];
  v_tag_id uuid;
  v_tag public.tags%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  select * into v_rule from public.recurring_transactions where id = p_recurring_id;
  if not found then
    raise exception 'Recurring rule % not found or not authorized', p_recurring_id using errcode = '42501';
  end if;

  if v_rule.scope = 'PERSONAL' then
    v_authorized := v_rule.owner_user_id = auth.uid();
  else
    v_authorized := public.is_household_member(v_rule.household_id);
  end if;
  if not v_authorized then
    raise exception 'Recurring rule % not found or not authorized', p_recurring_id using errcode = '42501';
  end if;

  select array(select distinct unnest(coalesce(p_tag_ids, array[]::uuid[]))) into v_unique_tag_ids;

  foreach v_tag_id in array v_unique_tag_ids loop
    select * into v_tag from public.tags where id = v_tag_id;
    if not found then
      raise exception 'Tag % not found or not accessible', v_tag_id using errcode = 'P0002';
    end if;
    if v_tag.archived_at is not null then
      raise exception 'Tag % is archived and cannot be attached', v_tag_id using errcode = '23514';
    end if;
    if v_tag.scope <> v_rule.scope
      or (v_rule.scope = 'PERSONAL' and v_tag.owner_user_id is distinct from v_rule.owner_user_id)
      or (v_rule.scope = 'HOUSEHOLD' and v_tag.household_id is distinct from v_rule.household_id)
    then
      raise exception 'Tag % does not belong to the same owner/household as Recurring rule %', v_tag_id, p_recurring_id
        using errcode = '23514';
    end if;
  end loop;

  delete from public.recurring_transaction_tags where recurring_transaction_id = p_recurring_id;

  insert into public.recurring_transaction_tags (recurring_transaction_id, tag_id)
  select p_recurring_id, t from unnest(v_unique_tag_ids) as t;

  return p_recurring_id;
end;
$$;

comment on function public.set_recurring_transaction_tags(uuid, uuid[]) is
  'SECURITY DEFINER: replaces a Recurring rule''s default tag set atomically. Rejects an archived or scope-incompatible tag. No financial effect on its own — these are only copied at posting time (post_recurring_occurrence).';

revoke execute on function public.set_recurring_transaction_tags(uuid, uuid[]) from public, anon;
grant execute on function public.set_recurring_transaction_tags(uuid, uuid[]) to authenticated;

-- ---------------------------------------------------------------------
-- recurring_next_due_date: the deterministic month-end/leap-year-safe
-- schedule step. Pure, no data access — safe to grant broadly.
--
-- WEEKLY: p_prev + interval_count * 7 days. Day-of-week is preserved by
-- construction; no anchor needed.
--
-- MONTHLY: advances p_prev's month by interval_count months, then
-- clamps the day to LEAST(anchor_day, days in that target month). The
-- anchor is always the ORIGINAL day-of-month from `p_start` (never the
-- previous, possibly-already-clamped, day) — this is what prevents
-- drift: 31 Jan -> 28/29 Feb -> 31 Mar -> 30 Apr, never 31 -> 28 -> 28.
--
-- YEARLY: the target month is always p_start's month (it never
-- changes); only the year advances by interval_count. The day clamps
-- the same way, so 29 Feb (leap year) -> 28 Feb -> 28 Feb -> 29 Feb
-- (next leap year), always re-attempting 29 rather than settling on 28.
-- ---------------------------------------------------------------------

create function public.recurring_next_due_date(
  p_prev date,
  p_start date,
  p_frequency text,
  p_interval_count int,
  p_anchor_day int
)
returns date
language plpgsql
immutable
as $$
declare
  v_month_start date;
  v_days_in_month int;
  v_target_day int;
  v_target_year int;
  v_target_month int;
begin
  if p_frequency = 'WEEKLY' then
    return p_prev + (p_interval_count * 7);
  elsif p_frequency = 'MONTHLY' then
    v_month_start := (date_trunc('month', p_prev) + (p_interval_count || ' months')::interval)::date;
  elsif p_frequency = 'YEARLY' then
    v_target_year := extract(year from p_prev)::int + p_interval_count;
    v_target_month := extract(month from p_start)::int;
    v_month_start := make_date(v_target_year, v_target_month, 1);
  else
    raise exception 'Unknown recurrence frequency %', p_frequency using errcode = '22023';
  end if;

  v_days_in_month := extract(day from (v_month_start + interval '1 month - 1 day'))::int;
  v_target_day := least(coalesce(p_anchor_day, extract(day from p_start)::int), v_days_in_month);
  return v_month_start + (v_target_day - 1);
end;
$$;

comment on function public.recurring_next_due_date(date, date, text, int, int) is
  'Deterministic next-occurrence date. See docs/FINANCE.md Phase G "Month-end anchoring" for the exact drift-avoidance contract and worked examples.';

grant execute on function public.recurring_next_due_date(date, date, text, int, int) to authenticated;

-- ---------------------------------------------------------------------
-- generate_recurring_occurrences_for_rule: the one shared generation
-- loop. NOT granted to authenticated at all — it writes to the
-- locked-down recurring_occurrences table and is only ever safe to run
-- from within an already-authorized SECURITY DEFINER caller
-- (materialize_recurring_occurrences, or the two AFTER UPDATE triggers
-- below), which is how it still succeeds despite the missing grant: a
-- SECURITY DEFINER function's nested calls execute with the definer's
-- own privileges, not the original client role's.
--
-- Bounded and idempotent: never produces a due_date past p_horizon (or
-- past the rule's own end_date), and the unique(recurring_transaction_
-- id, due_date) constraint (backed by ON CONFLICT DO NOTHING) makes
-- repeated calls a no-op for dates that already exist in ANY status —
-- including a SKIPPED one, which is exactly what keeps a skipped due
-- date from ever being regenerated.
--
-- p_fast_forward is the one behavior difference used only by
-- reactivation (resume/restore, docs/FINANCE.md Phase G "Reactivating a
-- dormant rule"): it advances the very first candidate forward past any
-- due date before "today" without ever materializing those skipped-over
-- dates, so waking up a rule that was dormant for months doesn't flood
-- history with backlog. Ordinary generation (materialize/schedule
-- rebuild) always passes false, so a rule that was simply never paused
-- shows real overdue occurrences as UPCOMING, exactly as intended.
-- ---------------------------------------------------------------------

create function public.generate_recurring_occurrences_for_rule(
  p_rule public.recurring_transactions,
  p_today date,
  p_horizon date,
  p_fast_forward boolean
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_last_due date;
  v_candidate date;
begin
  -- Reactivation and schedule rebuild must derive cadence from the
  -- rule's own start/anchor, not from the greatest historical date.
  -- That history may belong to an older schedule (or be a SKIPPED date
  -- off the new cadence). Starting from it would shift the rebuilt
  -- series: e.g. old 1 Oct + new every-2-month schedule incorrectly
  -- produces 1 Dec instead of the anchored 1 Nov.
  if p_fast_forward then
    v_candidate := p_rule.start_date;
  else
    select max(due_date) into v_last_due from public.recurring_occurrences where recurring_transaction_id = p_rule.id;
    if v_last_due is null then
      v_candidate := p_rule.start_date;
    else
      v_candidate := public.recurring_next_due_date(v_last_due, p_rule.start_date, p_rule.frequency, p_rule.interval_count, p_rule.anchor_day);
    end if;
  end if;

  if p_fast_forward then
    while v_candidate < p_today loop
      v_candidate := public.recurring_next_due_date(v_candidate, p_rule.start_date, p_rule.frequency, p_rule.interval_count, p_rule.anchor_day);
    end loop;
  end if;

  while v_candidate <= p_horizon and (p_rule.end_date is null or v_candidate <= p_rule.end_date) loop
    insert into public.recurring_occurrences (recurring_transaction_id, due_date, status)
    values (p_rule.id, v_candidate, 'UPCOMING')
    on conflict (recurring_transaction_id, due_date) do nothing;
    v_candidate := public.recurring_next_due_date(v_candidate, p_rule.start_date, p_rule.frequency, p_rule.interval_count, p_rule.anchor_day);
  end loop;
end;
$$;

revoke execute on function public.generate_recurring_occurrences_for_rule(public.recurring_transactions, date, date, boolean) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- materialize_recurring_occurrences: called before every recurring-data
-- read (list page, detail page, Finance Hub upcoming section) to
-- materialize any missing occurrences up to a 90-day horizon for every
-- active (not paused, not archived) rule in the caller's scope. One
-- round trip regardless of how many rules exist in that scope — see
-- docs/FINANCE.md Phase G "Generation/idempotency strategy".
-- ---------------------------------------------------------------------

create function public.materialize_recurring_occurrences(p_scope public.money_scope, p_household_id uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'Asia/Bangkok')::date;
  v_horizon date := v_today + 90;
  v_rule public.recurring_transactions%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if p_scope = 'HOUSEHOLD' then
    if p_household_id is null or not public.is_household_member(p_household_id) then
      raise exception 'Not authorized for household %', p_household_id using errcode = '42501';
    end if;
  end if;

  for v_rule in
    select * from public.recurring_transactions
    where archived_at is null
      and paused_at is null
      and scope = p_scope
      and (
        (p_scope = 'PERSONAL' and owner_user_id = auth.uid())
        or
        (p_scope = 'HOUSEHOLD' and household_id = p_household_id)
      )
  loop
    perform public.generate_recurring_occurrences_for_rule(v_rule, v_today, v_horizon, false);
  end loop;
end;
$$;

comment on function public.materialize_recurring_occurrences(public.money_scope, uuid) is
  'Idempotent, bounded (today + 90 days) occurrence generation for every active rule the caller can see in one scope. Call before reading recurring_transactions/recurring_occurrences so the list is always up to date.';

revoke execute on function public.materialize_recurring_occurrences(public.money_scope, uuid) from public, anon;
grant execute on function public.materialize_recurring_occurrences(public.money_scope, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- AFTER UPDATE triggers on recurring_transactions: the two side effects
-- of editing a rule, expressed as triggers (not a bespoke RPC) so
-- create/edit/pause/resume/archive/restore can all stay plain
-- RLS-gated table writes, matching the rest of this codebase's "direct
-- writes for single-table metadata" convention (Category/Tag/Budget/
-- Template) even though the side effect touches a second, locked-down
-- table — the trigger function itself is SECURITY DEFINER, so it can
-- perform that write on behalf of a lower-privileged client UPDATE.
--
-- IMPORTANT ordering note: these two triggers are NOT designed to both
-- fire correctly from a single UPDATE that changes both a schedule
-- column and paused_at/archived_at in the same statement — the app
-- never does this (pause/resume/archive/restore and schedule edits are
-- always separate actions/forms; see recurring/actions.ts), so this is
-- a constraint enforced by the application layer, not the database.
-- ---------------------------------------------------------------------

create function public.recurring_transactions_rebuild_occurrences()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'Asia/Bangkok')::date;
  v_horizon date := v_today + 90;
begin
  -- Keep POSTED and SKIPPED history untouched; only still-UPCOMING
  -- occurrences (never acted on) are fair game to rebuild under the
  -- new schedule (docs/FINANCE.md Phase G "Editing the schedule").
  delete from public.recurring_occurrences
  where recurring_transaction_id = new.id and status = 'UPCOMING';

  -- Re-anchor from the edited rule's start date, then fast-forward to
  -- today. Historical POSTED/SKIPPED rows remain and ON CONFLICT keeps
  -- any same-date history authoritative.
  perform public.generate_recurring_occurrences_for_rule(new, v_today, v_horizon, true);
  return new;
end;
$$;

comment on function public.recurring_transactions_rebuild_occurrences() is
  'AFTER UPDATE OF frequency/interval_count/start_date/end_date (only when a value actually changed — see the trigger''s WHEN clause): deletes and regenerates only still-UPCOMING occurrences, never POSTED or SKIPPED ones.';

create trigger recurring_transactions_after_schedule_change
  after update of frequency, interval_count, start_date, end_date
  on public.recurring_transactions
  for each row
  when (
    old.frequency is distinct from new.frequency
    or old.interval_count is distinct from new.interval_count
    or old.start_date is distinct from new.start_date
    or old.end_date is distinct from new.end_date
  )
  execute function public.recurring_transactions_rebuild_occurrences();

create function public.recurring_transactions_reactivate_occurrences()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'Asia/Bangkok')::date;
  v_horizon date := v_today + 90;
begin
  -- Fast-forward: never backfill the dormant pause/archive window (see
  -- generate_recurring_occurrences_for_rule's p_fast_forward doc above
  -- and docs/FINANCE.md Phase G "Reactivating a dormant rule").
  perform public.generate_recurring_occurrences_for_rule(new, v_today, v_horizon, true);
  return new;
end;
$$;

comment on function public.recurring_transactions_reactivate_occurrences() is
  'AFTER UPDATE OF paused_at/archived_at, only on a was-dormant-now-active transition (see the trigger''s WHEN clause): resumes generation from max(today, natural next point) rather than backfilling every missed cadence step while dormant.';

create trigger recurring_transactions_after_reactivate
  after update of paused_at, archived_at
  on public.recurring_transactions
  for each row
  when (new.paused_at is null and new.archived_at is null and (old.paused_at is not null or old.archived_at is not null))
  execute function public.recurring_transactions_reactivate_occurrences();

-- ---------------------------------------------------------------------
-- post_recurring_occurrence: THE atomic posting operation. Locks the
-- occurrence row (FOR UPDATE) so two concurrent posts on the same
-- occurrence serialize rather than race — the second one always sees
-- status = 'POSTED' once it acquires the lock and is rejected before
-- creating anything (docs/FINANCE.md Phase G "Double-post protection").
--
-- Delegates the actual ledger write to the EXISTING
-- create_income_expense_transaction (0032) rather than duplicating its
-- accounting logic — a nested call from within this SECURITY DEFINER
-- function still runs auth.uid()-based authorization against the REAL
-- calling user (auth.uid() reads the JWT claim, unaffected by the
-- definer-role switch), and both the ledger write and the occurrence
-- status flip happen inside this one function call's single implicit
-- transaction: if either half fails, the whole call rolls back
-- together (docs/FINANCE.md Phase G "Atomic posting").
-- ---------------------------------------------------------------------

create function public.post_recurring_occurrence(
  p_occurrence_id uuid,
  p_wallet_id uuid,
  p_pocket_id uuid,
  p_category_id uuid,
  p_amount numeric,
  p_title text default null,
  p_note text default null,
  p_occurred_at timestamptz default null,
  p_tag_ids uuid[] default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_occurrence public.recurring_occurrences%rowtype;
  v_rule public.recurring_transactions%rowtype;
  v_authorized boolean;
  v_transaction_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  select * into v_occurrence from public.recurring_occurrences where id = p_occurrence_id for update;
  if not found then
    raise exception 'Occurrence % not found', p_occurrence_id using errcode = 'P0002';
  end if;

  select * into v_rule from public.recurring_transactions where id = v_occurrence.recurring_transaction_id;
  if not found then
    raise exception 'Recurring rule for occurrence % not found', p_occurrence_id using errcode = 'P0002';
  end if;

  if v_rule.scope = 'PERSONAL' then
    v_authorized := v_rule.owner_user_id = auth.uid();
  else
    v_authorized := public.is_household_member(v_rule.household_id);
  end if;
  if not v_authorized then
    raise exception 'Occurrence % not found or not authorized', p_occurrence_id using errcode = '42501';
  end if;

  -- Deliberately NOT blocked by the rule being paused/archived — an
  -- already-materialized UPCOMING occurrence remains individually
  -- postable regardless (docs/FINANCE.md Phase G "Pause"/"Archive").
  if v_occurrence.status <> 'UPCOMING' then
    raise exception 'Occurrence % is already % and cannot be posted again', p_occurrence_id, v_occurrence.status
      using errcode = '23514';
  end if;

  v_transaction_id := public.create_income_expense_transaction(
    v_rule.transaction_type, p_wallet_id, p_pocket_id, p_category_id, p_amount, p_title, p_note,
    coalesce(
      p_occurred_at,
      v_occurrence.due_date::timestamp at time zone 'Asia/Bangkok'
    ),
    p_tag_ids
  );

  update public.recurring_occurrences
  set status = 'POSTED', posted_transaction_id = v_transaction_id, posted_at = now()
  where id = p_occurrence_id;

  return v_transaction_id;
end;
$$;

comment on function public.post_recurring_occurrence(uuid, uuid, uuid, uuid, numeric, text, text, timestamptz, uuid[]) is
  'SECURITY DEFINER: locks the occurrence row, rejects a non-UPCOMING occurrence, then creates the real transaction via the existing create_income_expense_transaction (0032) and marks the occurrence POSTED — all in one atomic call.';

revoke execute on function public.post_recurring_occurrence(uuid, uuid, uuid, uuid, numeric, text, text, timestamptz, uuid[]) from public, anon;
grant execute on function public.post_recurring_occurrence(uuid, uuid, uuid, uuid, numeric, text, text, timestamptz, uuid[]) to authenticated;

-- ---------------------------------------------------------------------
-- skip_recurring_occurrence: no ledger entry, no transaction, and the
-- due_date is never regenerated afterward (recurring_occurrences_
-- unique_due_date + generate_recurring_occurrences_for_rule's ON
-- CONFLICT DO NOTHING both key on due_date regardless of status).
-- ---------------------------------------------------------------------

create function public.skip_recurring_occurrence(p_occurrence_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_occurrence public.recurring_occurrences%rowtype;
  v_rule public.recurring_transactions%rowtype;
  v_authorized boolean;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  select * into v_occurrence from public.recurring_occurrences where id = p_occurrence_id for update;
  if not found then
    raise exception 'Occurrence % not found', p_occurrence_id using errcode = 'P0002';
  end if;

  select * into v_rule from public.recurring_transactions where id = v_occurrence.recurring_transaction_id;
  if not found then
    raise exception 'Recurring rule for occurrence % not found', p_occurrence_id using errcode = 'P0002';
  end if;

  if v_rule.scope = 'PERSONAL' then
    v_authorized := v_rule.owner_user_id = auth.uid();
  else
    v_authorized := public.is_household_member(v_rule.household_id);
  end if;
  if not v_authorized then
    raise exception 'Occurrence % not found or not authorized', p_occurrence_id using errcode = '42501';
  end if;

  if v_occurrence.status <> 'UPCOMING' then
    raise exception 'Occurrence % is already % and cannot be skipped', p_occurrence_id, v_occurrence.status
      using errcode = '23514';
  end if;

  update public.recurring_occurrences set status = 'SKIPPED', skipped_at = now() where id = p_occurrence_id;

  return p_occurrence_id;
end;
$$;

comment on function public.skip_recurring_occurrence(uuid) is
  'SECURITY DEFINER: marks an UPCOMING occurrence SKIPPED. No ledger effect; the due_date is never regenerated afterward.';

revoke execute on function public.skip_recurring_occurrence(uuid) from public, anon;
grant execute on function public.skip_recurring_occurrence(uuid) to authenticated;
