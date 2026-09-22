-- Explicit household-only observer write boundary. User approved read-only observers.
-- No schema-wide discovery, arbitrary SQL, profile/auth change, or data migration.
-- Existing RLS remains authoritative for all other roles and personal data.
-- Triggers also enforce this inside existing SECURITY DEFINER finance RPCs.
create schema if not exists private;

create function private.observer_row_households(p_table text, p_row jsonb)
returns setof uuid language plpgsql stable security definer set search_path = ''
as $$
declare parent_row jsonb;
begin
  case p_table
    when 'households' then return next (p_row->>'id')::uuid;
    when 'wallets' then return next (p_row->>'household_id')::uuid;
    when 'transactions' then return next (p_row->>'household_id')::uuid;
    when 'categories' then return next (p_row->>'household_id')::uuid;
    when 'tags' then return next (p_row->>'household_id')::uuid;
    when 'budgets' then return next (p_row->>'household_id')::uuid;
    when 'saving_goals' then return next (p_row->>'household_id')::uuid;
    when 'bills' then return next (p_row->>'household_id')::uuid;
    when 'installment_plans' then return next (p_row->>'household_id')::uuid;
    when 'recurring_transactions' then return next (p_row->>'household_id')::uuid;
    when 'transaction_templates' then return next (p_row->>'household_id')::uuid;
    when 'debt_accounts' then return next (p_row->>'household_id')::uuid;
    when 'household_expense_attributions' then return next (p_row->>'household_id')::uuid;
    when 'calendar_events' then return next (p_row->>'household_id')::uuid;
    when 'calendar_event_participants' then return next (p_row->>'household_id')::uuid;
    when 'plan_tasks' then return next (p_row->>'household_id')::uuid;
    when 'plan_notes' then return next (p_row->>'household_id')::uuid;
    when 'plan_reminders' then return next (p_row->>'household_id')::uuid;
    when 'pets' then return next (p_row->>'household_id')::uuid;
    when 'pet_care_records' then return next (p_row->>'household_id')::uuid;
    when 'pet_caregivers' then return next (p_row->>'household_id')::uuid;
    when 'household_members' then return next (p_row->>'household_id')::uuid;
    when 'pockets' then
      return query select household_id from public.wallets where id=(p_row->>'wallet_id')::uuid;
    when 'credit_card_accounts' then
      return query select household_id from public.wallets where id=(p_row->>'wallet_id')::uuid;
    when 'plan_task_steps' then
      return query select household_id from public.plan_tasks where id=(p_row->>'task_id')::uuid;
    when 'bill_occurrences' then
      return query select household_id from public.bills where id=(p_row->>'bill_id')::uuid;
    when 'bill_tags' then
      return query select household_id from public.bills where id=(p_row->>'bill_id')::uuid;
    when 'installment_occurrences' then
      return query select household_id from public.installment_plans where id=(p_row->>'plan_id')::uuid;
    when 'recurring_occurrences' then
      return query select household_id from public.recurring_transactions where id=(p_row->>'recurring_transaction_id')::uuid;
    when 'recurring_transaction_tags' then
      return query select household_id from public.recurring_transactions where id=(p_row->>'recurring_transaction_id')::uuid;
    when 'transaction_template_tags' then
      return query select household_id from public.transaction_templates where id=(p_row->>'template_id')::uuid;
    when 'debt_events' then
      return query select household_id from public.debt_accounts where id=(p_row->>'debt_account_id')::uuid;
    when 'expense_adjustments' then
      return query select household_id from public.transactions where id=(p_row->>'transaction_id')::uuid;
      return query select household_id from public.transactions where id=(p_row->>'original_expense_transaction_id')::uuid;
    when 'finance_import_fingerprints' then
      return query select household_id from public.transactions where id=(p_row->>'transaction_id')::uuid;
    when 'transaction_attachments' then
      return query select household_id from public.transactions where id=(p_row->>'transaction_id')::uuid;
    when 'transaction_entries' then
      return query select household_id from public.transactions where id=(p_row->>'transaction_id')::uuid;
      return query select household_id from public.wallets where id=(p_row->>'wallet_id')::uuid;
    when 'transaction_tags' then
      return query select household_id from public.transactions where id=(p_row->>'transaction_id')::uuid;
    when 'transfer_ledger_links' then
      return query select household_id from public.transactions where id=(p_row->>'charge_transaction_id')::uuid;
      return query select household_id from public.transactions where id=(p_row->>'transfer_transaction_id')::uuid;
    when 'credit_card_liability_events' then
      select to_jsonb(p) into parent_row from public.credit_card_accounts p where id=(p_row->>'card_account_id')::uuid;
      return query select * from private.observer_row_households('credit_card_accounts',parent_row);
    when 'credit_card_statements' then
      select to_jsonb(p) into parent_row from public.credit_card_accounts p where id=(p_row->>'card_account_id')::uuid;
      return query select * from private.observer_row_households('credit_card_accounts',parent_row);
    when 'credit_card_statement_resolutions' then
      select to_jsonb(p) into parent_row from public.credit_card_statements p where id=(p_row->>'statement_id')::uuid;
      return query select * from private.observer_row_households('credit_card_statements',parent_row);
    when 'credit_card_statement_allocations' then
      select to_jsonb(p) into parent_row from public.credit_card_statements p where id=(p_row->>'statement_id')::uuid;
      return query select * from private.observer_row_households('credit_card_statements',parent_row);
    when 'credit_card_installment_plans' then
      select to_jsonb(p) into parent_row from public.credit_card_accounts p where id=(p_row->>'card_account_id')::uuid;
      return query select * from private.observer_row_households('credit_card_accounts',parent_row);
    when 'credit_card_installment_occurrences' then
      select to_jsonb(p) into parent_row from public.credit_card_installment_plans p where id=(p_row->>'plan_id')::uuid;
      return query select * from private.observer_row_households('credit_card_installment_plans',parent_row);
    else raise exception 'Unknown observer guard table: %',p_table;
  end case;
end;
$$;
revoke all on function private.observer_row_households(text,jsonb) from public,anon,authenticated;

create function private.enforce_observer_read_only()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare row_data jsonb;
begin
  -- Scheduled jobs/service operations without an end-user identity retain their permissions.
  if auth.uid() is not null then
    for row_data in select value from jsonb_array_elements(
      case when tg_op='INSERT' then jsonb_build_array(to_jsonb(new))
           when tg_op='DELETE' then jsonb_build_array(to_jsonb(old))
           else jsonb_build_array(to_jsonb(old),to_jsonb(new)) end)
    loop
      if exists (
        select 1 from private.observer_row_households(tg_table_name,row_data) h(household_id)
        join public.household_members m on m.household_id=h.household_id
        where m.user_id=auth.uid() and m.role='observer'
      ) then
        raise exception 'ผู้สังเกตการณ์ดูข้อมูลได้อย่างเดียว ไม่สามารถเพิ่ม แก้ไข หรือลบข้อมูลครอบครัวได้'
          using errcode='42501';
      end if;
    end loop;
  end if;
  if tg_op='DELETE' then return old; else return new; end if;
end;
$$;
revoke all on function private.enforce_observer_read_only() from public,anon,authenticated;

create trigger a00_observer_read_only before insert or update or delete on public.households
  for each row execute function private.enforce_observer_read_only();
create trigger a00_observer_read_only before insert or update or delete on public.wallets
  for each row execute function private.enforce_observer_read_only();
create trigger a00_observer_read_only before insert or update or delete on public.transactions
  for each row execute function private.enforce_observer_read_only();
create trigger a00_observer_read_only before insert or update or delete on public.categories
  for each row execute function private.enforce_observer_read_only();
create trigger a00_observer_read_only before insert or update or delete on public.tags
  for each row execute function private.enforce_observer_read_only();
create trigger a00_observer_read_only before insert or update or delete on public.budgets
  for each row execute function private.enforce_observer_read_only();
create trigger a00_observer_read_only before insert or update or delete on public.saving_goals
  for each row execute function private.enforce_observer_read_only();
create trigger a00_observer_read_only before insert or update or delete on public.bills
  for each row execute function private.enforce_observer_read_only();
create trigger a00_observer_read_only before insert or update or delete on public.installment_plans
  for each row execute function private.enforce_observer_read_only();
create trigger a00_observer_read_only before insert or update or delete on public.recurring_transactions
  for each row execute function private.enforce_observer_read_only();
create trigger a00_observer_read_only before insert or update or delete on public.transaction_templates
  for each row execute function private.enforce_observer_read_only();
create trigger a00_observer_read_only before insert or update or delete on public.debt_accounts
  for each row execute function private.enforce_observer_read_only();
create trigger a00_observer_read_only before insert or update or delete on public.household_expense_attributions
  for each row execute function private.enforce_observer_read_only();
create trigger a00_observer_read_only before insert or update or delete on public.calendar_events
  for each row execute function private.enforce_observer_read_only();
create trigger a00_observer_read_only before insert or update or delete on public.calendar_event_participants
  for each row execute function private.enforce_observer_read_only();
create trigger a00_observer_read_only before insert or update or delete on public.plan_tasks
  for each row execute function private.enforce_observer_read_only();
create trigger a00_observer_read_only before insert or update or delete on public.plan_notes
  for each row execute function private.enforce_observer_read_only();
create trigger a00_observer_read_only before insert or update or delete on public.plan_reminders
  for each row execute function private.enforce_observer_read_only();
create trigger a00_observer_read_only before insert or update or delete on public.pets
  for each row execute function private.enforce_observer_read_only();
create trigger a00_observer_read_only before insert or update or delete on public.pet_care_records
  for each row execute function private.enforce_observer_read_only();
create trigger a00_observer_read_only before insert or update or delete on public.pet_caregivers
  for each row execute function private.enforce_observer_read_only();
create trigger a00_observer_read_only before insert or update or delete on public.household_members
  for each row execute function private.enforce_observer_read_only();
create trigger a00_observer_read_only before insert or update or delete on public.pockets
  for each row execute function private.enforce_observer_read_only();
create trigger a00_observer_read_only before insert or update or delete on public.credit_card_accounts
  for each row execute function private.enforce_observer_read_only();
create trigger a00_observer_read_only before insert or update or delete on public.plan_task_steps
  for each row execute function private.enforce_observer_read_only();
create trigger a00_observer_read_only before insert or update or delete on public.bill_occurrences
  for each row execute function private.enforce_observer_read_only();
create trigger a00_observer_read_only before insert or update or delete on public.bill_tags
  for each row execute function private.enforce_observer_read_only();
create trigger a00_observer_read_only before insert or update or delete on public.installment_occurrences
  for each row execute function private.enforce_observer_read_only();
create trigger a00_observer_read_only before insert or update or delete on public.recurring_occurrences
  for each row execute function private.enforce_observer_read_only();
create trigger a00_observer_read_only before insert or update or delete on public.recurring_transaction_tags
  for each row execute function private.enforce_observer_read_only();
create trigger a00_observer_read_only before insert or update or delete on public.transaction_template_tags
  for each row execute function private.enforce_observer_read_only();
create trigger a00_observer_read_only before insert or update or delete on public.debt_events
  for each row execute function private.enforce_observer_read_only();
create trigger a00_observer_read_only before insert or update or delete on public.expense_adjustments
  for each row execute function private.enforce_observer_read_only();
create trigger a00_observer_read_only before insert or update or delete on public.finance_import_fingerprints
  for each row execute function private.enforce_observer_read_only();
create trigger a00_observer_read_only before insert or update or delete on public.transaction_attachments
  for each row execute function private.enforce_observer_read_only();
create trigger a00_observer_read_only before insert or update or delete on public.transaction_entries
  for each row execute function private.enforce_observer_read_only();
create trigger a00_observer_read_only before insert or update or delete on public.transaction_tags
  for each row execute function private.enforce_observer_read_only();
create trigger a00_observer_read_only before insert or update or delete on public.transfer_ledger_links
  for each row execute function private.enforce_observer_read_only();
create trigger a00_observer_read_only before insert or update or delete on public.credit_card_liability_events
  for each row execute function private.enforce_observer_read_only();
create trigger a00_observer_read_only before insert or update or delete on public.credit_card_statements
  for each row execute function private.enforce_observer_read_only();
create trigger a00_observer_read_only before insert or update or delete on public.credit_card_statement_resolutions
  for each row execute function private.enforce_observer_read_only();
create trigger a00_observer_read_only before insert or update or delete on public.credit_card_statement_allocations
  for each row execute function private.enforce_observer_read_only();
create trigger a00_observer_read_only before insert or update or delete on public.credit_card_installment_plans
  for each row execute function private.enforce_observer_read_only();
create trigger a00_observer_read_only before insert or update or delete on public.credit_card_installment_occurrences
  for each row execute function private.enforce_observer_read_only();

-- Only household assets are restricted; avatars and personal receipts remain personal.
create function private.observer_asset_write_allowed(p_bucket text,p_name text)
returns boolean language plpgsql stable security definer set search_path = ''
as $$
declare household uuid; reference_id uuid;
begin
  if p_bucket not in ('finance-attachments','pet-photos','pet-documents') then return true; end if;
  if auth.uid() is null then return false; end if;
  begin reference_id:=split_part(p_name,'/',1)::uuid;
  exception when invalid_text_representation then return false; end;
  if p_bucket='finance-attachments' then
    select household_id into household from public.transactions where id=reference_id;
    if not found then return false; end if;
  else household:=reference_id;
  end if;
  return not exists(select 1 from public.household_members
    where household_id=household and user_id=auth.uid() and role='observer');
end;
$$;
grant usage on schema private to authenticated;
revoke all on function private.observer_asset_write_allowed(text,text) from public,anon;
grant execute on function private.observer_asset_write_allowed(text,text) to authenticated;
create policy observer_asset_insert on storage.objects as restrictive for insert to authenticated
  with check(private.observer_asset_write_allowed(bucket_id,name));
create policy observer_asset_update on storage.objects as restrictive for update to authenticated
  using(private.observer_asset_write_allowed(bucket_id,name))
  with check(private.observer_asset_write_allowed(bucket_id,name));
create policy observer_asset_delete on storage.objects as restrictive for delete to authenticated
  using(private.observer_asset_write_allowed(bucket_id,name));
