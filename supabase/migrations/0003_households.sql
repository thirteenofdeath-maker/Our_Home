-- 0003_households.sql
-- A household is a group that can own shared money (wallets, categories,
-- transactions). It is deliberately generic: partners, spouses, roommates,
-- parents/children, etc. Relationship labels are a UX concern, not modeled
-- here.

create type public.household_role as enum ('owner', 'admin', 'member');

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.households is
  'A group of people who can own shared (HOUSEHOLD-scope) money. Not hard-coded to any specific relationship type.';

create trigger households_set_updated_at
  before update on public.households
  for each row execute function public.set_updated_at();
