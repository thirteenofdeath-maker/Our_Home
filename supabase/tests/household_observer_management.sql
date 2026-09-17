-- Transactional permission regression: all fixtures are rolled back.
begin;
create temporary table household_role_fixture (data jsonb);
grant select on household_role_fixture to authenticated;
do $$
declare
  owner_id uuid := gen_random_uuid();
  admin_id uuid := gen_random_uuid();
  member_id uuid := gen_random_uuid();
  observer_id uuid := gen_random_uuid();
  outsider_id uuid := gen_random_uuid();
  house_id uuid := gen_random_uuid();
  other_house_id uuid := gen_random_uuid();
  fixture_user uuid;
begin
  foreach fixture_user in array array[owner_id,admin_id,member_id,observer_id,outsider_id] loop
    insert into auth.users (id,email,raw_user_meta_data)
      values(fixture_user,fixture_user::text || '@household-regression.invalid','{}');
  end loop;
  insert into public.households(id,name,created_by) values(house_id,'Role regression fixture',owner_id);
  insert into public.households(id,name,created_by) values(other_house_id,'Other fixture',outsider_id);
  insert into public.household_members(household_id,user_id,role)
    values(house_id,admin_id,'admin'),(house_id,member_id,'member');
  insert into household_role_fixture values(jsonb_build_object(
    'owner',owner_id,'admin',admin_id,'member',member_id,'observer',observer_id,
    'outsider',outsider_id,'house',house_id,'other',other_house_id));
end;
$$;
set local role authenticated;
do $$
declare
  f jsonb := (select data from household_role_fixture);
  house_id uuid := (f->>'house')::uuid;
  target uuid;
  actor text;
  observed public.household_members;
begin
  perform set_config('request.jwt.claim.sub',f->>'admin',true);
  observed := public.add_household_member(house_id,(f->>'observer') || '@household-regression.invalid','observer');
  if observed.role <> 'observer' then raise exception 'observer invite failed'; end if;
  if (select count(*) from public.household_members where household_id=house_id and role<>'observer') <> 3 then
    raise exception 'observer counted as family';
  end if;
  target := (select id from public.household_members where household_id=house_id and user_id=(f->>'member')::uuid);
  foreach actor in array array['member','observer','outsider'] loop
    perform set_config('request.jwt.claim.sub',f->>actor,true);
    begin
      perform public.remove_household_member(house_id,target);
      raise exception 'unauthorized removal permitted for %',actor;
    exception when insufficient_privilege then null;
    end;
  end loop;
  perform set_config('request.jwt.claim.sub','',true);
  begin
    perform public.remove_household_member(house_id,target);
    raise exception 'unauthenticated removal permitted';
  exception when invalid_authorization_specification then null;
  end;
  perform set_config('request.jwt.claim.sub',f->>'admin',true);
  begin
    perform public.remove_household_member(house_id,(select id from public.household_members where household_id=house_id and role='owner'));
    raise exception 'admin removed owner';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.change_household_member_role(house_id,target,'admin');
    raise exception 'admin promoted member';
  exception when insufficient_privilege then null;
  end;
  perform public.remove_household_member(house_id,observed.id);
  if exists(select 1 from public.household_members where id=observed.id) then raise exception 'observer removal failed'; end if;
  perform set_config('request.jwt.claim.sub',f->>'observer',true);
  if public.is_household_member(house_id) then raise exception 'removed observer retains access'; end if;
  perform set_config('request.jwt.claim.sub',f->>'owner',true);
  perform public.change_household_member_role(house_id,target,'observer');
  if (select role from public.household_members where id=target) <> 'observer' then raise exception 'observer role change failed'; end if;
  perform public.change_household_member_role(house_id,target,'member');
  begin
    perform public.remove_household_member(house_id,(select id from public.household_members where household_id=house_id and role='owner'));
    raise exception 'owner removed self';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.remove_household_member((f->>'other')::uuid,target);
    raise exception 'cross-household removal permitted';
  exception when insufficient_privilege then null;
  end;
  perform set_config('request.jwt.claim.sub',f->>'admin',true);
  perform public.remove_household_member(house_id,target);
  perform set_config('request.jwt.claim.sub',f->>'owner',true);
  perform public.remove_household_member(house_id,(select id from public.household_members where household_id=house_id and role='admin'));
  if (select count(*) from public.household_members where household_id=house_id) <> 1 then raise exception 'unexpected remaining members'; end if;
  if has_function_privilege('anon','public.remove_household_member(uuid,uuid)','EXECUTE') then raise exception 'anonymous rpc access'; end if;
  if has_table_privilege('authenticated','public.household_members','DELETE') then raise exception 'direct delete allowed'; end if;
end;
$$;
rollback;
