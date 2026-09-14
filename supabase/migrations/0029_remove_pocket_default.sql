-- 0029_remove_pocket_default.sql
-- Domain change: remove the "Main Pocket" / default-pocket concept
-- entirely. All Pockets inside a Wallet are now equal — no is_default
-- column, no auto-created "Main", no sole-default invariant to protect.
--
-- Decision: DROP the is_default column outright rather than deprecate it
-- in place. Audited every reference first (migrations 0006, 0017; app
-- code in features/pockets, features/transactions, features/wallets,
-- the wallet detail page, src/types/database.ts) — nothing outside this
-- repo depends on the column, no other table has a foreign key to it, and
-- every reference is being updated in the same change. That is exactly
-- the "safe and clean to remove" case this Milestone's own policy prefers
-- over leaving a fake, unused concept behind. There is no live external
-- API consumer of this schema to stay backward-compatible with.
--
-- Existing data: dropping a column never touches rows or other columns.
-- A wallet's current "Main" pocket keeps its id, name, wallet_id,
-- created_at, and — critically — every transaction_entries row that
-- already references it. It simply stops having a column that ever
-- marked it special. This is the correct, minimal-risk way to turn
-- "Main (is_default=true)" into "Main (ordinary Pocket)": there is
-- nothing left in the schema that could make it behave differently from
-- any other pocket. No UPDATE/rename of existing rows is needed or
-- performed.
--
-- Per §4 of the task this migration answers: no new hard "wallet must
-- have >=1 pocket" DB constraint is added. It isn't needed — pockets have
-- never had a client-facing DELETE grant (see 0011_grants.sql: pockets
-- only ever granted select/insert/update), so an existing wallet's pocket
-- count can only grow, never shrink, through the app today. The new
-- create_wallet_with_first_pocket() RPC below is what guarantees a NEW
-- wallet is never created with zero pockets. That combination (can't
-- create wallet without a pocket; can't delete pockets at all) is the
-- documented invariant, not a trigger.

-- ---------------------------------------------------------------------
-- 1. Remove the "protect the default" trigger (0017) — nothing is
-- special anymore, so there is nothing to protect.
-- ---------------------------------------------------------------------

drop trigger if exists pockets_before_update_protect_default on public.pockets;
drop function if exists public.pockets_protect_default();

-- ---------------------------------------------------------------------
-- 2. Remove auto-creation of "Main" on wallet insert (0006). Wallet
-- creation now always goes through create_wallet_with_first_pocket()
-- below, which creates an explicit, user-named first pocket atomically
-- instead.
-- ---------------------------------------------------------------------

drop trigger if exists wallets_after_insert_create_default_pocket on public.wallets;
drop function if exists public.create_default_pocket();

-- ---------------------------------------------------------------------
-- 3. Remove the partial unique index (0006) and the column itself (0006).
-- ---------------------------------------------------------------------

drop index if exists public.pockets_one_default_per_wallet_idx;

alter table public.pockets drop column if exists is_default;

-- ---------------------------------------------------------------------
-- 4. Atomic Wallet + first Pocket creation.
--
-- SECURITY INVOKER (the default, stated explicitly): unlike the ledger
-- RPCs (0012), wallets and pockets have never had their client INSERT
-- grant revoked, so RLS is still the live authorization boundary here —
-- this function does not need to (and must not) re-implement it by hand.
-- It runs as the calling user; the wallets_insert policy (0009) already
-- enforces PERSONAL-owner-is-self / HOUSEHOLD-caller-is-member, and
-- pockets_insert (0009) already enforces "the wallet this pocket is
-- being added to is one the caller can access" — which trivially holds
-- here since the wallet row was just inserted, in the same transaction,
-- by this same caller. If either insert is rejected by RLS or a
-- constraint, the whole function's effects roll back — a Postgres
-- function body is one transaction — so a Wallet can never be left behind
-- with zero Pockets because the second insert failed.
--
-- created_by is taken from auth.uid(), never from a parameter, matching
-- every other write path in this schema (see 0012's comments on why).
-- ---------------------------------------------------------------------

create function public.create_wallet_with_first_pocket(
  p_scope public.money_scope,
  p_owner_user_id uuid,
  p_household_id uuid,
  p_name text,
  p_wallet_type public.wallet_type,
  p_currency text,
  p_first_pocket_name text
)
returns public.wallets
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_wallet public.wallets%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if btrim(coalesce(p_first_pocket_name, '')) = '' then
    raise exception 'First pocket name is required' using errcode = '22023';
  end if;

  insert into public.wallets (scope, owner_user_id, household_id, name, wallet_type, currency, created_by)
  values (p_scope, p_owner_user_id, p_household_id, p_name, p_wallet_type, p_currency, auth.uid())
  returning * into v_wallet;

  insert into public.pockets (wallet_id, name, sort_order)
  values (v_wallet.id, btrim(p_first_pocket_name), 0);

  return v_wallet;
end;
$$;

comment on function public.create_wallet_with_first_pocket(public.money_scope, uuid, uuid, text, public.wallet_type, text, text) is
  'Atomically creates a wallet and its first (ordinary, non-default) pocket. Replaces the old auto-"Main" trigger. Authorization comes entirely from the existing wallets_insert/pockets_insert RLS policies (SECURITY INVOKER) — this function adds no privilege of its own.';

revoke execute on function public.create_wallet_with_first_pocket(public.money_scope, uuid, uuid, text, public.wallet_type, text, text) from public, anon;
grant execute on function public.create_wallet_with_first_pocket(public.money_scope, uuid, uuid, text, public.wallet_type, text, text) to authenticated;
