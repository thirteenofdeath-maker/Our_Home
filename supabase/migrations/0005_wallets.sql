-- 0005_wallets.sql
-- A Wallet is a real source of money (bank account, cash, card, shared
-- household account). Balance is never stored here — see transactions /
-- transaction_entries and get_wallet_balance().

create type public.money_scope as enum ('PERSONAL', 'HOUSEHOLD');

create type public.wallet_type as enum ('BANK', 'CASH', 'CREDIT_CARD', 'E_WALLET', 'OTHER');

create table public.wallets (
  id uuid primary key default gen_random_uuid(),
  scope public.money_scope not null,
  owner_user_id uuid references public.profiles (id),
  household_id uuid references public.households (id),
  name text not null,
  wallet_type public.wallet_type not null default 'OTHER',
  currency text not null default 'THB',
  icon text,
  is_archived boolean not null default false,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wallets_scope_ownership_chk check (
    (scope = 'PERSONAL' and owner_user_id is not null and household_id is null)
    or
    (scope = 'HOUSEHOLD' and household_id is not null and owner_user_id is null)
  ),
  constraint wallets_currency_len_chk check (char_length(currency) = 3)
);

comment on table public.wallets is
  'Real source of money. Balance is derived from transaction_entries, never stored here.';
comment on constraint wallets_scope_ownership_chk on public.wallets is
  'PERSONAL wallets belong to exactly one user; HOUSEHOLD wallets belong to exactly one household. Never both, never neither.';

create index wallets_owner_user_id_idx on public.wallets (owner_user_id) where owner_user_id is not null;
create index wallets_household_id_idx on public.wallets (household_id) where household_id is not null;

create trigger wallets_set_updated_at
  before update on public.wallets
  for each row execute function public.set_updated_at();
