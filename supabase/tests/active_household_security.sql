-- Isolated active-module integration tests. No environment-specific accounts.
-- Run as postgres against the migrated database; all fixtures roll back.
begin;
create temporary table active_security_fixture(data jsonb);
grant select on active_security_fixture to authenticated;
do $$
declare
 f jsonb := '{}'; actor text; person uuid; h uuid:=gen_random_uuid();
 member_id uuid; template_id uuid:=gen_random_uuid(); pet_id uuid:=gen_random_uuid();
 today date:=(now() at time zone 'Asia/Bangkok')::date;
begin
 foreach actor in array array['owner','admin','member','observer','outsider'] loop
  person:=gen_random_uuid();
  insert into auth.users(id,email,raw_user_meta_data) values(person,person||'@active-security.invalid','{}');
  f:=f||jsonb_build_object(actor,person);
 end loop;
 insert into public.households(id,name,created_by) values(h,'Active security fixture',(f->>'owner')::uuid);
 foreach actor in array array['admin','member','observer'] loop
  insert into public.household_members(household_id,user_id,role) values(h,(f->>actor)::uuid,actor::public.household_role);
 end loop;
 select id into member_id from public.household_members where household_id=h and user_id=(f->>'owner')::uuid;
 insert into public.chore_templates(id,household_id,title,cadence,starts_on,created_by) values(template_id,h,'Audit chore','DAILY',today-2,(f->>'owner')::uuid);
 insert into public.chore_occurrences(template_id,household_id,due_date,assigned_member_id,original_assigned_member_id)
 values(template_id,h,today-1,member_id,member_id),(template_id,h,today,member_id,member_id),(template_id,h,today+1,member_id,member_id);
 insert into public.shopping_items(household_id,name,quantity,created_by) values(h,'Audit shopping',1,(f->>'owner')::uuid);
 insert into public.inventory_items(household_id,name,category,created_by) values(h,'Audit inventory','HOUSEHOLD',(f->>'owner')::uuid);
 insert into public.pets(id,household_id,name,species,created_by) values(pet_id,h,'Audit pet','CAT',(f->>'owner')::uuid);
 insert into public.plan_tasks(household_id,created_by,scope,title,list_name) values(h,(f->>'owner')::uuid,'HOUSEHOLD','Audit task','Audit');
 insert into public.plan_tasks(created_by,scope,title,list_name) values((f->>'outsider')::uuid,'PERSONAL','Private outsider task','Audit');
 insert into public.plan_reminders(household_id,created_by,scope,title,reminds_at) values(h,(f->>'owner')::uuid,'HOUSEHOLD','Audit reminder',now());
 insert into public.calendar_events(household_id,created_by,scope,title,is_all_day,all_day_date) values(h,(f->>'owner')::uuid,'HOUSEHOLD','Audit event',true,today);
 f:=f||jsonb_build_object('house',h,'pet',pet_id,'expense',gen_random_uuid(),'today',today,'shopping',(select id from public.shopping_items where household_id=h));
 insert into active_security_fixture values(f);
end;
$$;
set local role authenticated;
do $$
declare
 f jsonb:=(select data from active_security_fixture); actor text; table_name text;
 h uuid:=(f->>'house')::uuid; today date:=(f->>'today')::date;
 visible integer; changed integer; photo text; summary jsonb;
begin
 foreach actor in array array['owner','admin','member','observer','outsider'] loop
  perform set_config('request.jwt.claim.sub',f->>actor,true);
  foreach table_name in array array['shopping_items','inventory_items','pets','plan_tasks','plan_reminders','calendar_events','chore_occurrences'] loop
   execute format('select count(*) from public.%I where household_id=$1',table_name) into visible using h;
   if (actor='outsider' and visible<>0) or (actor<>'outsider' and visible=0) then raise exception 'read isolation failed: %, %',actor,table_name; end if;
  end loop;
  -- Household members must not see the outsider's personal work.
  if actor<>'outsider' and exists(select 1 from public.plan_tasks where created_by=(f->>'outsider')::uuid) then raise exception 'personal task leaked'; end if;
  if actor in ('observer','outsider') then
   begin
    perform public.save_household_expense(gen_random_uuid(),h,'Denied','other',10,today,(f->>'owner')::uuid,array[]::uuid[],false);
    raise exception 'expense write unexpectedly allowed for %',actor;
   exception when insufficient_privilege then null; end;
   begin
    insert into public.plan_tasks(household_id,created_by,scope,title,list_name) values(h,(f->>actor)::uuid,'HOUSEHOLD','Denied','Audit');
    raise exception 'task write unexpectedly allowed for %',actor;
   exception when insufficient_privilege then null; end;
   begin
    perform public.set_shopping_item_purchased((f->>'shopping')::uuid,true);
    raise exception 'shopping mutation unexpectedly allowed for %',actor;
   exception when insufficient_privilege then null; end;
  else
   perform public.save_household_expense(gen_random_uuid(),h,'Allowed','other',10,today,(f->>actor)::uuid,array[]::uuid[],false);
  end if;
  if actor in ('member','observer','outsider') then
   begin
    perform public.clear_overdue_chores(h,today);
    raise exception 'bulk clear unexpectedly allowed for %',actor;
   exception when insufficient_privilege then null; end;
  end if;
  -- Every former ledger endpoint/table must be unavailable to the app role.
  if has_table_privilege('public.wallets','SELECT') or has_table_privilege('public.transactions','INSERT') then raise exception 'legacy ledger privilege remains'; end if;
  if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='create_income_expense_transaction' and has_function_privilege(p.oid,'EXECUTE')) then raise exception 'legacy RPC privilege remains'; end if;
  summary:=public.get_plan_workspace_summary(h,today);
  if actor='outsider' and (summary->'shopping'->>'pending')::int<>0 then raise exception 'summary bypassed RLS'; end if;
 end loop;
 perform set_config('request.jwt.claim.sub',f->>'owner',true);
 perform public.save_household_expense((f->>'expense')::uuid,h,'Retry regression','other',120,today,(f->>'owner')::uuid,array[(f->>'shopping')::uuid],false);
 perform public.save_household_expense((f->>'expense')::uuid,h,'Retry regression','other',120,today,(f->>'owner')::uuid,array[(f->>'shopping')::uuid],false);
 if (select count(*) from public.household_expenses where id=(f->>'expense')::uuid)<>1 then raise exception 'duplicate expense'; end if;
 begin
  perform public.save_household_expense((f->>'expense')::uuid,h,'Retry regression','other',150,today,(f->>'owner')::uuid,array[(f->>'shopping')::uuid],false);
  raise exception 'changed payload silently accepted' using errcode='ZX001';
 exception when sqlstate 'P0001' then null; end;
 begin
  perform public.save_household_expense((f->>'expense')::uuid,h,'Retry regression','other',120,today,(f->>'owner')::uuid,array[]::uuid[],false);
  raise exception 'changed shopping links silently accepted' using errcode='ZX001';
 exception when sqlstate 'P0001' then null; end;
 if (select amount from public.household_expenses where id=(f->>'expense')::uuid)<>120 then raise exception 'retry changed stored amount'; end if;
 changed:=public.clear_overdue_chores(h,today);
 if changed<>1 then raise exception 'wrong overdue clear count %',changed; end if;
 if (select count(*) from public.chore_occurrences where household_id=h and completed_at is null)<>2 then raise exception 'today/future chores cleared'; end if;
 if not exists(select 1 from public.chore_occurrences where household_id=h and completion_kind='CLEARED' and completed_by=(f->>'owner')::uuid) then raise exception 'clear audit missing'; end if;
 perform set_config('request.jwt.claim.sub',f->>'admin',true);
 if public.clear_overdue_chores(h,today)<>0 then raise exception 'clear retry is not idempotent'; end if;
 begin
  perform public.clear_overdue_chores(h,today+1);
  raise exception 'future cutoff accepted' using errcode='ZX001';
 exception when invalid_parameter_value then null; end;
 -- Both old and immutable photo paths are accepted, outsiders cannot write them.
 photo:=h||'/'||(f->>'pet')||'/profile-'||gen_random_uuid()||'.jpg';
 insert into storage.objects(bucket_id,name) values('pet-photos',photo),('pet-photos',h||'/'||(f->>'pet')||'/profile.jpg');
 if (select count(*) from storage.objects where bucket_id='pet-photos' and name like h||'/%')<>2 then raise exception 'photo paths rejected'; end if;
 perform public.update_pet((f->>'pet')::uuid,'Audit pet','CAT',null,'UNKNOWN',null,photo,array[]::uuid[]);
 if (select photo_path from public.pets where id=(f->>'pet')::uuid)<>photo then raise exception 'versioned pet metadata rejected'; end if;
 perform public.update_profile_details(h,'Audit admin',null,null,false,'#123456',(f->>'admin')||'/avatar-'||gen_random_uuid()||'.jpg');
 if not exists(select 1 from public.profiles where id=(f->>'admin')::uuid and avatar_url like '%/avatar-%.jpg') then raise exception 'versioned avatar metadata rejected'; end if;
 perform set_config('request.jwt.claim.sub',f->>'observer',true);
 begin
  insert into storage.objects(bucket_id,name) values('pet-photos',h||'/'||(f->>'pet')||'/profile-'||gen_random_uuid()||'.jpg');
  raise exception 'observer photo write allowed';
 exception when insufficient_privilege then null; end;
 perform set_config('request.jwt.claim.sub',f->>'outsider',true);
 if exists(select 1 from storage.objects where bucket_id='pet-photos' and name like h||'/%') then raise exception 'private photo leaked'; end if;
end;
$$;
reset role;
rollback;
select 'PASS: five roles, seven active modules, personal isolation, expense retry, clear cutoff/history, legacy revocation, summary RLS, photo policies; all fixtures rolled back' as result;
