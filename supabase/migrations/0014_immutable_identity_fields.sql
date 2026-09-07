-- 0014_immutable_identity_fields.sql
-- Milestone 1 hardening pass, item 3.
--
-- RLS's wallets_update/categories_update policies check "is the caller
-- authorized for this row" using the row's CURRENT scope/owner_user_id/
-- household_id — but a plain USING/WITH CHECK policy cannot say "and none
-- of these particular columns may change value" without WITH CHECK also
-- re-deriving from OLD, which PostgREST-driven UPDATEs don't expose
-- cleanly. The straightforward, auditable fix is a trigger: whatever else
-- an UPDATE does, these specific columns may never differ from OLD to
-- NEW. transactions.UPDATE is handled separately (0012 revokes it
-- entirely — Milestone 1 has no edit/void UI, so there is nothing to
-- protect a partial-mutability rule for yet).
--
-- One generic trigger function, parameterized by column name via TG_ARGV,
-- instead of three near-identical bodies.

create function public.prevent_immutable_column_changes()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_column text;
  v_old_value text;
  v_new_value text;
begin
  foreach v_column in array tg_argv loop
    v_old_value := to_jsonb(old) ->> v_column;
    v_new_value := to_jsonb(new) ->> v_column;
    if v_old_value is distinct from v_new_value then
      raise exception '%.% is immutable and cannot be changed (from % to %)',
        tg_table_name, v_column, v_old_value, v_new_value
        using errcode = '23514';
    end if;
  end loop;
  return new;
end;
$$;

comment on function public.prevent_immutable_column_changes() is
  'Generic BEFORE UPDATE guard: raises if any of the column names passed as trigger arguments differ between OLD and NEW. Reused across wallets/pockets/categories instead of one bespoke trigger per table.';

-- Wallet: scope/owner_user_id/household_id/created_by never change after
-- creation (a wallet cannot be silently reassigned to a different owner or
-- household, or flipped between PERSONAL and HOUSEHOLD). currency is also
-- made fully immutable for Milestone 1 — see docs/DOMAIN_RULES.md; once a
-- wallet has any ledger history, changing its currency out from under
-- existing entries would make every past balance meaningless, and there is
-- no FX conversion feature to make that safe even for an empty wallet, so
-- it is simplest and safest to disallow it unconditionally.
create trigger wallets_prevent_identity_changes
  before update on public.wallets
  for each row execute function public.prevent_immutable_column_changes('scope', 'owner_user_id', 'household_id', 'created_by', 'currency');

-- Pocket: wallet_id never changes — a pocket cannot be moved from one
-- wallet to another after creation (that would silently rewrite which
-- wallet's balance its historical entries count toward).
create trigger pockets_prevent_wallet_reassignment
  before update on public.pockets
  for each row execute function public.prevent_immutable_column_changes('wallet_id');

-- Category: scope/owner_user_id/household_id/created_by/is_system never
-- change after creation. parent_id and transaction_type remain mutable
-- (re-parenting is a supported UI operation) but are still validated by
-- categories_validate_hierarchy (0007, extended in 0018) on every change.
create trigger categories_prevent_identity_changes
  before update on public.categories
  for each row execute function public.prevent_immutable_column_changes('scope', 'owner_user_id', 'household_id', 'created_by', 'is_system');
