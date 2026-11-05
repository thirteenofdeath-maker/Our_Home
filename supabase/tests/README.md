# Active household security tests

`active_household_security.sql` is the current permission regression suite. It creates five temporary users and one household, changes the JWT subject while using the actual `authenticated` database role, and checks the current RLS policies and RPC grants. All fixtures, including `auth.users` and Storage metadata, are inside a transaction that rolls back.

Apply all migrations first, then run:

```sh
SUPABASE_TEST_DB_URL='postgresql://…' npm run test:security
```

Use a migrated disposable/local database and an administrator connection capable of inserting `auth.users` and `SET ROLE authenticated`. The runner requires the official `psql` client. It does not need manually provisioned accounts, passwords, wallets, or environment-specific fixture IDs. `ON_ERROR_STOP` makes any assertion fail the command.

Covered: household owner/admin/member/observer/outsider reads, private task isolation, household expense writes and idempotency, shopping and task mutation boundaries, bulk chore clearing cutoff/history, photo path policies, summary RLS, and retired ledger grants.

The old `src/features/security/rls.integration.test.ts` targets the retired finance subsystem and remains gated. Its 146 skipped tests are not evidence of current security coverage. The active SQL suite must be run separately from the JavaScript unit suite.
