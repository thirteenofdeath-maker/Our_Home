-- 0006_pockets.sql
-- A Pocket is an allocation of money within a wallet ("which portion of
-- this wallet is this money currently sitting in"). It is NOT a category,
-- NOT a budget, and NOT a saving goal. It intentionally has no scope/
-- ownership columns of its own — it inherits them through wallet_id.

create table public.pockets (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid not null references public.wallets (id) on delete cascade,
  name text not null,
  icon text,
  sort_order integer not null default 0,
  is_default boolean not null default false,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.pockets is
  'Allocation of money within a wallet. Scope/ownership is inherited via wallet_id, not duplicated here.';

create index pockets_wallet_id_idx on public.pockets (wallet_id);

-- Exactly one default pocket per wallet, enforced at the database level.
create unique index pockets_one_default_per_wallet_idx
  on public.pockets (wallet_id)
  where is_default;

create trigger pockets_set_updated_at
  before update on public.pockets
  for each row execute function public.set_updated_at();

-- Every wallet gets a default "Main" pocket automatically on creation.
create function public.create_default_pocket()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  insert into public.pockets (wallet_id, name, is_default, sort_order)
  values (new.id, 'Main', true, 0);
  return new;
end;
$$;

comment on function public.create_default_pocket() is
  'AFTER INSERT trigger on wallets: creates the mandatory default "Main" pocket for every new wallet.';

create trigger wallets_after_insert_create_default_pocket
  after insert on public.wallets
  for each row execute function public.create_default_pocket();
