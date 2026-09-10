create table public.transaction_attachments(
 id uuid primary key,transaction_id uuid not null references public.transactions(id)on delete restrict,
 storage_path text not null unique,mime_type text not null check(mime_type in('image/jpeg','image/png','image/webp','application/pdf')),
 file_name text not null check(btrim(file_name)<>''),file_size bigint not null check(file_size>0 and file_size<=15728640),
 created_by uuid not null references public.profiles(id),created_at timestamptz not null default now(),
 check(storage_path~('^'||transaction_id::text||'/[0-9a-f-]{36}\.(jpg|png|webp|pdf)$'))
);
alter table public.transaction_attachments enable row level security;
create policy transaction_attachments_select on public.transaction_attachments for select using(public.is_transaction_authorized(transaction_id));
create policy transaction_attachments_insert on public.transaction_attachments for insert with check(created_by=auth.uid()and public.is_transaction_authorized(transaction_id));
create policy transaction_attachments_delete on public.transaction_attachments for delete using(created_by=auth.uid()and public.is_transaction_authorized(transaction_id));
revoke all on public.transaction_attachments from anon,authenticated;grant select,insert,delete on public.transaction_attachments to authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)values('finance-attachments','finance-attachments',false,15728640,array['image/jpeg','image/png','image/webp','application/pdf'])on conflict(id)do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create policy finance_attachments_read on storage.objects for select to authenticated using(bucket_id='finance-attachments'and name~'^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp|pdf)$'and public.is_transaction_authorized(((storage.foldername(name))[1])::uuid));
create policy finance_attachments_insert on storage.objects for insert to authenticated with check(bucket_id='finance-attachments'and name~'^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp|pdf)$'and public.is_transaction_authorized(((storage.foldername(name))[1])::uuid));
create policy finance_attachments_delete on storage.objects for delete to authenticated using(bucket_id='finance-attachments'and name~'^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp|pdf)$'and public.is_transaction_authorized(((storage.foldername(name))[1])::uuid));
