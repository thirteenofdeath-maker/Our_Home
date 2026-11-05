alter table public.chore_occurrences
  add column completion_kind text not null default 'DONE'
  check (completion_kind in ('DONE','CLEARED')),
  add constraint cleared_chore_is_resolved
    check (completion_kind <> 'CLEARED' or completed_at is not null);

comment on column public.chore_occurrences.completion_kind is
  'DONE is a completed chore; CLEARED is an overdue occurrence dismissed by a household owner or administrator. completed_at/by record the resolution timestamp and actor.';

create function private.clear_overdue_chores(p_household_id uuid, p_before_date date)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_count integer;
begin
  if auth.uid() is null or not public.has_household_role(
    p_household_id, array['owner','admin']::public.household_role[]
  ) then
    raise exception 'Only household owners and administrators may clear overdue chores'
      using errcode = '42501';
  end if;
  if p_before_date is null or p_before_date > (now() at time zone 'Asia/Bangkok')::date then
    raise exception 'The cutoff must be today or earlier' using errcode = '22023';
  end if;

  update public.chore_occurrences
  set completed_at = now(), completed_by = auth.uid(), completion_kind = 'CLEARED'
  where household_id = p_household_id and due_date < p_before_date and completed_at is null;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function private.clear_overdue_chores(uuid,date) from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.clear_overdue_chores(uuid,date) to authenticated;

create function public.clear_overdue_chores(p_household_id uuid, p_before_date date)
returns integer language sql security invoker set search_path = '' as $$
  select private.clear_overdue_chores(p_household_id, p_before_date);
$$;
revoke all on function public.clear_overdue_chores(uuid,date) from public, anon, authenticated;
grant execute on function public.clear_overdue_chores(uuid,date) to authenticated;
