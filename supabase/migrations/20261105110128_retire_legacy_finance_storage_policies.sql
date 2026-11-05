-- Disable retired receipt policies without evaluating revoked ledger helpers.
-- Storage combines policies across buckets before applying each predicate.
alter policy finance_attachments_read on storage.objects using (false);
alter policy finance_attachments_insert on storage.objects with check (false);
alter policy finance_attachments_delete on storage.objects using (false);
