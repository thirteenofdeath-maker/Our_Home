-- All test fixtures live inside a rolled-back subtransaction, including auth users.
-- Can also be appended to a migration: a failed assertion aborts the whole migration.
do $test$
declare
  owner_id uuid:=gen_random_uuid(); observer_id uuid:=gen_random_uuid();
  member_id uuid:=gen_random_uuid(); admin_id uuid:=gen_random_uuid();
  house_id uuid:=gen_random_uuid(); other_house uuid:=gen_random_uuid();
  wallet uuid:=gen_random_uuid(); personal_wallet uuid:=gen_random_uuid();
  cat uuid:=gen_random_uuid(); txn uuid; pocket uuid; task uuid:=gen_random_uuid();
  note_id uuid:=gen_random_uuid(); pet uuid:=gen_random_uuid();
  actor uuid; t text; q text; row_data jsonb; seen integer; before_count integer;
  direct_tables text[]:=array['wallets','transactions','categories','tags','budgets','saving_goals',
    'bills','installment_plans','recurring_transactions','transaction_templates','debt_accounts',
    'household_expense_attributions','calendar_events','calendar_event_participants',
    'plan_tasks','plan_notes','plan_reminders','pets','pet_care_records','pet_caregivers','household_members'];
begin
  begin
    -- Never use or alter real user records.
    foreach actor in array array[owner_id,observer_id,member_id,admin_id] loop
      insert into auth.users(id,email,raw_user_meta_data)
        values(actor,actor::text||'@observer-test.invalid','{}');
    end loop;
    insert into public.households(id,name,created_by) values(house_id,'Observer test',owner_id),(other_house,'Other test',observer_id);
    insert into public.household_members(household_id,user_id,role)
      values(house_id,observer_id,'observer'),(house_id,member_id,'member'),(house_id,admin_id,'admin');
    insert into public.wallets(id,scope,household_id,name,created_by) values(wallet,'HOUSEHOLD',house_id,'Test wallet',owner_id);
    insert into public.wallets(id,scope,owner_user_id,name,created_by) values(personal_wallet,'PERSONAL',observer_id,'Personal test',observer_id);
    -- Wallets intentionally stopped auto-creating a default pocket in
    -- migration 0029. Create the fixture explicitly so this test follows the
    -- current wallet/pocket model instead of relying on removed behaviour.
    insert into public.pockets(wallet_id,name,pocket_type,currency)
      values(wallet,'Household test pocket','CASH','THB') returning id into pocket;
    insert into public.pockets(wallet_id,name,pocket_type,currency)
      values(personal_wallet,'Personal test pocket','CASH','THB');
    insert into public.categories(id,scope,household_id,name,transaction_type,created_by)
      values(cat,'HOUSEHOLD',house_id,'Test income','INCOME',owner_id);
    insert into public.plan_tasks(id,household_id,created_by,scope,title)
      values(task,house_id,owner_id,'HOUSEHOLD','Test task');
    insert into public.plan_notes(id,household_id,created_by,scope,title,content)
      values(note_id,house_id,observer_id,'HOUSEHOLD','Existing note','Keep this');
    insert into public.pets(id,household_id,name,species,created_by) values(pet,house_id,'Test cat','CAT',owner_id);
    perform set_config('request.jwt.claim.sub',owner_id::text,true);
    txn:=public.create_income_expense_transaction('INCOME',wallet,pocket,cat,1);

    -- Trigger protection must still run inside SECURITY DEFINER / bypass-RLS writers.
    perform set_config('request.jwt.claim.sub',observer_id::text,true);
    foreach t in array direct_tables loop
      begin
        execute format('insert into public.%I(household_id) values($1)',t) using house_id;
        raise exception 'Observer INSERT escaped on %',t;
      exception when insufficient_privilege then
        if sqlerrm not like 'ผู้สังเกตการณ์%' then raise; end if;
      end;
    end loop;
    begin
      insert into public.households(id,name,created_by) values(house_id,'Forbidden',observer_id);
      raise exception 'Observer household INSERT escaped';
    exception when insufficient_privilege then null; end;

    for t,row_data in select * from (values
      ('pockets',jsonb_build_object('wallet_id',wallet)),
      ('credit_card_accounts',jsonb_build_object('wallet_id',wallet)),
      ('plan_task_steps',jsonb_build_object('task_id',task)),
      ('transaction_entries',jsonb_build_object('transaction_id',txn,'wallet_id',wallet)),
      ('transaction_tags',jsonb_build_object('transaction_id',txn)),
      ('transaction_attachments',jsonb_build_object('transaction_id',txn)),
      ('finance_import_fingerprints',jsonb_build_object('transaction_id',txn)),
      ('expense_adjustments',jsonb_build_object('original_expense_transaction_id',txn)),
      ('transfer_ledger_links',jsonb_build_object('transfer_transaction_id',txn))
    ) cases(t,r) loop
      begin
        execute format('insert into public.%1$I select * from jsonb_populate_record(null::public.%1$I,$1)',t) using row_data;
        raise exception 'Observer child INSERT escaped on %',t;
      exception when insufficient_privilege then
        if sqlerrm not like 'ผู้สังเกตการณ์%' then raise; end if;
      end;
    end loop;
    foreach q in array array[
      format('update public.plan_notes set title=''Forbidden'' where id=%L',note_id),
      format('delete from public.plan_notes where id=%L',note_id),
      format('update public.pets set name=''Forbidden'' where id=%L',pet),
      format('delete from public.pets where id=%L',pet),
      format('update public.wallets set name=''Forbidden'' where id=%L',wallet),
      format('delete from public.wallets where id=%L',wallet),
      format('update public.transactions set title=''Forbidden'' where id=%L',txn),
      format('delete from public.transactions where id=%L',txn),
      format('update public.plan_tasks set household_id=%L where id=%L',other_house,task),
      format('update public.wallets set scope=''HOUSEHOLD'',owner_user_id=null,household_id=%L where id=%L',house_id,personal_wallet),
      format('update public.pockets set wallet_id=%L where id=%L',personal_wallet,pocket)
    ] loop
      begin execute q; raise exception 'Observer UPDATE/DELETE escaped: %',q;
      exception when insufficient_privilege then null; end;
    end loop;

    -- Exercise real public RPC and RLS using an authenticated client role.
    perform set_config('role','authenticated',true);
    if not public.is_household_member(house_id) then raise exception 'Observer lost read membership'; end if;
    select count(*) into seen from public.wallets where id=wallet;
    if seen<>1 then raise exception 'Observer lost shared wallet read'; end if;
    select count(*) into seen from public.plan_notes where id=note_id;
    if seen<>1 then raise exception 'Observer lost shared note read'; end if;
    select count(*) into before_count from public.transactions where household_id=house_id;
    begin
      perform public.create_income_expense_transaction('INCOME',wallet,pocket,cat,5);
      raise exception 'Observer financial RPC escaped';
    exception when insufficient_privilege then null; end;
    begin
      perform public.update_member_presentation(house_id,'Forbidden','#7A9E7E');
      raise exception 'Observer member presentation RPC escaped';
    exception when insufficient_privilege then null; end;
    if (select count(*) from public.transactions where household_id=house_id)<>before_count then
      raise exception 'Denied RPC left ledger rows';
    end if;
    begin
      insert into public.plan_notes(household_id,created_by,scope,title,content)
        values(house_id,observer_id,'HOUSEHOLD','Forbidden','Forbidden');
      raise exception 'Observer direct REST insert escaped';
    exception when insufficient_privilege then null; end;
    begin
      update public.plan_notes set title='Forbidden' where id=note_id;
      if found then raise exception 'Observer direct REST update escaped'; end if;
    exception when insufficient_privilege then null; end;
    begin
      delete from public.plan_notes where id=note_id;
      if found then raise exception 'Observer direct REST delete escaped'; end if;
    exception when insufficient_privilege then null; end;
    if private.observer_asset_write_allowed('finance-attachments',txn::text||'/receipt.pdf')
      or private.observer_asset_write_allowed('pet-photos',house_id::text||'/profile.jpg')
      or private.observer_asset_write_allowed('pet-documents',house_id::text||'/document.pdf') then
      raise exception 'Observer storage writes allowed';
    end if;
    begin
      insert into storage.objects(bucket_id,name,owner_id)
        values('pet-documents',house_id::text||'/'||pet::text||'/'||gen_random_uuid()::text||'/test.pdf',observer_id::text);
      raise exception 'Observer storage INSERT escaped';
    exception when insufficient_privilege then null; end;

    -- Personal data and a DIFFERENT household where the same user is owner stay writable.
    update public.wallets set name='Personal still writable' where id=personal_wallet;
    if not found then raise exception 'Personal write regressed'; end if;
    insert into public.plan_notes(household_id,created_by,scope,title,content)
      values(other_house,observer_id,'HOUSEHOLD','Owner in another house','Allowed');
    insert into public.plan_notes(created_by,scope,title,content)
      values(observer_id,'PERSONAL','Personal note','Allowed');
    foreach actor in array array[owner_id,admin_id,member_id] loop
      perform set_config('request.jwt.claim.sub',actor::text,true);
      perform public.create_income_expense_transaction('INCOME',wallet,pocket,cat,2);
      insert into public.plan_notes(household_id,created_by,scope,title,content)
        values(house_id,actor,'HOUSEHOLD','Allowed','Allowed');
      if not private.observer_asset_write_allowed('pet-documents',house_id::text||'/test.pdf') then
        raise exception 'Normal role storage permission regressed';
      end if;
    end loop;
    -- Role changes take effect immediately; no old JWT role claim is trusted.
    perform set_config('role','none',true);
    perform set_config('request.jwt.claim.sub',owner_id::text,true);
    update public.household_members set role='member' where user_id=observer_id and household_id=house_id;
    perform set_config('request.jwt.claim.sub',observer_id::text,true);
    perform public.create_income_expense_transaction('INCOME',wallet,pocket,cat,2);
    perform set_config('request.jwt.claim.sub',owner_id::text,true);
    update public.household_members set role='observer' where user_id=observer_id and household_id=house_id;
    perform set_config('request.jwt.claim.sub',observer_id::text,true);
    begin perform public.create_income_expense_transaction('INCOME',wallet,pocket,cat,2);
      raise exception 'Demoted observer retained write access';
    exception when insufficient_privilege then null; end;
    raise exception using errcode='ZX001',message='rollback successful test fixtures';
  exception when sqlstate 'ZX001' then null;
  end;
  if exists(select 1 from auth.users where id in(owner_id,observer_id,member_id,admin_id)) then
    raise exception 'Test fixture leak';
  end if;
end;
$test$;
