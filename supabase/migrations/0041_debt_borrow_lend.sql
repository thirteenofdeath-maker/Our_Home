-- Phase K: cash-linked debt events. Principal uses explicit DEBT_PRINCIPAL
-- ledger transaction, excluded from Income/Expense by existing report filters.
create table public.debt_accounts(
 id uuid primary key default gen_random_uuid(),scope public.money_scope not null,owner_user_id uuid references public.profiles(id),household_id uuid references public.households(id),
 debt_type text not null check(debt_type in('LIABILITY','RECEIVABLE')),name text not null check(btrim(name)<>''),counterparty text,
 currency text not null check(currency~'^[A-Z]{3}$'),apr numeric(8,4) check(apr is null or apr>=0),due_date date,note text,archived_at timestamptz,
 created_by uuid not null references public.profiles(id),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 constraint debt_accounts_scope_chk check((scope='PERSONAL' and owner_user_id is not null and household_id is null)or(scope='HOUSEHOLD' and household_id is not null and owner_user_id is null))
);
create index debt_accounts_owner_idx on public.debt_accounts(owner_user_id)where owner_user_id is not null;create index debt_accounts_household_idx on public.debt_accounts(household_id)where household_id is not null;
create trigger debt_accounts_updated before update on public.debt_accounts for each row execute function public.set_updated_at();
create trigger debt_accounts_identity before update on public.debt_accounts for each row execute function public.prevent_immutable_column_changes('scope','owner_user_id','household_id','debt_type','currency','created_by');
alter table public.debt_accounts enable row level security;
create policy debt_accounts_select on public.debt_accounts for select using((scope='PERSONAL'and owner_user_id=auth.uid())or(scope='HOUSEHOLD'and public.is_household_member(household_id)));
create policy debt_accounts_update on public.debt_accounts for update using((scope='PERSONAL'and owner_user_id=auth.uid())or(scope='HOUSEHOLD'and public.is_household_member(household_id)))with check((scope='PERSONAL'and owner_user_id=auth.uid())or(scope='HOUSEHOLD'and public.is_household_member(household_id)));
revoke all on public.debt_accounts from anon,authenticated;grant select,update on public.debt_accounts to authenticated;

create table public.debt_events(
 id uuid primary key default gen_random_uuid(),debt_account_id uuid not null references public.debt_accounts(id)on delete restrict,
 event_kind text not null check(event_kind in('DRAW','PRINCIPAL_REPAYMENT','DISBURSEMENT','PRINCIPAL_RECEIPT')),
 principal_amount numeric(14,2) not null check(principal_amount>0),principal_transaction_id uuid not null unique references public.transactions(id),
 interest_transaction_id uuid unique references public.transactions(id),created_by uuid not null references public.profiles(id),created_at timestamptz not null default now()
);
create index debt_events_account_idx on public.debt_events(debt_account_id,created_at);
alter table public.debt_events enable row level security;
create policy debt_events_select on public.debt_events for select using(exists(select 1 from public.debt_accounts d where d.id=debt_account_id and((d.scope='PERSONAL'and d.owner_user_id=auth.uid())or(d.scope='HOUSEHOLD'and public.is_household_member(d.household_id)))));
revoke all on public.debt_events from anon,authenticated;grant select on public.debt_events to authenticated;

create function public.debt_outstanding(p_debt_id uuid)returns numeric language sql security invoker stable set search_path='' as $$
 select coalesce(sum(case when e.event_kind in('DRAW','DISBURSEMENT') then e.principal_amount else -e.principal_amount end)filter(where t.deleted_at is null),0)
 from public.debt_events e join public.transactions t on t.id=e.principal_transaction_id where e.debt_account_id=p_debt_id
$$;
grant execute on function public.debt_outstanding(uuid)to authenticated;

create function public.get_debt_summary(p_scope public.money_scope,p_household_id uuid default null)
returns table(id uuid,scope public.money_scope,household_id uuid,debt_type text,name text,counterparty text,currency text,apr numeric,due_date date,note text,archived_at timestamptz,outstanding numeric)
language sql security invoker stable set search_path='' as $$
 select d.id,d.scope,d.household_id,d.debt_type,d.name,d.counterparty,d.currency,d.apr,d.due_date,d.note,d.archived_at,
 coalesce(sum(case when e.event_kind in('DRAW','DISBURSEMENT')then e.principal_amount else -e.principal_amount end)filter(where t.deleted_at is null),0)
 from public.debt_accounts d left join public.debt_events e on e.debt_account_id=d.id left join public.transactions t on t.id=e.principal_transaction_id
 where d.scope=p_scope and(p_scope='PERSONAL'or d.household_id=p_household_id)
 group by d.id order by(d.archived_at is not null),d.created_at;
$$;
revoke execute on function public.get_debt_summary(public.money_scope,uuid)from public,anon;grant execute on function public.get_debt_summary(public.money_scope,uuid)to authenticated;

create function public.create_debt_principal_transaction(p_debt public.debt_accounts,p_wallet_id uuid,p_pocket_id uuid,p_amount numeric,p_cash_sign int,p_title text,p_note text,p_occurred_at timestamptz)
returns uuid language plpgsql security invoker set search_path='' as $$
declare w public.wallets%rowtype;tid uuid;
begin
 select * into w from public.wallets where id=p_wallet_id;
 if not found or not public.is_wallet_authorized(p_wallet_id)or w.is_archived or w.currency<>p_debt.currency or w.scope<>p_debt.scope or w.owner_user_id is distinct from p_debt.owner_user_id or w.household_id is distinct from p_debt.household_id then raise exception 'Debt Wallet scope/currency mismatch'using errcode='23514';end if;
 if p_amount<=0 then raise exception 'Amount must be positive'using errcode='22023';end if;
 insert into public.transactions(scope,owner_user_id,household_id,transaction_type,category_id,title,note,occurred_at,created_by)values(w.scope,w.owner_user_id,w.household_id,'DEBT_PRINCIPAL',null,p_title,p_note,coalesce(p_occurred_at,now()),auth.uid())returning id into tid;
 insert into public.transaction_entries(transaction_id,wallet_id,pocket_id,amount)values(tid,p_wallet_id,p_pocket_id,p_amount*p_cash_sign);return tid;
end $$;
revoke execute on function public.create_debt_principal_transaction(public.debt_accounts,uuid,uuid,numeric,int,text,text,timestamptz)from public,anon,authenticated;

create function public.create_debt_account(p_scope public.money_scope,p_household_id uuid,p_debt_type text,p_name text,p_counterparty text,p_currency text,p_opening_principal numeric,p_wallet_id uuid,p_pocket_id uuid,p_apr numeric default null,p_due_date date default null,p_note text default null,p_occurred_at timestamptz default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare d public.debt_accounts%rowtype;tid uuid;kind text;sgn int;
begin
 if auth.uid()is null then raise exception 'Authentication required'using errcode='28000';end if;
 if p_scope='HOUSEHOLD'and(p_household_id is null or not public.is_household_member(p_household_id))then raise exception 'Not authorized'using errcode='42501';end if;
 insert into public.debt_accounts(scope,owner_user_id,household_id,debt_type,name,counterparty,currency,apr,due_date,note,created_by)values(p_scope,case when p_scope='PERSONAL'then auth.uid()end,case when p_scope='HOUSEHOLD'then p_household_id end,p_debt_type,btrim(p_name),nullif(btrim(p_counterparty),''),upper(p_currency),p_apr,p_due_date,p_note,auth.uid())returning * into d;
 kind:=case when p_debt_type='LIABILITY'then'DRAW'else'DISBURSEMENT'end;sgn:=case when p_debt_type='LIABILITY'then 1 else -1 end;
 tid:=public.create_debt_principal_transaction(d,p_wallet_id,p_pocket_id,p_opening_principal,sgn,p_name,p_note,p_occurred_at);
 insert into public.debt_events(debt_account_id,event_kind,principal_amount,principal_transaction_id,created_by)values(d.id,kind,p_opening_principal,tid,auth.uid());return d.id;
end $$;
revoke execute on function public.create_debt_account(public.money_scope,uuid,text,text,text,text,numeric,uuid,uuid,numeric,date,text,timestamptz)from public,anon;grant execute on function public.create_debt_account(public.money_scope,uuid,text,text,text,text,numeric,uuid,uuid,numeric,date,text,timestamptz)to authenticated;

create function public.record_debt_payment(p_debt_id uuid,p_wallet_id uuid,p_pocket_id uuid,p_principal numeric,p_interest numeric,p_interest_category_id uuid,p_title text default null,p_note text default null,p_occurred_at timestamptz default null,p_tag_ids uuid[] default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare d public.debt_accounts%rowtype;principal_tid uuid;interest_tid uuid;outstanding numeric;kind text;sgn int;interest_type public.transaction_type;
begin
 select * into d from public.debt_accounts where id=p_debt_id for update;if not found then raise exception 'Debt not found'using errcode='P0002';end if;
 if not((d.scope='PERSONAL'and d.owner_user_id=auth.uid())or(d.scope='HOUSEHOLD'and public.is_household_member(d.household_id)))then raise exception 'Not authorized'using errcode='42501';end if;
 if d.archived_at is not null then raise exception 'Debt is archived'using errcode='23514';end if;
 if coalesce(p_interest,0)<0 then raise exception 'Interest cannot be negative'using errcode='22023';end if;
 outstanding:=public.debt_outstanding(d.id);if p_principal<=0 or p_principal>outstanding then raise exception 'Principal exceeds outstanding'using errcode='23514';end if;
 kind:=case when d.debt_type='LIABILITY'then'PRINCIPAL_REPAYMENT'else'PRINCIPAL_RECEIPT'end;sgn:=case when d.debt_type='LIABILITY'then -1 else 1 end;
 principal_tid:=public.create_debt_principal_transaction(d,p_wallet_id,p_pocket_id,p_principal,sgn,p_title,p_note,p_occurred_at);
 if coalesce(p_interest,0)>0 then interest_type:=case when d.debt_type='LIABILITY'then'EXPENSE'else'INCOME'end;interest_tid:=public.create_income_expense_transaction(interest_type,p_wallet_id,p_pocket_id,p_interest_category_id,p_interest,p_title,p_note,p_occurred_at,p_tag_ids);end if;
 insert into public.debt_events(debt_account_id,event_kind,principal_amount,principal_transaction_id,interest_transaction_id,created_by)values(d.id,kind,p_principal,principal_tid,interest_tid,auth.uid());return principal_tid;
end $$;
revoke execute on function public.record_debt_payment(uuid,uuid,uuid,numeric,numeric,uuid,text,text,timestamptz,uuid[])from public,anon;grant execute on function public.record_debt_payment(uuid,uuid,uuid,numeric,numeric,uuid,text,text,timestamptz,uuid[])to authenticated;

-- Additional borrowing/lending is another explicit principal cash event. It
-- never appears as Income or Expense and never mutates a cached debt balance.
create function public.record_additional_debt_principal(p_debt_id uuid,p_wallet_id uuid,p_pocket_id uuid,p_principal numeric,p_title text default null,p_note text default null,p_occurred_at timestamptz default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare d public.debt_accounts%rowtype;principal_tid uuid;kind text;sgn int;
begin
 select * into d from public.debt_accounts where id=p_debt_id for update;if not found then raise exception 'Debt not found'using errcode='P0002';end if;
 if not((d.scope='PERSONAL'and d.owner_user_id=auth.uid())or(d.scope='HOUSEHOLD'and public.is_household_member(d.household_id)))then raise exception 'Not authorized'using errcode='42501';end if;
 if d.archived_at is not null then raise exception 'Debt is archived'using errcode='23514';end if;
 kind:=case when d.debt_type='LIABILITY'then'DRAW'else'DISBURSEMENT'end;sgn:=case when d.debt_type='LIABILITY'then 1 else -1 end;
 principal_tid:=public.create_debt_principal_transaction(d,p_wallet_id,p_pocket_id,p_principal,sgn,p_title,p_note,p_occurred_at);
 insert into public.debt_events(debt_account_id,event_kind,principal_amount,principal_transaction_id,created_by)values(d.id,kind,p_principal,principal_tid,auth.uid());return principal_tid;
end $$;
revoke execute on function public.record_additional_debt_principal(uuid,uuid,uuid,numeric,text,text,timestamptz)from public,anon;grant execute on function public.record_additional_debt_principal(uuid,uuid,uuid,numeric,text,text,timestamptz)to authenticated;

-- Keep compound principal+interest correction atomic even when Phase B's
-- generic void/restore entry point is used on either linked transaction.
create function public.sync_debt_event_void_state()returns trigger language plpgsql security definer set search_path='' as $$
declare e public.debt_events%rowtype;partner uuid;
begin
 if new.deleted_at is not distinct from old.deleted_at or pg_trigger_depth()>1 then return new;end if;
 select * into e from public.debt_events where principal_transaction_id=new.id or interest_transaction_id=new.id;
 if not found then return new;end if;
 partner:=case when e.principal_transaction_id=new.id then e.interest_transaction_id else e.principal_transaction_id end;
 if partner is not null then
  if new.deleted_at is not null and public.get_expense_adjustment_total(partner)>0 then raise exception 'Void linked refunds/reimbursements first'using errcode='23514';end if;
  update public.transactions set deleted_at=new.deleted_at,voided_by=new.voided_by,void_reason=new.void_reason where id=partner;
 end if;return new;
end $$;
create trigger transactions_sync_debt_void after update of deleted_at on public.transactions for each row execute function public.sync_debt_event_void_state();
