-- 0009_rls_money.sql
-- RLS for wallets, pockets, categories, transactions, transaction_entries.
--
-- Pattern for every PERSONAL/HOUSEHOLD-scoped table:
--   PERSONAL -> owner_user_id = auth.uid()
--   HOUSEHOLD -> is_household_member(household_id)
-- Pockets and transaction_entries have no scope of their own; they check
-- access through their parent row (wallet, transaction) instead.
--
-- Design choice for Milestone 1: any active household member (not only
-- owner/admin) may create/update household wallets, categories and
-- transactions — shared finance is meant to be jointly managed day-to-day.
-- Household *structure* (renaming the household, membership) is the part
-- gated to owner/admin (see 0004_household_members.sql).

-- ---------------------------------------------------------------------
-- wallets
-- ---------------------------------------------------------------------

alter table public.wallets enable row level security;

create policy wallets_select
  on public.wallets for select
  using (
    (scope = 'PERSONAL' and owner_user_id = auth.uid())
    or
    (scope = 'HOUSEHOLD' and public.is_household_member(household_id))
  );

create policy wallets_insert
  on public.wallets for insert
  with check (
    created_by = auth.uid()
    and (
      (scope = 'PERSONAL' and owner_user_id = auth.uid())
      or
      (scope = 'HOUSEHOLD' and public.is_household_member(household_id))
    )
  );

create policy wallets_update
  on public.wallets for update
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

-- No delete policy: wallets are archived (is_archived), never deleted,
-- because they may have ledger history.

-- ---------------------------------------------------------------------
-- pockets (access follows the parent wallet)
-- ---------------------------------------------------------------------

alter table public.pockets enable row level security;

create policy pockets_select
  on public.pockets for select
  using (
    exists (
      select 1 from public.wallets w
      where w.id = pockets.wallet_id
        and (
          (w.scope = 'PERSONAL' and w.owner_user_id = auth.uid())
          or
          (w.scope = 'HOUSEHOLD' and public.is_household_member(w.household_id))
        )
    )
  );

create policy pockets_insert
  on public.pockets for insert
  with check (
    exists (
      select 1 from public.wallets w
      where w.id = pockets.wallet_id
        and (
          (w.scope = 'PERSONAL' and w.owner_user_id = auth.uid())
          or
          (w.scope = 'HOUSEHOLD' and public.is_household_member(w.household_id))
        )
    )
  );

create policy pockets_update
  on public.pockets for update
  using (
    exists (
      select 1 from public.wallets w
      where w.id = pockets.wallet_id
        and (
          (w.scope = 'PERSONAL' and w.owner_user_id = auth.uid())
          or
          (w.scope = 'HOUSEHOLD' and public.is_household_member(w.household_id))
        )
    )
  )
  with check (
    exists (
      select 1 from public.wallets w
      where w.id = pockets.wallet_id
        and (
          (w.scope = 'PERSONAL' and w.owner_user_id = auth.uid())
          or
          (w.scope = 'HOUSEHOLD' and public.is_household_member(w.household_id))
        )
    )
  );

-- No delete policy: pockets are archived, never deleted directly (they
-- disappear only via ON DELETE CASCADE when their wallet is removed, which
-- Milestone 1's UI never does).

-- ---------------------------------------------------------------------
-- categories
-- ---------------------------------------------------------------------

alter table public.categories enable row level security;

create policy categories_select
  on public.categories for select
  using (
    is_system
    or (scope = 'PERSONAL' and owner_user_id = auth.uid())
    or (scope = 'HOUSEHOLD' and public.is_household_member(household_id))
  );

create policy categories_insert
  on public.categories for insert
  with check (
    not is_system
    and created_by = auth.uid()
    and (
      (scope = 'PERSONAL' and owner_user_id = auth.uid())
      or
      (scope = 'HOUSEHOLD' and public.is_household_member(household_id))
    )
  );

create policy categories_update
  on public.categories for update
  using (
    not is_system
    and (
      (scope = 'PERSONAL' and owner_user_id = auth.uid())
      or
      (scope = 'HOUSEHOLD' and public.is_household_member(household_id))
    )
  )
  with check (
    not is_system
    and (
      (scope = 'PERSONAL' and owner_user_id = auth.uid())
      or
      (scope = 'HOUSEHOLD' and public.is_household_member(household_id))
    )
  );

create policy categories_delete
  on public.categories for delete
  using (
    not is_system
    and (
      (scope = 'PERSONAL' and owner_user_id = auth.uid())
      or
      (scope = 'HOUSEHOLD' and public.is_household_member(household_id))
    )
  );

-- Belt-and-suspenders: even if application code forgets to check "has this
-- category ever been used", the database itself refuses to hard-delete a
-- category that any transaction references. Archiving (archived_at) is
-- always available as the alternative.
create function public.categories_prevent_delete_if_used()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if exists (select 1 from public.transactions where category_id = old.id) then
    raise exception 'Category % has transaction history and cannot be deleted; archive it instead', old.id
      using errcode = '23503';
  end if;
  return old;
end;
$$;

create trigger categories_before_delete_check_usage
  before delete on public.categories
  for each row execute function public.categories_prevent_delete_if_used();

-- ---------------------------------------------------------------------
-- transactions
-- ---------------------------------------------------------------------

alter table public.transactions enable row level security;

create policy transactions_select
  on public.transactions for select
  using (
    (scope = 'PERSONAL' and owner_user_id = auth.uid())
    or
    (scope = 'HOUSEHOLD' and public.is_household_member(household_id))
  );

create policy transactions_insert
  on public.transactions for insert
  with check (
    created_by = auth.uid()
    and (
      (scope = 'PERSONAL' and owner_user_id = auth.uid())
      or
      (scope = 'HOUSEHOLD' and public.is_household_member(household_id))
    )
  );

-- Update is allowed only to void a transaction (deleted_at) or edit its
-- note/title — never to change which wallet/pocket/amount it moved money
-- through after the fact. Enforcing "which columns changed" precisely is
-- left to the application layer for Milestone 1 (see DOMAIN_RULES.md
-- "Transaction correction"); the RLS check below still restricts *who* can
-- touch the row at all.
create policy transactions_update
  on public.transactions for update
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

-- No delete policy: transactions are voided (deleted_at), never deleted.

-- ---------------------------------------------------------------------
-- transaction_entries (access follows the parent transaction; immutable
-- ledger lines — no update/delete policy at all, entries are only ever
-- created, in bulk, by the RPC functions in 0010_functions_rpc.sql)
-- ---------------------------------------------------------------------

alter table public.transaction_entries enable row level security;

create policy transaction_entries_select
  on public.transaction_entries for select
  using (
    exists (
      select 1 from public.transactions t
      where t.id = transaction_entries.transaction_id
        and (
          (t.scope = 'PERSONAL' and t.owner_user_id = auth.uid())
          or
          (t.scope = 'HOUSEHOLD' and public.is_household_member(t.household_id))
        )
    )
  );

create policy transaction_entries_insert
  on public.transaction_entries for insert
  with check (
    exists (
      select 1 from public.transactions t
      where t.id = transaction_entries.transaction_id
        and (
          (t.scope = 'PERSONAL' and t.owner_user_id = auth.uid())
          or
          (t.scope = 'HOUSEHOLD' and public.is_household_member(t.household_id))
        )
    )
  );
