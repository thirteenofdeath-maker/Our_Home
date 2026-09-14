-- Separate transaction so PostgreSQL commits enum value before 0041 uses it.
alter type public.transaction_type add value if not exists 'DEBT_PRINCIPAL';
