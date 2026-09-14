-- 0017_default_pocket_invariant.sql
-- Milestone 1 hardening pass, item 7.
--
-- pockets_one_default_per_wallet_idx (0006) is a partial unique index on
-- (wallet_id) WHERE is_default — it guarantees AT MOST one default pocket
-- per wallet (you cannot INSERT/UPDATE a second one in), but says nothing
-- about a wallet ending up with ZERO default pockets, which is just as
-- broken for the app (there is no pocket left to pre-select as the
-- default target for a new transaction). docs/DOMAIN_RULES.md previously
-- overstated this as "exactly one" — corrected in this pass.
--
-- Fix: while there is no dedicated "reassign the default pocket" RPC yet,
-- normal authenticated clients simply cannot unset is_default on the
-- current default, and cannot archive it either. A future RPC that
-- atomically moves is_default from one pocket to another (unset + set in
-- the same statement) can bypass this by doing both in one trigger-visible
-- transaction — but building that RPC now, with no UI need for it yet,
-- would be exactly the kind of feature this Milestone should not add.

create function public.pockets_protect_default()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if old.is_default and not new.is_default then
    raise exception 'Cannot unset the default pocket directly; every wallet must keep exactly one default pocket'
      using errcode = '23514';
  end if;

  if old.is_default and new.is_archived and not old.is_archived then
    raise exception 'Cannot archive the default pocket; every wallet must keep exactly one active default pocket'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

comment on function public.pockets_protect_default() is
  'Makes "at most one default pocket" (0006 unique index) also mean "never zero": the mandatory default pocket cannot be unset or archived by a normal client.';

create trigger pockets_before_update_protect_default
  before update on public.pockets
  for each row execute function public.pockets_protect_default();
