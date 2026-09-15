-- 0055_card_adjustment_transaction_type.sql
-- Added separately because PostgreSQL enum values cannot be safely used by
-- other schema objects in the same migration transaction. Purchase/refund
-- remain EXPENSE rows; this value is reserved for the later cashback and
-- balance-adjustment writers and is naturally excluded from expense reports.

alter type public.transaction_type add value if not exists 'CARD_ADJUSTMENT';
