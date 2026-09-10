-- Phase O: import logical transactions through existing writer. One RPC call
-- makes each confirmed batch atomic; fingerprints prevent repeat imports.
create table public.finance_import_fingerprints(
 id uuid primary key default gen_random_uuid(),created_by uuid not null references public.profiles(id),fingerprint text not null,
 transaction_id uuid not null references public.transactions(id),created_at timestamptz not null default now(),unique(created_by,fingerprint)
);
alter table public.finance_import_fingerprints enable row level security;
create policy finance_import_fingerprints_select on public.finance_import_fingerprints for select using(created_by=auth.uid());
revoke all on public.finance_import_fingerprints from anon,authenticated;grant select on public.finance_import_fingerprints to authenticated;
create function public.import_finance_transactions(p_rows jsonb)returns integer language plpgsql security definer set search_path='' as $$
declare row jsonb;tid uuid;fp text;count integer:=0;
begin
 if auth.uid()is null then raise exception 'Authentication required'using errcode='28000';end if;
 if jsonb_typeof(p_rows)<>'array'or jsonb_array_length(p_rows)>500 then raise exception 'Invalid import batch'using errcode='22023';end if;
 for row in select * from jsonb_array_elements(p_rows)loop
  if row->>'type'not in('INCOME','EXPENSE')then raise exception 'Invalid import transaction type'using errcode='22023';end if;
  fp:=md5(concat_ws('|',row->>'type',row->>'walletId',row->>'pocketId',row->>'categoryId',row->>'amount',row->>'date',row->>'title',row->>'note'));
  if exists(select 1 from public.finance_import_fingerprints where created_by=auth.uid()and fingerprint=fp)then continue;end if;
  tid:=public.create_income_expense_transaction((row->>'type')::public.transaction_type,(row->>'walletId')::uuid,(row->>'pocketId')::uuid,(row->>'categoryId')::uuid,(row->>'amount')::numeric,row->>'title',row->>'note',((row->>'date')||'T12:00:00+07:00')::timestamptz,null);
  insert into public.finance_import_fingerprints(created_by,fingerprint,transaction_id)values(auth.uid(),fp,tid);count:=count+1;
 end loop;return count;
end $$;
revoke execute on function public.import_finance_transactions(jsonb)from public,anon;grant execute on function public.import_finance_transactions(jsonb)to authenticated;
