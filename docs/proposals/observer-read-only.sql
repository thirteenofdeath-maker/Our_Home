-- DRAFT ONLY — NOT APPLIED. Automatic approval review rejected broad production changes.
-- See ../PRODUCTION_AUDIT_2026-09-17.md. Requires staging verification and approval.
-- Defense in depth for read-only observers, including SECURITY DEFINER writers.
-- No read policy or existing member/owner permission is expanded.
create schema if not exists private;
revoke all on schema private from public, anon;

create or replace function private.row_households(
  p_table regclass, p_row jsonb, p_visited oid[] default '{}'::oid[]
) returns setof uuid language plpgsql security definer set search_path = ''
as $$
declare
  relation record;
  parent_row jsonb;
  predicates text;
begin
  if p_table::oid = any(p_visited) then return; end if;
  p_visited := array_append(p_visited,p_table::oid);
  if p_table = 'public.households'::regclass then
    return next (p_row->>'id')::uuid;
    return;
  end if;
  if nullif(p_row->>'household_id','') is not null then
    return next (p_row->>'household_id')::uuid;
    return;
  end if;
  -- Traverse real FK relationships, never caller-controlled table names.
  for relation in
    select c.* from pg_catalog.pg_constraint c
    join pg_catalog.pg_class t on t.oid=c.confrelid
    join pg_catalog.pg_namespace n on n.oid=t.relnamespace
    where c.contype='f' and c.conrelid=p_table and n.nspname='public'
      and c.confrelid <> 'public.profiles'::regclass
      and not c.confrelid=any(p_visited)
  loop
    select string_agg(
      format('to_jsonb(parent)->>%L = $1->>%L', dst.attname,src.attname),' and '
    ) into predicates
    from unnest(relation.conkey,relation.confkey) as keys(src_num,dst_num)
    join pg_catalog.pg_attribute src on src.attrelid=p_table and src.attnum=keys.src_num
    join pg_catalog.pg_attribute dst on dst.attrelid=relation.confrelid and dst.attnum=keys.dst_num;
    for parent_row in execute format(
      'select to_jsonb(parent) from %s parent where %s',relation.confrelid::regclass,predicates
    ) using p_row loop
      return query select * from private.row_households(relation.confrelid::regclass,parent_row,p_visited);
    end loop;
  end loop;
end;
$$;
revoke all on function private.row_households(regclass,jsonb,oid[]) from public,anon,authenticated;

create or replace function private.guard_observer_write()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare row_data jsonb; household uuid;
begin
  if auth.uid() is null then
    if tg_op='DELETE' then return old; else return new; end if;
  end if;
  -- Inspect both images: changing a parent key cannot escape the old household.
  for row_data in
    select value from jsonb_array_elements(
      case when tg_op='INSERT' then jsonb_build_array(to_jsonb(new))
           when tg_op='DELETE' then jsonb_build_array(to_jsonb(old))
           else jsonb_build_array(to_jsonb(old),to_jsonb(new)) end
    )
  loop
    for household in select distinct * from private.row_households(tg_relid,row_data) loop
      if exists(select 1 from public.household_members
        where household_id=household and user_id=auth.uid() and role='observer') then
        raise exception 'Observers have read-only household access' using errcode='42501';
      end if;
    end loop;
  end loop;
  if tg_op='DELETE' then return old; else return new; end if;
end;
$$;
revoke all on function private.guard_observer_write() from public,anon,authenticated;

do $$
declare t record;
begin
  for t in
    select c.oid::regclass as name from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind='r'
      and c.relname not in ('household_members','profiles')
      and (c.relname='households' or exists(
        select 1 from pg_catalog.pg_constraint fk where fk.conrelid=c.oid and fk.contype='f'
      ))
  loop
    execute format('create trigger observer_read_only before insert or update or delete on %s for each row execute function private.guard_observer_write()',t.name);
  end loop;
end;
$$;

-- Storage has no FK to the business row; protect its actual bucket/path mapping.
create or replace function private.observer_storage_write_allowed(p_bucket text,p_name text)
returns boolean language plpgsql stable security definer set search_path = ''
as $$
declare household uuid; reference_id uuid;
begin
  if p_bucket not in ('finance-attachments','pet-photos','pet-documents') then return true; end if;
  begin reference_id:=split_part(p_name,'/',1)::uuid;
  exception when invalid_text_representation then return false; end;
  if p_bucket='finance-attachments' then
    select household_id into household from public.transactions where id=reference_id;
  else
    household:=reference_id;
  end if;
  return not exists(select 1 from public.household_members
    where household_id=household and user_id=auth.uid() and role='observer');
end;
$$;
grant usage on schema private to authenticated;
revoke all on function private.observer_storage_write_allowed(text,text) from public,anon;
grant execute on function private.observer_storage_write_allowed(text,text) to authenticated;
create policy observer_storage_insert on storage.objects as restrictive for insert to authenticated
  with check(private.observer_storage_write_allowed(bucket_id,name));
create policy observer_storage_update on storage.objects as restrictive for update to authenticated
  using(private.observer_storage_write_allowed(bucket_id,name))
  with check(private.observer_storage_write_allowed(bucket_id,name));
create policy observer_storage_delete on storage.objects as restrictive for delete to authenticated
  using(private.observer_storage_write_allowed(bucket_id,name));
