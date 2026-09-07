-- 0013_ledger_relationship_validation.sql
-- Milestone 1 hardening pass, item 2.
--
-- transaction_entries_validate_pocket (0008) already checks that a entry's
-- pocket belongs to its wallet. It does NOT check that the wallet itself
-- is compatible with the parent transaction's scope/owner/household. In
-- theory the only writers are the RPCs in 0012, which derive the wallet
-- from the same source they derive scope/owner/household from, so this
-- mismatch cannot currently happen — but this trigger is defense-in-depth,
-- not the primary control: if a future code path ever writes
-- transaction_entries some other way, this makes "a PERSONAL transaction
-- with an entry on a HOUSEHOLD wallet" (or vice versa) impossible at the
-- data layer, not just unlikely in the current call graph.

create function public.transaction_entries_validate_wallet_scope()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_transaction public.transactions%rowtype;
  v_wallet public.wallets%rowtype;
begin
  select * into v_transaction from public.transactions where id = new.transaction_id;
  if not found then
    raise exception 'Transaction % does not exist', new.transaction_id using errcode = '23503';
  end if;

  select * into v_wallet from public.wallets where id = new.wallet_id;
  if not found then
    raise exception 'Wallet % does not exist', new.wallet_id using errcode = '23503';
  end if;

  if v_transaction.scope = 'PERSONAL' then
    if v_wallet.scope <> 'PERSONAL' or v_wallet.owner_user_id <> v_transaction.owner_user_id then
      raise exception 'Entry wallet % is not the PERSONAL owner''s wallet for transaction %', new.wallet_id, new.transaction_id
        using errcode = '23514';
    end if;
  else
    if v_wallet.scope <> 'HOUSEHOLD' or v_wallet.household_id <> v_transaction.household_id then
      raise exception 'Entry wallet % does not belong to the HOUSEHOLD of transaction %', new.wallet_id, new.transaction_id
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

comment on function public.transaction_entries_validate_wallet_scope() is
  'Defense-in-depth: rejects an entry whose wallet scope/owner/household is incompatible with its parent transaction. Normal writes (0012 RPCs) can never produce this; this trigger guarantees it stays impossible even if a future write path is added carelessly.';

create trigger transaction_entries_before_insert_validate_wallet_scope
  before insert or update of wallet_id, transaction_id on public.transaction_entries
  for each row execute function public.transaction_entries_validate_wallet_scope();
