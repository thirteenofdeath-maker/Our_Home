-- Phase H: Bills / Due Dates. Bills and occurrences are obligations,
-- never ledger activity. Only pay_bill_occurrence creates one ordinary
-- EXPENSE through the existing authoritative writer.

create table public.bills (
  id uuid primary key default gen_random_uuid(),
  scope public.money_scope not null,
  owner_user_id uuid references public.profiles(id),
  household_id uuid references public.households(id),
  name text not null,
  amount numeric(14,2) not null,
  currency text not null,
  wallet_id uuid references public.wallets(id),
  pocket_id uuid references public.pockets(id),
  category_id uuid not null references public.categories(id),
  title text,
  note text,
  recurrence_type text not null,
  interval_count int not null default 1,
  start_date date not null,
  end_date date,
  anchor_day int generated always as (extract(day from start_date)::int) stored,
  paused_at timestamptz,
  archived_at timestamptz,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bills_scope_chk check (
    (scope='PERSONAL' and owner_user_id is not null and household_id is null) or
    (scope='HOUSEHOLD' and household_id is not null and owner_user_id is null)
  ),
  constraint bills_name_chk check (btrim(name) <> '' and char_length(name) <= 60),
  constraint bills_amount_chk check (amount > 0),
  constraint bills_currency_chk check (currency ~ '^[A-Z]{3}$'),
  constraint bills_pocket_wallet_chk check (pocket_id is null or wallet_id is not null),
  constraint bills_recurrence_chk check (recurrence_type in ('ONE_TIME','WEEKLY','MONTHLY','YEARLY')),
  constraint bills_interval_chk check (interval_count >= 1 and (recurrence_type <> 'ONE_TIME' or interval_count = 1)),
  constraint bills_end_chk check (end_date is null or end_date >= start_date)
);

create index bills_owner_idx on public.bills(owner_user_id) where owner_user_id is not null;
create index bills_household_idx on public.bills(household_id) where household_id is not null;
create index bills_active_idx on public.bills(scope, archived_at, paused_at);
create trigger bills_set_updated_at before update on public.bills for each row execute function public.set_updated_at();
create trigger bills_prevent_identity_changes before update on public.bills for each row execute function public.prevent_immutable_column_changes(
  'scope','owner_user_id','household_id','created_by','currency'
);

create function public.bills_validate_references()
returns trigger language plpgsql security invoker set search_path=public as $$
declare v_wallet public.wallets%rowtype; v_pocket public.pockets%rowtype; v_category public.categories%rowtype;
begin
  select * into v_category from public.categories where id=new.category_id;
  if not found then raise exception 'Category not found or inaccessible' using errcode='23503'; end if;
  if v_category.transaction_type::text <> 'EXPENSE' or v_category.archived_at is not null then
    raise exception 'Bill Category must be an active EXPENSE Category' using errcode='23514';
  end if;
  if not v_category.is_system and (v_category.scope<>new.scope or v_category.owner_user_id is distinct from new.owner_user_id or v_category.household_id is distinct from new.household_id) then
    raise exception 'Category scope does not match Bill' using errcode='23514';
  end if;
  if new.wallet_id is not null then
    select * into v_wallet from public.wallets where id=new.wallet_id;
    if not found then raise exception 'Wallet not found or inaccessible' using errcode='23503'; end if;
    if v_wallet.is_archived or v_wallet.currency<>new.currency or v_wallet.scope<>new.scope or v_wallet.owner_user_id is distinct from new.owner_user_id or v_wallet.household_id is distinct from new.household_id then
      raise exception 'Wallet must be active and match Bill scope/currency' using errcode='23514';
    end if;
  end if;
  if new.pocket_id is not null then
    select * into v_pocket from public.pockets where id=new.pocket_id;
    if not found or v_pocket.is_archived or v_pocket.wallet_id is distinct from new.wallet_id then
      raise exception 'Pocket must be active and belong to Bill Wallet' using errcode='23514';
    end if;
  end if;
  return new;
end $$;
create trigger bills_validate_before_write before insert or update of wallet_id,pocket_id,category_id,scope,owner_user_id,household_id,currency on public.bills for each row execute function public.bills_validate_references();

alter table public.bills enable row level security;
create policy bills_select on public.bills for select using ((scope='PERSONAL' and owner_user_id=auth.uid()) or (scope='HOUSEHOLD' and public.is_household_member(household_id)));
create policy bills_insert on public.bills for insert with check (created_by=auth.uid() and ((scope='PERSONAL' and owner_user_id=auth.uid()) or (scope='HOUSEHOLD' and public.is_household_member(household_id))));
create policy bills_update on public.bills for update using ((scope='PERSONAL' and owner_user_id=auth.uid()) or (scope='HOUSEHOLD' and public.is_household_member(household_id))) with check ((scope='PERSONAL' and owner_user_id=auth.uid()) or (scope='HOUSEHOLD' and public.is_household_member(household_id)));
revoke all on public.bills from anon,authenticated;
grant select,insert,update on public.bills to authenticated;

create table public.bill_occurrences (
  id uuid primary key default gen_random_uuid(),
  bill_id uuid not null references public.bills(id) on delete restrict,
  due_date date not null,
  expected_amount numeric(14,2) not null check(expected_amount>0),
  status text not null default 'OPEN' check(status in ('OPEN','PAID','SKIPPED')),
  paid_transaction_id uuid references public.transactions(id),
  paid_at timestamptz,
  skipped_at timestamptz,
  created_at timestamptz not null default now(),
  constraint bill_occurrences_state_chk check (
    (status='OPEN' and paid_transaction_id is null and paid_at is null and skipped_at is null) or
    (status='PAID' and paid_transaction_id is not null and paid_at is not null and skipped_at is null) or
    (status='SKIPPED' and paid_transaction_id is null and paid_at is null and skipped_at is not null)
  ),
  unique(bill_id,due_date)
);
create unique index bill_occurrences_paid_transaction_idx on public.bill_occurrences(paid_transaction_id) where paid_transaction_id is not null;
create index bill_occurrences_bill_due_idx on public.bill_occurrences(bill_id,due_date);
create index bill_occurrences_open_due_idx on public.bill_occurrences(due_date) where status='OPEN';
alter table public.bill_occurrences enable row level security;
create policy bill_occurrences_select on public.bill_occurrences for select using (exists(select 1 from public.bills b where b.id=bill_id and ((b.scope='PERSONAL' and b.owner_user_id=auth.uid()) or (b.scope='HOUSEHOLD' and public.is_household_member(b.household_id)))));
revoke all on public.bill_occurrences from anon,authenticated;
grant select on public.bill_occurrences to authenticated;

create table public.bill_tags (
  bill_id uuid not null references public.bills(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key(bill_id,tag_id)
);
create index bill_tags_tag_idx on public.bill_tags(tag_id);
alter table public.bill_tags enable row level security;
create policy bill_tags_select on public.bill_tags for select using (exists(select 1 from public.bills b where b.id=bill_id and ((b.scope='PERSONAL' and b.owner_user_id=auth.uid()) or (b.scope='HOUSEHOLD' and public.is_household_member(b.household_id)))));
revoke all on public.bill_tags from anon,authenticated;
grant select on public.bill_tags to authenticated;

create function public.set_bill_tags(p_bill_id uuid,p_tag_ids uuid[])
returns uuid language plpgsql security definer set search_path='' as $$
declare v_bill public.bills%rowtype; v_tag public.tags%rowtype; v_id uuid;
begin
  select * into v_bill from public.bills where id=p_bill_id;
  if not found or not ((v_bill.scope='PERSONAL' and v_bill.owner_user_id=auth.uid()) or (v_bill.scope='HOUSEHOLD' and public.is_household_member(v_bill.household_id))) then raise exception 'Bill not found or unauthorized' using errcode='42501'; end if;
  foreach v_id in array coalesce(p_tag_ids,'{}'::uuid[]) loop
    select * into v_tag from public.tags where id=v_id;
    if not found or v_tag.archived_at is not null or v_tag.scope<>v_bill.scope or v_tag.owner_user_id is distinct from v_bill.owner_user_id or v_tag.household_id is distinct from v_bill.household_id then raise exception 'Tag invalid for Bill' using errcode='23514'; end if;
  end loop;
  delete from public.bill_tags where bill_id=p_bill_id;
  insert into public.bill_tags(bill_id,tag_id) select p_bill_id,x from unnest(coalesce(p_tag_ids,'{}'::uuid[])) x on conflict do nothing;
  return p_bill_id;
end $$;
revoke execute on function public.set_bill_tags(uuid,uuid[]) from public,anon;
grant execute on function public.set_bill_tags(uuid,uuid[]) to authenticated;

create function public.generate_bill_occurrences_for_rule(p_bill public.bills,p_today date,p_horizon date,p_min_date date default null)
returns void language plpgsql security invoker set search_path='' as $$
declare v_candidate date:=p_bill.start_date;
begin
  loop
    exit when v_candidate>p_horizon or (p_bill.end_date is not null and v_candidate>p_bill.end_date);
    if p_min_date is null or v_candidate>=p_min_date then
      insert into public.bill_occurrences(bill_id,due_date,expected_amount) values(p_bill.id,v_candidate,p_bill.amount) on conflict(bill_id,due_date) do nothing;
    end if;
    exit when p_bill.recurrence_type='ONE_TIME';
    v_candidate:=public.recurring_next_due_date(v_candidate,p_bill.start_date,p_bill.recurrence_type,p_bill.interval_count,p_bill.anchor_day);
  end loop;
end $$;
revoke execute on function public.generate_bill_occurrences_for_rule(public.bills,date,date,date) from public,anon,authenticated;

create function public.materialize_bill_occurrences(p_scope public.money_scope,p_household_id uuid default null)
returns void language plpgsql security definer set search_path='' as $$
declare v_today date:=(now() at time zone 'Asia/Bangkok')::date; v_bill public.bills%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if p_scope='HOUSEHOLD' and (p_household_id is null or not public.is_household_member(p_household_id)) then raise exception 'Not authorized' using errcode='42501'; end if;
  for v_bill in select * from public.bills where scope=p_scope and archived_at is null and paused_at is null and ((p_scope='PERSONAL' and owner_user_id=auth.uid()) or (p_scope='HOUSEHOLD' and household_id=p_household_id)) loop
    perform public.generate_bill_occurrences_for_rule(v_bill,v_today,v_today+90,null);
  end loop;
end $$;
revoke execute on function public.materialize_bill_occurrences(public.money_scope,uuid) from public,anon;
grant execute on function public.materialize_bill_occurrences(public.money_scope,uuid) to authenticated;

create function public.bills_refresh_open_occurrences()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_today date:=(now() at time zone 'Asia/Bangkok')::date;
begin
  delete from public.bill_occurrences where bill_id=new.id and status='OPEN' and due_date>v_today;
  perform public.generate_bill_occurrences_for_rule(new,v_today,v_today+90,v_today);
  return new;
end $$;
create trigger bills_after_schedule_or_amount_change after update of amount,recurrence_type,interval_count,start_date,end_date on public.bills for each row when(old.amount is distinct from new.amount or old.recurrence_type is distinct from new.recurrence_type or old.interval_count is distinct from new.interval_count or old.start_date is distinct from new.start_date or old.end_date is distinct from new.end_date) execute function public.bills_refresh_open_occurrences();

create function public.bills_reactivate_occurrences()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_today date:=(now() at time zone 'Asia/Bangkok')::date;
begin perform public.generate_bill_occurrences_for_rule(new,v_today,v_today+90,v_today); return new; end $$;
create trigger bills_after_reactivate after update of paused_at,archived_at on public.bills for each row when(new.paused_at is null and new.archived_at is null and (old.paused_at is not null or old.archived_at is not null)) execute function public.bills_reactivate_occurrences();

create function public.skip_bill_occurrence(p_occurrence_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_occ public.bill_occurrences%rowtype; v_bill public.bills%rowtype;
begin
  select * into v_occ from public.bill_occurrences where id=p_occurrence_id for update;
  if not found then raise exception 'Bill occurrence not found' using errcode='P0002'; end if;
  select * into v_bill from public.bills where id=v_occ.bill_id;
  if not ((v_bill.scope='PERSONAL' and v_bill.owner_user_id=auth.uid()) or (v_bill.scope='HOUSEHOLD' and public.is_household_member(v_bill.household_id))) then raise exception 'Not authorized' using errcode='42501'; end if;
  if v_occ.status<>'OPEN' then raise exception 'Bill occurrence is already %',v_occ.status using errcode='23514'; end if;
  update public.bill_occurrences set status='SKIPPED',skipped_at=now() where id=p_occurrence_id;
  return p_occurrence_id;
end $$;
revoke execute on function public.skip_bill_occurrence(uuid) from public,anon;
grant execute on function public.skip_bill_occurrence(uuid) to authenticated;

create function public.pay_bill_occurrence(p_occurrence_id uuid,p_wallet_id uuid,p_pocket_id uuid,p_category_id uuid,p_amount numeric,p_title text default null,p_note text default null,p_occurred_at timestamptz default null,p_tag_ids uuid[] default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_occ public.bill_occurrences%rowtype; v_bill public.bills%rowtype; v_wallet public.wallets%rowtype; v_transaction_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='28000'; end if;
  select * into v_occ from public.bill_occurrences where id=p_occurrence_id for update;
  if not found then raise exception 'Bill occurrence not found' using errcode='P0002'; end if;
  select * into v_bill from public.bills where id=v_occ.bill_id;
  if not ((v_bill.scope='PERSONAL' and v_bill.owner_user_id=auth.uid()) or (v_bill.scope='HOUSEHOLD' and public.is_household_member(v_bill.household_id))) then raise exception 'Not authorized' using errcode='42501'; end if;
  if v_occ.status<>'OPEN' then raise exception 'Bill occurrence is already %',v_occ.status using errcode='23514'; end if;
  select * into v_wallet from public.wallets where id=p_wallet_id;
  if not found or v_wallet.is_archived or v_wallet.currency<>v_bill.currency or v_wallet.scope<>v_bill.scope or v_wallet.owner_user_id is distinct from v_bill.owner_user_id or v_wallet.household_id is distinct from v_bill.household_id then raise exception 'Payment Wallet must match Bill scope/currency' using errcode='23514'; end if;
  v_transaction_id:=public.create_income_expense_transaction('EXPENSE',p_wallet_id,p_pocket_id,p_category_id,p_amount,p_title,p_note,coalesce(p_occurred_at,now()),p_tag_ids);
  update public.bill_occurrences set status='PAID',paid_transaction_id=v_transaction_id,paid_at=now() where id=p_occurrence_id;
  return v_transaction_id;
end $$;
revoke execute on function public.pay_bill_occurrence(uuid,uuid,uuid,uuid,numeric,text,text,timestamptz,uuid[]) from public,anon;
grant execute on function public.pay_bill_occurrence(uuid,uuid,uuid,uuid,numeric,text,text,timestamptz,uuid[]) to authenticated;
