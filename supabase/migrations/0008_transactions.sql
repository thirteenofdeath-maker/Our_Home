-- 0008_transactions.sql
-- The money ledger. transactions is the header (what/when/why);
-- transaction_entries is the actual signed money movement. Balances are
-- always SUM(transaction_entries.amount) — never a stored column.

create type public.transaction_type as enum ('INCOME', 'EXPENSE', 'TRANSFER');

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  scope public.money_scope not null,
  owner_user_id uuid references public.profiles (id),
  household_id uuid references public.households (id),
  transaction_type public.transaction_type not null,
  category_id uuid references public.categories (id),
  title text,
  note text,
  occurred_at timestamptz not null default now(),
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint transactions_scope_ownership_chk check (
    (scope = 'PERSONAL' and owner_user_id is not null and household_id is null)
    or
    (scope = 'HOUSEHOLD' and household_id is not null and owner_user_id is null)
  ),
  constraint transactions_transfer_no_category_chk check (
    (transaction_type = 'TRANSFER' and category_id is null)
    or
    (transaction_type <> 'TRANSFER')
  )
);

comment on table public.transactions is
  'Transaction header. A TRANSFER is not income or expense and always has category_id = NULL.';
comment on column public.transactions.deleted_at is
  'Void marker. Set instead of DELETE so financial history and audit trails survive corrections.';

create index transactions_owner_user_id_idx on public.transactions (owner_user_id) where owner_user_id is not null;
create index transactions_household_id_idx on public.transactions (household_id) where household_id is not null;
create index transactions_category_id_idx on public.transactions (category_id) where category_id is not null;
create index transactions_occurred_at_idx on public.transactions (occurred_at desc);

create trigger transactions_set_updated_at
  before update on public.transactions
  for each row execute function public.set_updated_at();

create table public.transaction_entries (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.transactions (id) on delete cascade,
  wallet_id uuid not null references public.wallets (id),
  pocket_id uuid not null references public.pockets (id),
  amount numeric(14, 2) not null,
  created_at timestamptz not null default now(),
  constraint transaction_entries_amount_nonzero_chk check (amount <> 0)
);

comment on table public.transaction_entries is
  'Signed ledger line. INCOME: +amount. EXPENSE: -amount. TRANSFER: one -amount and one +amount entry that sum to zero.';

create index transaction_entries_transaction_id_idx on public.transaction_entries (transaction_id);
create index transaction_entries_wallet_id_idx on public.transaction_entries (wallet_id);
create index transaction_entries_pocket_id_idx on public.transaction_entries (pocket_id);

-- An entry's pocket must actually belong to its wallet — otherwise a
-- transfer could claim to move money in/out of a pocket that isn't even
-- part of the stated wallet.
create function public.transaction_entries_validate_pocket()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_pocket_wallet_id uuid;
begin
  select wallet_id into v_pocket_wallet_id from public.pockets where id = new.pocket_id;

  if v_pocket_wallet_id is null then
    raise exception 'Pocket % does not exist', new.pocket_id using errcode = '23503';
  end if;

  if v_pocket_wallet_id <> new.wallet_id then
    raise exception 'Pocket % does not belong to wallet %', new.pocket_id, new.wallet_id
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger transaction_entries_before_insert_validate
  before insert or update of wallet_id, pocket_id on public.transaction_entries
  for each row execute function public.transaction_entries_validate_pocket();
