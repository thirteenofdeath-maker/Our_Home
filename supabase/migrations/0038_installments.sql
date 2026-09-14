-- Phase I: Installment plans. Plan/unpaid occurrence = zero ledger effect.
-- V1 payments equal their expected snapshot; final installment absorbs cents remainder.
create table public.installment_plans(
 id uuid primary key default gen_random_uuid(), scope public.money_scope not null,
 owner_user_id uuid references public.profiles(id), household_id uuid references public.households(id),
 name text not null check(btrim(name)<>''), total_amount numeric(14,2) not null check(total_amount>0),
 currency text not null check(currency~'^[A-Z]{3}$'), installment_count int not null check(installment_count>0 and installment_count<=600),
 start_date date not null, interval_months int not null default 1 check(interval_months>0),
 wallet_id uuid references public.wallets(id), pocket_id uuid references public.pockets(id), category_id uuid not null references public.categories(id),
 title text,note text,archived_at timestamptz,created_by uuid not null references public.profiles(id),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 constraint installment_plans_scope_chk check((scope='PERSONAL' and owner_user_id is not null and household_id is null)or(scope='HOUSEHOLD' and household_id is not null and owner_user_id is null)),
 constraint installment_plans_pocket_chk check(pocket_id is null or wallet_id is not null)
);
create index installment_plans_owner_idx on public.installment_plans(owner_user_id) where owner_user_id is not null;
create index installment_plans_household_idx on public.installment_plans(household_id) where household_id is not null;
create trigger installment_plans_updated before update on public.installment_plans for each row execute function public.set_updated_at();
create trigger installment_plans_identity before update on public.installment_plans for each row execute function public.prevent_immutable_column_changes('scope','owner_user_id','household_id','created_by','currency');

create function public.installment_plans_validate() returns trigger language plpgsql security invoker set search_path=public as $$
declare c public.categories%rowtype;w public.wallets%rowtype;p public.pockets%rowtype;
begin
 select * into c from public.categories where id=new.category_id;
 if not found or c.transaction_type::text<>'EXPENSE' or c.archived_at is not null or (not c.is_system and(c.scope<>new.scope or c.owner_user_id is distinct from new.owner_user_id or c.household_id is distinct from new.household_id)) then raise exception 'Invalid installment Category' using errcode='23514';end if;
 if new.wallet_id is not null then select * into w from public.wallets where id=new.wallet_id;if not found or w.is_archived or w.currency<>new.currency or w.scope<>new.scope or w.owner_user_id is distinct from new.owner_user_id or w.household_id is distinct from new.household_id then raise exception 'Invalid installment Wallet' using errcode='23514';end if;end if;
 if new.pocket_id is not null then select * into p from public.pockets where id=new.pocket_id;if not found or p.is_archived or p.wallet_id is distinct from new.wallet_id then raise exception 'Invalid installment Pocket' using errcode='23514';end if;end if;
 return new;
end $$;
create trigger installment_plans_validate_before before insert or update of wallet_id,pocket_id,category_id,scope,owner_user_id,household_id,currency on public.installment_plans for each row execute function public.installment_plans_validate();
alter table public.installment_plans enable row level security;
create policy installment_plans_select on public.installment_plans for select using((scope='PERSONAL' and owner_user_id=auth.uid())or(scope='HOUSEHOLD' and public.is_household_member(household_id)));
create policy installment_plans_insert on public.installment_plans for insert with check(created_by=auth.uid()and((scope='PERSONAL' and owner_user_id=auth.uid())or(scope='HOUSEHOLD' and public.is_household_member(household_id))));
create policy installment_plans_update on public.installment_plans for update using((scope='PERSONAL' and owner_user_id=auth.uid())or(scope='HOUSEHOLD' and public.is_household_member(household_id))) with check((scope='PERSONAL' and owner_user_id=auth.uid())or(scope='HOUSEHOLD' and public.is_household_member(household_id)));
revoke all on public.installment_plans from anon,authenticated;grant select,insert,update on public.installment_plans to authenticated;

create table public.installment_occurrences(
 id uuid primary key default gen_random_uuid(),plan_id uuid not null references public.installment_plans(id) on delete restrict,
 sequence_number int not null check(sequence_number>0),due_date date not null,expected_amount numeric(14,2) not null check(expected_amount>0),
 status text not null default 'OPEN' check(status in('OPEN','PAID')),paid_transaction_id uuid references public.transactions(id),paid_at timestamptz,created_at timestamptz not null default now(),
 constraint installment_occurrences_state_chk check((status='OPEN' and paid_transaction_id is null and paid_at is null)or(status='PAID' and paid_transaction_id is not null and paid_at is not null)),
 unique(plan_id,sequence_number),unique(plan_id,due_date)
);
create unique index installment_occurrences_paid_idx on public.installment_occurrences(paid_transaction_id) where paid_transaction_id is not null;
create index installment_occurrences_open_due_idx on public.installment_occurrences(due_date) where status='OPEN';
alter table public.installment_occurrences enable row level security;
create policy installment_occurrences_select on public.installment_occurrences for select using(exists(select 1 from public.installment_plans p where p.id=plan_id and((p.scope='PERSONAL' and p.owner_user_id=auth.uid())or(p.scope='HOUSEHOLD' and public.is_household_member(p.household_id)))));
revoke all on public.installment_occurrences from anon,authenticated;grant select on public.installment_occurrences to authenticated;

create function public.generate_installment_occurrences() returns trigger language plpgsql security definer set search_path='' as $$
declare i int;base numeric(14,2);part numeric(14,2);due date;
begin
 base:=trunc((new.total_amount*100)/new.installment_count)/100;due:=new.start_date;
 for i in 1..new.installment_count loop
  part:=case when i=new.installment_count then new.total_amount-(base*(new.installment_count-1)) else base end;
  insert into public.installment_occurrences(plan_id,sequence_number,due_date,expected_amount)values(new.id,i,due,part);
  due:=public.recurring_next_due_date(due,new.start_date,'MONTHLY',new.interval_months,extract(day from new.start_date)::int);
 end loop;return new;
end $$;
create trigger installment_plans_generate after insert on public.installment_plans for each row execute function public.generate_installment_occurrences();

-- V1 deliberately freezes schedule/total after creation. Defaults remain editable.
create trigger installment_plans_freeze_schedule before update on public.installment_plans for each row when(old.total_amount is distinct from new.total_amount or old.installment_count is distinct from new.installment_count or old.start_date is distinct from new.start_date or old.interval_months is distinct from new.interval_months) execute function public.prevent_immutable_column_changes('total_amount','installment_count','start_date','interval_months');

create function public.pay_installment_occurrence(p_occurrence_id uuid,p_wallet_id uuid,p_pocket_id uuid,p_category_id uuid,p_amount numeric,p_title text default null,p_note text default null,p_occurred_at timestamptz default null,p_tag_ids uuid[] default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare o public.installment_occurrences%rowtype;p public.installment_plans%rowtype;w public.wallets%rowtype;tid uuid;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='28000';end if;
 select * into o from public.installment_occurrences where id=p_occurrence_id for update;if not found then raise exception 'Installment not found' using errcode='P0002';end if;
 select * into p from public.installment_plans where id=o.plan_id;
 if not((p.scope='PERSONAL' and p.owner_user_id=auth.uid())or(p.scope='HOUSEHOLD' and public.is_household_member(p.household_id)))then raise exception 'Not authorized' using errcode='42501';end if;
 if o.status<>'OPEN' then raise exception 'Installment already paid' using errcode='23514';end if;
 if p_amount<>o.expected_amount then raise exception 'V1 payment must equal expected installment amount' using errcode='23514';end if;
 select * into w from public.wallets where id=p_wallet_id;if not found or w.is_archived or w.currency<>p.currency or w.scope<>p.scope or w.owner_user_id is distinct from p.owner_user_id or w.household_id is distinct from p.household_id then raise exception 'Payment Wallet scope/currency mismatch' using errcode='23514';end if;
 tid:=public.create_income_expense_transaction('EXPENSE',p_wallet_id,p_pocket_id,p_category_id,p_amount,p_title,p_note,coalesce(p_occurred_at,now()),p_tag_ids);
 update public.installment_occurrences set status='PAID',paid_transaction_id=tid,paid_at=now() where id=o.id;return tid;
end $$;
revoke execute on function public.pay_installment_occurrence(uuid,uuid,uuid,uuid,numeric,text,text,timestamptz,uuid[]) from public,anon;grant execute on function public.pay_installment_occurrence(uuid,uuid,uuid,uuid,numeric,text,text,timestamptz,uuid[]) to authenticated;
