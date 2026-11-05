-- Complete the explicitly requested reset of the former income/expense/wallet system.
-- Preserve migrated household expenses and every active household module verbatim.
-- Historical table structures remain empty and revoked for a later schema removal.
do $purge$
declare
  old_tables text[]:=array[
    'credit_card_statement_allocations','credit_card_statement_resolutions',
    'credit_card_installment_occurrences','credit_card_installment_plans',
    'credit_card_statements','credit_card_liability_events',
    'bill_tags','bill_occurrences','bills','installment_occurrences','installment_plans',
    'recurring_occurrences','recurring_transaction_tags','recurring_transactions',
    'transaction_template_tags','transaction_templates','debt_events','debt_accounts',
    'saving_goals','budgets','household_expense_attributions','expense_adjustments',
    'transfer_ledger_links','transaction_attachments','transaction_tags',
    'finance_import_fingerprints','transaction_entries','transactions',
    'credit_card_accounts','pockets','wallets','categories','tags'
  ];
  active_tables text[]:=array['household_expenses','shopping_items','pets','pet_care_records',
    'pet_caregivers','inventory_items','inventory_documents','household_members','households',
    'profiles','plan_tasks','plan_task_steps','plan_reminders','calendar_events',
    'calendar_event_participants','chore_templates','chore_template_assignees','chore_occurrences'];
  table_name text; saved_triggers jsonb; item jsonb; before_state jsonb:='{}'; fingerprint text;
  remaining bigint;
begin
  if exists(select 1 from public.shopping_items where expense_transaction_id is not null)
    or exists(select 1 from public.pet_care_records where transaction_id is not null)
    or exists(select 1 from storage.objects where bucket_id='finance-attachments') then
    raise exception 'Reconcile active links or remove old receipt files through Storage before purging';
  end if;
  if exists(
    select 1 from public.transactions t
    where t.transaction_type='EXPENSE' and t.deleted_at is null
      and (t.household_id is not null or exists(select 1 from public.household_expense_attributions a where a.transaction_id=t.id))
      and not exists(select 1 from public.expense_adjustments a where a.transaction_id=t.id)
      and not exists(select 1 from public.household_expenses e where e.id=t.id)
  ) then raise exception 'An unmigrated household expense remains'; end if;
  -- Lock active records too, so a concurrent household edit cannot be mistaken for data loss.
  foreach table_name in array active_tables loop
    execute format('lock table public.%I in share mode',table_name);
    execute format('select md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text,''[]'')) from public.%I t',table_name) into fingerprint;
    before_state:=before_state||jsonb_build_object(table_name,fingerprint);
  end loop;
  foreach table_name in array old_tables loop
    execute format('lock table public.%I in access exclusive mode',table_name);
  end loop;
  select coalesce(jsonb_agg(jsonb_build_object('table',c.relname,'trigger',t.tgname,'enabled',t.tgenabled)),'[]')
    into saved_triggers from pg_trigger t join pg_class c on c.oid=t.tgrelid
    where c.relnamespace='public'::regnamespace and c.relname=any(old_tables)
      and not t.tgisinternal and t.tgenabled<>'D';
  for item in select value from jsonb_array_elements(saved_triggers) loop
    execute format('alter table public.%I disable trigger %I',item->>'table',item->>'trigger');
  end loop;
  -- Foreign-key checks stay enabled throughout. No TRUNCATE CASCADE or replica mode.
  foreach table_name in array old_tables loop
    execute format('delete from public.%I',table_name);
  end loop;
  for item in select value from jsonb_array_elements(saved_triggers) loop
    execute format('alter table public.%I enable %s trigger %I',item->>'table',
      case item->>'enabled' when 'A' then 'always' when 'R' then 'replica' else '' end,item->>'trigger');
  end loop;
  foreach table_name in array active_tables loop
    execute format('select md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text,''[]'')) from public.%I t',table_name) into fingerprint;
    if fingerprint is distinct from before_state->>table_name then
      raise exception 'Active data changed during purge: %',table_name;
    end if;
  end loop;
  foreach table_name in array old_tables loop
    execute format('select count(*) from public.%I',table_name) into remaining;
    if remaining<>0 then raise exception 'Legacy rows remain: %',table_name; end if;
  end loop;
end;
$purge$;
