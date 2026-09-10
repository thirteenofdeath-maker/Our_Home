-- 0032_transaction_tags.sql
-- Phase C: cross-cutting Tags (#เชียงใหม่, #แฟน), distinct from Category
-- (accounting/spending classification — see docs/DOMAIN_RULES.md). A Tag
-- may label INCOME, EXPENSE, Pocket Transfer, or Wallet Transfer — it is
-- organizational metadata, never accounting semantics, and never touches
-- transaction_entries. Tag mutation has zero effect on any balance.

-- ---------------------------------------------------------------------
-- tags
-- ---------------------------------------------------------------------

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  scope public.money_scope not null,
  owner_user_id uuid references public.profiles (id),
  household_id uuid references public.households (id),
  name text not null,
  -- Generated (not app-supplied) so duplicate detection can never be
  -- bypassed by a client that forgets to normalize — see docs/FINANCE.md
  -- Phase C "Normalization".
  normalized_name text generated always as (lower(btrim(name))) stored,
  archived_at timestamptz,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tags_scope_ownership_chk check (
    (scope = 'PERSONAL' and owner_user_id is not null and household_id is null)
    or
    (scope = 'HOUSEHOLD' and household_id is not null and owner_user_id is null)
  ),
  constraint tags_name_not_blank_chk check (btrim(name) <> ''),
  constraint tags_name_length_chk check (char_length(name) <= 30)
);

comment on table public.tags is
  'Cross-cutting label, independent of Category. A tag may be attached to any logical transaction (INCOME/EXPENSE/TRANSFER) via transaction_tags. Never affects balances.';
comment on column public.tags.normalized_name is
  'lower(btrim(name)), DB-generated. Backs the per-scope uniqueness indexes below — duplicate detection cannot be bypassed by client-side normalization mistakes.';
comment on column public.tags.archived_at is
  'NULL = active/attachable. Set (never deleted) once a tag has history worth preserving; existing associations are untouched by archiving.';

create index tags_owner_user_id_idx on public.tags (owner_user_id) where owner_user_id is not null;
create index tags_household_id_idx on public.tags (household_id) where household_id is not null;

-- Duplicate prevention is scope-local: a PERSONAL "Trip" and a HOUSEHOLD
-- "Trip" (or a DIFFERENT household's "Trip") are distinct tags — see
-- docs/FINANCE.md Phase C. Applies to archived tags too (recreating an
-- archived tag's name would be confusing; restore it instead).
create unique index tags_personal_unique_name_idx on public.tags (owner_user_id, normalized_name) where scope = 'PERSONAL';
create unique index tags_household_unique_name_idx on public.tags (household_id, normalized_name) where scope = 'HOUSEHOLD';

create trigger tags_set_updated_at
  before update on public.tags
  for each row execute function public.set_updated_at();

-- Same identity-freeze pattern as wallets/pockets/categories (0014/0019):
-- a tag cannot be silently reassigned to a different owner/household or
-- flipped between PERSONAL and HOUSEHOLD after creation.
create trigger tags_prevent_identity_changes
  before update on public.tags
  for each row execute function public.prevent_immutable_column_changes('scope', 'owner_user_id', 'household_id', 'created_by');

alter table public.tags enable row level security;

create policy tags_select
  on public.tags for select
  using (
    (scope = 'PERSONAL' and owner_user_id = auth.uid())
    or
    (scope = 'HOUSEHOLD' and public.is_household_member(household_id))
  );

create policy tags_insert
  on public.tags for insert
  with check (
    created_by = auth.uid()
    and (
      (scope = 'PERSONAL' and owner_user_id = auth.uid())
      or
      (scope = 'HOUSEHOLD' and public.is_household_member(household_id))
    )
  );

-- Rename and archive/restore both go through this single UPDATE policy —
-- same "any active member, not creator-only" rule as wallets/pockets/
-- categories (see docs/DOMAIN_RULES.md "Security").
create policy tags_update
  on public.tags for update
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

-- No delete policy/grant: hard delete is not needed for V1 (archive
-- instead) — same reasoning as the original wallets/pockets design before
-- Phase A's conditional delete existed, except tags never get one here
-- because "a tag has history" is common and unbounded (unlike a wallet).

grant select, insert, update on public.tags to authenticated;

-- ---------------------------------------------------------------------
-- transaction_tags (join table)
--
-- Direct writes are NOT granted to authenticated — same lockdown as
-- transaction_entries (0012). Tags are metadata, not ledger truth, but
-- the association still mediates access to financial transactions, so it
-- goes through set_transaction_tags (SECURITY DEFINER) exclusively,
-- matching "prefer RPC-only mutation for financial state" for every
-- phase's security requirements. SELECT stays open — reading which tags
-- a transaction has is as safe as reading the transaction itself.
-- ---------------------------------------------------------------------

create table public.transaction_tags (
  transaction_id uuid not null references public.transactions (id) on delete cascade,
  tag_id uuid not null references public.tags (id),
  created_at timestamptz not null default now(),
  primary key (transaction_id, tag_id)
);

comment on table public.transaction_tags is
  'Many-to-many Transaction<->Tag association. Write-only through set_transaction_tags (SECURITY DEFINER) — never a direct client INSERT/DELETE. Untouched by void/restore (0031): tags are not financial state.';

create index transaction_tags_transaction_id_idx on public.transaction_tags (transaction_id);
create index transaction_tags_tag_id_idx on public.transaction_tags (tag_id);

alter table public.transaction_tags enable row level security;

create policy transaction_tags_select
  on public.transaction_tags for select
  using (
    exists (
      select 1 from public.transactions t
      where t.id = transaction_tags.transaction_id
        and (
          (t.scope = 'PERSONAL' and t.owner_user_id = auth.uid())
          or
          (t.scope = 'HOUSEHOLD' and public.is_household_member(t.household_id))
        )
    )
  );

grant select on public.transaction_tags to authenticated;

-- ---------------------------------------------------------------------
-- assign_transaction_tags: internal helper shared by set_transaction_tags
-- and the three create_* RPCs below. NOT granted to authenticated — it is
-- reachable only from inside another SECURITY DEFINER function owned by
-- the same role (a nested SECURITY INVOKER call keeps whatever role is
-- already active, so no separate grant is needed for that call path).
-- This keeps it explicitly unreachable as a standalone client RPC, on top
-- of the table-level lockdown above.
--
-- Deliberately does NOT check transaction authorization itself — callers
-- differ (set_transaction_tags checks explicitly; the create_* RPCs have
-- already authorized the wallet the transaction is being created under,
-- which is a stronger guarantee for a transaction that doesn't exist yet
-- anywhere else). It DOES validate every tag id before writing anything:
-- must exist, must not be archived, and must be the same
-- scope/owner/household as the transaction — full replace, all-or-
-- nothing (any failure raises, aborting the whole calling RPC's
-- transaction, so a create_* call never leaves a transaction row behind
-- with silently-dropped tags).
-- ---------------------------------------------------------------------

create function public.assign_transaction_tags(p_transaction_id uuid, p_tag_ids uuid[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_scope public.money_scope;
  v_owner_user_id uuid;
  v_household_id uuid;
  v_unique_tag_ids uuid[];
  v_tag_id uuid;
  v_tag public.tags%rowtype;
begin
  select scope, owner_user_id, household_id
  into v_scope, v_owner_user_id, v_household_id
  from public.transactions
  where id = p_transaction_id;

  if not found then
    raise exception 'Transaction % does not exist', p_transaction_id using errcode = 'P0002';
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

    if v_tag.scope <> v_scope
      or (v_scope = 'PERSONAL' and v_tag.owner_user_id is distinct from v_owner_user_id)
      or (v_scope = 'HOUSEHOLD' and v_tag.household_id is distinct from v_household_id)
    then
      raise exception 'Tag % does not belong to the same owner/household as transaction %', v_tag_id, p_transaction_id
        using errcode = '23514';
    end if;
  end loop;

  delete from public.transaction_tags where transaction_id = p_transaction_id;

  insert into public.transaction_tags (transaction_id, tag_id)
  select p_transaction_id, t from unnest(v_unique_tag_ids) as t;
end;
$$;

revoke execute on function public.assign_transaction_tags(uuid, uuid[]) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- set_transaction_tags: the one client-facing tag-association RPC.
-- Replaces a transaction's full tag set atomically. Follows Phase B
-- transaction authorization exactly (is_transaction_authorized: PERSONAL
-- owner or any HOUSEHOLD member, not creator-only).
-- ---------------------------------------------------------------------

create function public.set_transaction_tags(p_transaction_id uuid, p_tag_ids uuid[])
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if not public.is_transaction_authorized(p_transaction_id) then
    raise exception 'Transaction % not found or not authorized', p_transaction_id using errcode = '42501';
  end if;

  perform public.assign_transaction_tags(p_transaction_id, p_tag_ids);

  return p_transaction_id;
end;
$$;

comment on function public.set_transaction_tags(uuid, uuid[]) is
  'SECURITY DEFINER: replaces a transaction''s tag set atomically (validate every tag first, then delete+reinsert). Zero effect on balances — transaction_entries is never touched.';

revoke execute on function public.set_transaction_tags(uuid, uuid[]) from public, anon;
grant execute on function public.set_transaction_tags(uuid, uuid[]) to authenticated;

-- ---------------------------------------------------------------------
-- Extend the three ledger-write RPCs with an optional p_tag_ids param, so
-- one logical "create a transaction with tags" call is genuinely atomic
-- — a create that raises on an invalid tag never leaves behind a
-- transaction that silently lost its requested tags. DROP + CREATE
-- (rather than CREATE OR REPLACE) because the argument list is changing;
-- this is a brand-new migration, 0010/0012's versions are untouched.
-- ---------------------------------------------------------------------

drop function public.create_income_expense_transaction(public.transaction_type, uuid, uuid, uuid, numeric, text, text, timestamptz);

create function public.create_income_expense_transaction(
  p_transaction_type public.transaction_type,
  p_wallet_id uuid,
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
  v_wallet public.wallets%rowtype;
  v_category public.categories%rowtype;
  v_signed_amount numeric(14, 2);
  v_transaction_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if p_transaction_type not in ('INCOME', 'EXPENSE') then
    raise exception 'create_income_expense_transaction only accepts INCOME or EXPENSE, got %', p_transaction_type
      using errcode = '22023';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be a positive number' using errcode = '22023';
  end if;

  if not public.is_wallet_authorized(p_wallet_id) then
    raise exception 'Wallet % not found or not authorized', p_wallet_id using errcode = '42501';
  end if;

  select * into v_wallet from public.wallets where id = p_wallet_id;

  select * into v_category from public.categories where id = p_category_id;
  if not found then
    raise exception 'Category % not found or not accessible', p_category_id using errcode = 'P0002';
  end if;

  if v_category.transaction_type::text <> p_transaction_type::text then
    raise exception 'Category % is a % category and cannot be used for a % transaction',
      p_category_id, v_category.transaction_type, p_transaction_type
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
    raise exception 'Category % does not belong to the same owner/household as wallet %', p_category_id, p_wallet_id
      using errcode = '23514';
  end if;

  v_signed_amount := case when p_transaction_type = 'INCOME' then p_amount else -p_amount end;

  insert into public.transactions (
    scope, owner_user_id, household_id, transaction_type, category_id,
    title, note, occurred_at, created_by
  )
  values (
    v_wallet.scope, v_wallet.owner_user_id, v_wallet.household_id, p_transaction_type, p_category_id,
    p_title, p_note, coalesce(p_occurred_at, now()), auth.uid()
  )
  returning id into v_transaction_id;

  insert into public.transaction_entries (transaction_id, wallet_id, pocket_id, amount)
  values (v_transaction_id, p_wallet_id, p_pocket_id, v_signed_amount);

  if p_tag_ids is not null and array_length(p_tag_ids, 1) > 0 then
    perform public.assign_transaction_tags(v_transaction_id, p_tag_ids);
  end if;

  return v_transaction_id;
end;
$$;

comment on function public.create_income_expense_transaction(public.transaction_type, uuid, uuid, uuid, numeric, text, text, timestamptz, uuid[]) is
  'SECURITY DEFINER: explicitly checks is_wallet_authorized() before writing. Scope/owner/household are derived from the wallet, not client-supplied. p_tag_ids (0032) is optional and atomic with the create.';

revoke execute on function public.create_income_expense_transaction(public.transaction_type, uuid, uuid, uuid, numeric, text, text, timestamptz, uuid[]) from public, anon;
grant execute on function public.create_income_expense_transaction(public.transaction_type, uuid, uuid, uuid, numeric, text, text, timestamptz, uuid[]) to authenticated;

drop function public.create_pocket_transfer(uuid, uuid, uuid, numeric, text, text, timestamptz);

create function public.create_pocket_transfer(
  p_wallet_id uuid,
  p_from_pocket_id uuid,
  p_to_pocket_id uuid,
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
  v_wallet public.wallets%rowtype;
  v_transaction_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be a positive number' using errcode = '22023';
  end if;

  if p_from_pocket_id = p_to_pocket_id then
    raise exception 'Source and destination pocket must be different' using errcode = '22023';
  end if;

  if not public.is_wallet_authorized(p_wallet_id) then
    raise exception 'Wallet % not found or not authorized', p_wallet_id using errcode = '42501';
  end if;

  select * into v_wallet from public.wallets where id = p_wallet_id;

  insert into public.transactions (
    scope, owner_user_id, household_id, transaction_type, category_id,
    title, note, occurred_at, created_by
  )
  values (
    v_wallet.scope, v_wallet.owner_user_id, v_wallet.household_id, 'TRANSFER', null,
    p_title, p_note, coalesce(p_occurred_at, now()), auth.uid()
  )
  returning id into v_transaction_id;

  -- transaction_entries_validate_pocket (0008) verifies both pockets
  -- actually belong to p_wallet_id and raises a clear error if not.
  insert into public.transaction_entries (transaction_id, wallet_id, pocket_id, amount)
  values
    (v_transaction_id, p_wallet_id, p_from_pocket_id, -p_amount),
    (v_transaction_id, p_wallet_id, p_to_pocket_id, p_amount);

  if p_tag_ids is not null and array_length(p_tag_ids, 1) > 0 then
    perform public.assign_transaction_tags(v_transaction_id, p_tag_ids);
  end if;

  return v_transaction_id;
end;
$$;

comment on function public.create_pocket_transfer(uuid, uuid, uuid, numeric, text, text, timestamptz, uuid[]) is
  'SECURITY DEFINER: explicitly checks is_wallet_authorized() before writing. Moves money between two pockets of the SAME wallet; wallet balance is unaffected by construction. p_tag_ids (0032) is optional and atomic with the create.';

revoke execute on function public.create_pocket_transfer(uuid, uuid, uuid, numeric, text, text, timestamptz, uuid[]) from public, anon;
grant execute on function public.create_pocket_transfer(uuid, uuid, uuid, numeric, text, text, timestamptz, uuid[]) to authenticated;

drop function public.create_wallet_transfer(uuid, uuid, uuid, uuid, numeric, text, text, timestamptz);

create function public.create_wallet_transfer(
  p_from_wallet_id uuid,
  p_from_pocket_id uuid,
  p_to_wallet_id uuid,
  p_to_pocket_id uuid,
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
  v_from_wallet public.wallets%rowtype;
  v_to_wallet public.wallets%rowtype;
  v_transaction_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be a positive number' using errcode = '22023';
  end if;

  if p_from_wallet_id = p_to_wallet_id then
    raise exception 'Use create_pocket_transfer to move money within the same wallet' using errcode = '22023';
  end if;

  if not public.is_wallet_authorized(p_from_wallet_id) then
    raise exception 'Wallet % not found or not authorized', p_from_wallet_id using errcode = '42501';
  end if;
  if not public.is_wallet_authorized(p_to_wallet_id) then
    raise exception 'Wallet % not found or not authorized', p_to_wallet_id using errcode = '42501';
  end if;

  select * into v_from_wallet from public.wallets where id = p_from_wallet_id;
  select * into v_to_wallet from public.wallets where id = p_to_wallet_id;

  if v_from_wallet.scope <> v_to_wallet.scope
    or v_from_wallet.owner_user_id is distinct from v_to_wallet.owner_user_id
    or v_from_wallet.household_id is distinct from v_to_wallet.household_id
  then
    raise exception 'Wallet transfer requires both wallets to share the same owner or household in this version'
      using errcode = '23514';
  end if;

  if v_from_wallet.currency <> v_to_wallet.currency then
    raise exception 'Cannot transfer directly between wallets with different currencies (% vs %); cross-currency transfers are not supported yet',
      v_from_wallet.currency, v_to_wallet.currency
      using errcode = '23514';
  end if;

  insert into public.transactions (
    scope, owner_user_id, household_id, transaction_type, category_id,
    title, note, occurred_at, created_by
  )
  values (
    v_from_wallet.scope, v_from_wallet.owner_user_id, v_from_wallet.household_id, 'TRANSFER', null,
    p_title, p_note, coalesce(p_occurred_at, now()), auth.uid()
  )
  returning id into v_transaction_id;

  insert into public.transaction_entries (transaction_id, wallet_id, pocket_id, amount)
  values
    (v_transaction_id, p_from_wallet_id, p_from_pocket_id, -p_amount),
    (v_transaction_id, p_to_wallet_id, p_to_pocket_id, p_amount);

  if p_tag_ids is not null and array_length(p_tag_ids, 1) > 0 then
    perform public.assign_transaction_tags(v_transaction_id, p_tag_ids);
  end if;

  return v_transaction_id;
end;
$$;

comment on function public.create_wallet_transfer(uuid, uuid, uuid, uuid, numeric, text, text, timestamptz, uuid[]) is
  'SECURITY DEFINER: explicitly checks is_wallet_authorized() for BOTH wallets, rejects cross-currency transfers, before writing. Total net worth is unaffected by construction. p_tag_ids (0032) is optional and atomic with the create.';

revoke execute on function public.create_wallet_transfer(uuid, uuid, uuid, uuid, numeric, text, text, timestamptz, uuid[]) from public, anon;
grant execute on function public.create_wallet_transfer(uuid, uuid, uuid, uuid, numeric, text, text, timestamptz, uuid[]) to authenticated;

-- ---------------------------------------------------------------------
-- Extend update_income_expense_transaction (0031) with an optional
-- p_tag_ids param, so a combined "edit financial fields + edit tags" form
-- submission is one atomic RPC call — never a state where the financial
-- edit succeeds and a separate tag mutation fails (or vice versa). NULL
-- means "leave tags unchanged" (e.g. a future caller that only touches
-- financial fields); an empty array explicitly clears every tag — the
-- edit form always sends its full current tag selection, so it never
-- needs the "leave unchanged" null case, but API callers that don't
-- manage tags at all still can. See docs/FINANCE.md Phase C "Edit".
-- ---------------------------------------------------------------------

drop function public.update_income_expense_transaction(uuid, uuid, uuid, numeric, text, text, timestamptz);

create function public.update_income_expense_transaction(
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

  select * into v_transaction from public.transactions where id = p_transaction_id;

  if v_transaction.transaction_type not in ('INCOME', 'EXPENSE') then
    raise exception 'Only INCOME or EXPENSE transactions can be edited this way; % is a %',
      p_transaction_id, v_transaction.transaction_type
      using errcode = '22023';
  end if;

  if v_transaction.deleted_at is not null then
    raise exception 'Transaction % is voided and cannot be edited; restore it first', p_transaction_id
      using errcode = '22023';
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
  'SECURITY DEFINER: atomically corrects an INCOME/EXPENSE transaction, rebuilds its single ledger entry, and (when p_tag_ids is not null) replaces its tag set — one RPC call, one transaction, never a partial financial-edit-succeeded-but-tags-failed state. Wallet and transaction_type remain immutable; balances recompute automatically.';

revoke execute on function public.update_income_expense_transaction(uuid, uuid, uuid, numeric, text, text, timestamptz, uuid[]) from public, anon;
grant execute on function public.update_income_expense_transaction(uuid, uuid, uuid, numeric, text, text, timestamptz, uuid[]) to authenticated;
