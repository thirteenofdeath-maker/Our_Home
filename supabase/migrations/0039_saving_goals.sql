-- Phase J: Linked-Pocket Saving Goals. Planning/read model only; zero ledger writes.
create table public.saving_goals(
 id uuid primary key default gen_random_uuid(),scope public.money_scope not null,
 owner_user_id uuid references public.profiles(id),household_id uuid references public.households(id),
 name text not null check(btrim(name)<>'' and char_length(name)<=60),target_amount numeric(14,2) not null check(target_amount>0),
 linked_pocket_id uuid not null references public.pockets(id) on delete restrict,target_date date,note text,
 archived_at timestamptz,created_by uuid not null references public.profiles(id),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 constraint saving_goals_scope_chk check((scope='PERSONAL' and owner_user_id is not null and household_id is null)or(scope='HOUSEHOLD' and household_id is not null and owner_user_id is null))
);
create unique index saving_goals_one_active_per_pocket_idx on public.saving_goals(linked_pocket_id) where archived_at is null;
create index saving_goals_owner_idx on public.saving_goals(owner_user_id) where owner_user_id is not null;
create index saving_goals_household_idx on public.saving_goals(household_id) where household_id is not null;
create trigger saving_goals_updated before update on public.saving_goals for each row execute function public.set_updated_at();
create trigger saving_goals_identity before update on public.saving_goals for each row execute function public.prevent_immutable_column_changes('scope','owner_user_id','household_id','created_by');

create function public.saving_goals_validate_pocket()returns trigger language plpgsql security invoker set search_path=public as $$
declare p public.pockets%rowtype;w public.wallets%rowtype;
begin
 select * into p from public.pockets where id=new.linked_pocket_id;if not found then raise exception 'Pocket not found or inaccessible' using errcode='23503';end if;
 select * into w from public.wallets where id=p.wallet_id;if not found then raise exception 'Wallet not found or inaccessible' using errcode='23503';end if;
 if (tg_op='INSERT' or old.archived_at is not null and new.archived_at is null or new.linked_pocket_id is distinct from old.linked_pocket_id) and (p.is_archived or w.is_archived) then raise exception 'Active Goal requires active Pocket and Wallet' using errcode='23514';end if;
 if w.scope<>new.scope or w.owner_user_id is distinct from new.owner_user_id or w.household_id is distinct from new.household_id then raise exception 'Pocket scope does not match Goal' using errcode='23514';end if;
 return new;
end $$;
create trigger saving_goals_validate before insert or update of linked_pocket_id,archived_at,scope,owner_user_id,household_id on public.saving_goals for each row execute function public.saving_goals_validate_pocket();
alter table public.saving_goals enable row level security;
create policy saving_goals_select on public.saving_goals for select using((scope='PERSONAL' and owner_user_id=auth.uid())or(scope='HOUSEHOLD' and public.is_household_member(household_id)));
create policy saving_goals_insert on public.saving_goals for insert with check(created_by=auth.uid()and((scope='PERSONAL' and owner_user_id=auth.uid())or(scope='HOUSEHOLD' and public.is_household_member(household_id))));
create policy saving_goals_update on public.saving_goals for update using((scope='PERSONAL' and owner_user_id=auth.uid())or(scope='HOUSEHOLD' and public.is_household_member(household_id)))with check((scope='PERSONAL' and owner_user_id=auth.uid())or(scope='HOUSEHOLD' and public.is_household_member(household_id)));
revoke all on public.saving_goals from anon,authenticated;grant select,insert,update on public.saving_goals to authenticated;

create function public.get_saving_goal_progress(p_scope public.money_scope,p_household_id uuid default null)
returns table(goal_id uuid,scope public.money_scope,owner_user_id uuid,household_id uuid,name text,target_amount numeric,linked_pocket_id uuid,target_date date,note text,archived_at timestamptz,pocket_name text,pocket_archived boolean,wallet_id uuid,wallet_name text,wallet_archived boolean,currency text,progress_amount numeric,remaining_amount numeric,progress_percent numeric,is_complete boolean)
language sql security invoker set search_path='' stable as $$
 select g.id,g.scope,g.owner_user_id,g.household_id,g.name,g.target_amount,g.linked_pocket_id,g.target_date,g.note,g.archived_at,
 p.name,p.is_archived,w.id,w.name,w.is_archived,w.currency,bal.amount,greatest(g.target_amount-bal.amount,0),round((bal.amount/g.target_amount)*100,2),bal.amount>=g.target_amount
 from public.saving_goals g join public.pockets p on p.id=g.linked_pocket_id join public.wallets w on w.id=p.wallet_id
 cross join lateral (select public.get_pocket_balance(p.id) amount) bal
 where g.scope=p_scope and (p_scope='PERSONAL' or g.household_id=p_household_id)
 order by (g.archived_at is not null),g.target_date nulls last,g.created_at;
$$;
revoke execute on function public.get_saving_goal_progress(public.money_scope,uuid) from public,anon;grant execute on function public.get_saving_goal_progress(public.money_scope,uuid) to authenticated;
