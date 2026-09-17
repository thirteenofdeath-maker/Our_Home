-- Commit the enum addition before functions reference the new value.
alter type public.household_role add value if not exists 'observer';
