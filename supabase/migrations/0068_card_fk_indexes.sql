-- Cover the audit-identity foreign keys reported by Database Advisors.
create index credit_card_statements_created_by_idx on public.credit_card_statements(created_by);
create index credit_card_installment_plans_created_by_idx on public.credit_card_installment_plans(created_by);
create index credit_card_statement_resolutions_resolved_by_idx on public.credit_card_statement_resolutions(resolved_by);
