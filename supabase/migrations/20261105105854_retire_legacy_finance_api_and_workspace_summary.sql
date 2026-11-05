-- Retire public access to the old ledger. Preserve historical rows for a scoped purge.
-- Shared scheduling helpers (such as recurring_next_due_date) remain available.
do $migration$
declare item record;
begin
  for item in select p.oid::regprocedure as signature from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and (
      p.proname ~ '(wallet|pocket|credit_card|card_purchase|income_expense|transaction|bill|budget|saving_goal|debt|installment|finance|expense_adjustment)'
      or p.proname in ('create_attributed_household_expense','update_attributed_household_expense','get_household_attributed_expense_rows','get_household_expense_activity','create_shopping_item_expense','set_template_tags')
    )
  loop
    execute format('revoke all on function %s from public, anon, authenticated',item.signature);
  end loop;
  for item in select tablename from pg_tables where schemaname='public' and (
    tablename ~ '^(bill|budget|categor|credit_card|debt|expense_adjustment|finance_import|household_expense_attribution|installment|pocket|recurring_|saving_goal|tag|transaction|transfer_ledger|wallet)'
  ) loop
    execute format('revoke all on table public.%I from public, anon, authenticated',item.tablename);
  end loop;
end;
$migration$;
update public.notification_preferences set finance_enabled=false;

-- SECURITY INVOKER intentionally retains every underlying table's RLS.
create function public.get_plan_workspace_summary(p_household_id uuid, p_today date)
returns jsonb language sql stable security invoker set search_path='' as $$
select jsonb_build_object(
  'tasks',(select jsonb_build_object('total',count(*),'today',count(*) filter(where due_date=p_today),'overdue',count(*) filter(where not is_completed and due_date<p_today),'done',count(*) filter(where is_completed)) from public.plan_tasks where archived_at is null),
  'reminders',(select jsonb_build_object('today',count(*) filter(where (reminds_at at time zone 'Asia/Bangkok')::date=p_today),'overdue',count(*) filter(where not is_completed and (reminds_at at time zone 'Asia/Bangkok')::date<p_today),'upcoming',count(*) filter(where not is_completed and (reminds_at at time zone 'Asia/Bangkok')::date>p_today),'done',count(*) filter(where is_completed)) from public.plan_reminders where archived_at is null),
  'shopping',(select jsonb_build_object('pending',count(*) filter(where purchased_at is null),'purchased',count(*) filter(where purchased_at is not null),'assigned',count(distinct assigned_member_id) filter(where purchased_at is null),'budget',sum(estimated_amount) filter(where purchased_at is null),'currencies',count(distinct currency) filter(where purchased_at is null and estimated_amount is not null),'currency',min(currency) filter(where purchased_at is null and estimated_amount is not null)) from public.shopping_items where household_id=p_household_id and archived_at is null),
  'inventory',(select jsonb_build_object('total',count(*),'low',count(*) filter(where restock_threshold is not null and quantity<=restock_threshold),'expiry',count(*) filter(where expiry_date<=p_today+30),'warranty',count(*) filter(where warranty_expires_on<=p_today+30)) from public.inventory_items where household_id=p_household_id and archived_at is null)
);
$$;
revoke all on function public.get_plan_workspace_summary(uuid,date) from public,anon;
grant execute on function public.get_plan_workspace_summary(uuid,date) to authenticated;

create index if not exists chore_occurrences_open_due_idx on public.chore_occurrences(household_id,due_date,id) where completed_at is null;
create index if not exists chore_occurrences_history_idx on public.chore_occurrences(household_id,completed_at desc,id) where completed_at is not null;
