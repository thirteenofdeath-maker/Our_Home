-- Split table-specific record access into separate branches. PostgreSQL
-- resolves trigger-record fields before boolean short-circuit evaluation.
create or replace function public.guard_active_card_installment_purchase_change()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
  if tg_table_name='transactions' then
    if new.deleted_at is not null and old.deleted_at is null
      and exists(select 1 from public.credit_card_installment_plans p where p.purchase_transaction_id=old.id and p.archived_at is null) then
      raise exception 'Archive the card installment plan before voiding its purchase' using errcode='23514';
    end if;
    return new;
  end if;
  if tg_table_name='credit_card_liability_events' then
    if new.event_kind='PURCHASE_REFUND'
      and exists(select 1 from public.credit_card_installment_plans p join public.credit_card_liability_events e on e.transaction_id=p.purchase_transaction_id where e.id=new.reverses_event_id and p.archived_at is null) then
      raise exception 'Archive the card installment plan before refunding its purchase' using errcode='23514';
    end if;
    return new;
  end if;
  raise exception 'Unsupported installment guard trigger table' using errcode='23514';
end;
$$;
