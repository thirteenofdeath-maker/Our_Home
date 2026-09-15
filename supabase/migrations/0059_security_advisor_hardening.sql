-- 0059_security_advisor_hardening.sql
-- Close legacy function-exposure warnings found by the live Supabase
-- Security Advisor before the first public trial deployment.

-- These functions are invoked only by database triggers. Direct Data API
-- execution is never part of their contract.
revoke execute on function public.bills_reactivate_occurrences() from public, anon, authenticated;
revoke execute on function public.bills_refresh_open_occurrences() from public, anon, authenticated;
revoke execute on function public.credit_card_account_validate_links() from public, anon, authenticated;
revoke execute on function public.generate_installment_occurrences() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.handle_user_email_change() from public, anon, authenticated;
revoke execute on function public.households_add_creator_as_owner() from public, anon, authenticated;
revoke execute on function public.protect_managed_card_identity() from public, anon, authenticated;
revoke execute on function public.recurring_transactions_reactivate_occurrences() from public, anon, authenticated;
revoke execute on function public.recurring_transactions_rebuild_occurrences() from public, anon, authenticated;
revoke execute on function public.reject_new_unmanaged_credit_card_wallet() from public, anon, authenticated;
revoke execute on function public.reject_unclassified_managed_card_entry() from public, anon, authenticated;
revoke execute on function public.sync_debt_event_void_state() from public, anon, authenticated;
revoke execute on function public.sync_transfer_ledger_void_state() from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;

-- Lock name resolution for the two legacy helpers reported by the advisor.
alter function public.set_updated_at() set search_path = '';
alter function public.recurring_next_due_date(date, date, text, integer, integer) set search_path = '';

-- recurring_next_due_date is an intentional authenticated helper RPC.
revoke execute on function public.recurring_next_due_date(date, date, text, integer, integer) from public, anon;
grant execute on function public.recurring_next_due_date(date, date, text, integer, integer) to authenticated;
