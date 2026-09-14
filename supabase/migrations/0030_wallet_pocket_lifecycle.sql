-- 0030_wallet_pocket_lifecycle.sql
-- Phase A: full Wallet + Pocket lifecycle management (rename, edit,
-- archive, restore, conditional hard delete). Nothing here reintroduces
-- Main/default-pocket semantics (0029) — every rule below applies
-- identically to every pocket in a wallet.
--
-- Four independent, small triggers rather than one large one, each named
-- for exactly the invariant it enforces — easier to reason about and to
-- remove individually later than one monolithic "wallet guard" function.

-- ---------------------------------------------------------------------
-- 1. Currency becomes conditionally immutable: mutable only while the
-- wallet has zero ledger history, frozen the moment it has any. This
-- REPLACES the previous unconditional freeze (0014) — 'currency' is
-- removed from the generic prevent_immutable_column_changes trigger and
-- given its own history-aware guard instead. Re-creating the trigger
-- (not editing 0014) is the same pattern already used for 0019/0021.
-- ---------------------------------------------------------------------

drop trigger if exists wallets_prevent_identity_changes on public.wallets;

create trigger wallets_prevent_identity_changes
  before update on public.wallets
  for each row execute function public.prevent_immutable_column_changes('scope', 'owner_user_id', 'household_id', 'created_by');

create function public.wallets_prevent_currency_change_with_history()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.currency <> old.currency and exists (
    select 1 from public.transaction_entries where wallet_id = old.id
  ) then
    raise exception 'Wallet % has transaction history; currency can no longer be changed', old.id
      using errcode = '23514';
  end if;
  return new;
end;
$$;

comment on function public.wallets_prevent_currency_change_with_history() is
  'Currency is mutable only while a wallet has zero transaction_entries — never reinterpret historical amounts under a different currency.';

create trigger wallets_before_update_currency_history_guard
  before update of currency on public.wallets
  for each row execute function public.wallets_prevent_currency_change_with_history();

-- ---------------------------------------------------------------------
-- 2. Archiving a wallet requires a zero derived balance (V1 policy: no
-- "safe strategy" for hiding non-zero money exists yet, so it is simply
-- refused rather than half-solved).
-- ---------------------------------------------------------------------

create function public.wallets_require_zero_balance_to_archive()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.is_archived and not old.is_archived and public.get_wallet_balance(old.id) <> 0 then
    raise exception 'Wallet % has a non-zero balance and cannot be archived', old.id
      using errcode = '23514';
  end if;
  return new;
end;
$$;

comment on function public.wallets_require_zero_balance_to_archive() is
  'V1 policy: a wallet can only be archived once its derived balance is exactly zero.';

create trigger wallets_before_update_archive_zero_balance
  before update of is_archived on public.wallets
  for each row execute function public.wallets_require_zero_balance_to_archive();

-- ---------------------------------------------------------------------
-- 3. Hard delete: only ever safe when zero ledger history exists.
-- No "must already be archived" precondition — that would conflict with
-- ON DELETE CASCADE from wallets to pockets (see pockets' own delete
-- guard below for the full reasoning); "history-free" alone is exactly
-- what the product spec asks for.
-- ---------------------------------------------------------------------

create function public.wallets_prevent_delete_if_used()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if exists (select 1 from public.transaction_entries where wallet_id = old.id) then
    raise exception 'Wallet % has transaction history and cannot be deleted; archive it instead', old.id
      using errcode = '23503';
  end if;
  return old;
end;
$$;

comment on function public.wallets_prevent_delete_if_used() is
  'A wallet with any ledger history can never be hard-deleted, regardless of which privileged path attempts it — archive instead.';

create trigger wallets_before_delete_check_usage
  before delete on public.wallets
  for each row execute function public.wallets_prevent_delete_if_used();

alter table public.wallets enable row level security; -- no-op if already enabled; documents intent at this migration's point in history

create policy wallets_delete
  on public.wallets for delete
  using (
    (scope = 'PERSONAL' and owner_user_id = auth.uid())
    or
    (scope = 'HOUSEHOLD' and public.is_household_member(household_id))
  );

grant delete on public.wallets to authenticated;

-- ---------------------------------------------------------------------
-- 4. Pocket archive requires the wallet to retain at least one other
-- ACTIVE pocket — the direct successor to 0017's "protect the default"
-- rule, generalized: instead of protecting one specific pocket, it
-- protects "at least one pocket is usable", which is what actually
-- mattered even under the old model.
-- ---------------------------------------------------------------------

create function public.pockets_require_active_sibling_to_archive()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.is_archived and not old.is_archived and not exists (
    select 1 from public.pockets
    where wallet_id = old.wallet_id and is_archived = false and id <> old.id
  ) then
    raise exception 'Wallet % must keep at least one active pocket', old.wallet_id using errcode = '23514';
  end if;
  return new;
end;
$$;

comment on function public.pockets_require_active_sibling_to_archive() is
  'Refuses to archive a pocket if it is the last active one in its wallet — every wallet must stay usable.';

create trigger pockets_before_update_archive_active_sibling
  before update of is_archived on public.pockets
  for each row execute function public.pockets_require_active_sibling_to_archive();

-- ---------------------------------------------------------------------
-- 5. Pocket hard delete: history-free AND (if the wallet still exists)
-- not the wallet's last pocket.
--
-- The "if the wallet still exists" branch matters because deleting a
-- wallet (item 3 above) cascades to delete its pockets via
-- ON DELETE CASCADE (0006) — and Postgres fires a child table's own
-- row-level triggers for cascaded deletes exactly as it would for a
-- direct DELETE. Without this guard, deleting a wallet's second-to-last
-- pocket during that cascade would trip "must keep at least one pocket"
-- against a wallet that is itself being deleted, and abort the whole
-- wallet deletion. By the time a cascaded child delete's trigger fires,
-- the parent row has already been removed within the same command, so
-- `exists(select 1 from wallets where id = old.wallet_id)` reliably
-- tells the two situations apart: a standalone pocket delete (wallet
-- still there — the "keep at least one pocket" rule applies) versus a
-- delete happening because the whole wallet is going away (the wallet
-- row is already gone — nothing left to keep a pocket "for").
-- ---------------------------------------------------------------------

create function public.pockets_prevent_delete_if_used()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_wallet_still_exists boolean;
begin
  if exists (select 1 from public.transaction_entries where pocket_id = old.id) then
    raise exception 'Pocket % has transaction history and cannot be deleted; archive it instead', old.id
      using errcode = '23503';
  end if;

  select exists (select 1 from public.wallets where id = old.wallet_id) into v_wallet_still_exists;

  if v_wallet_still_exists and not exists (
    select 1 from public.pockets where wallet_id = old.wallet_id and id <> old.id
  ) then
    raise exception 'Wallet % must keep at least one pocket', old.wallet_id using errcode = '23514';
  end if;

  return old;
end;
$$;

comment on function public.pockets_prevent_delete_if_used() is
  'A pocket with any ledger history can never be hard-deleted. A standalone delete additionally cannot remove a wallet''s last remaining pocket — but this check is skipped when the parent wallet itself no longer exists (i.e. this delete is a cascade from deleting the wallet), or a wallet delete could never complete.';

create trigger pockets_before_delete_check_usage
  before delete on public.pockets
  for each row execute function public.pockets_prevent_delete_if_used();

create policy pockets_delete
  on public.pockets for delete
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

grant delete on public.pockets to authenticated;
