import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const database = process.env.SUPABASE_TEST_DB_URL;
if (!database) {
  console.error(
    "Set SUPABASE_TEST_DB_URL to a migrated PostgreSQL test database. Fixtures are generated and rolled back; no user passwords or fixture IDs are required.",
  );
  process.exit(1);
}
const result = spawnSync(
  "psql",
  [
    "--no-psqlrc",
    "--set=ON_ERROR_STOP=1",
    "--file",
    fileURLToPath(
      new URL(
        "../supabase/tests/active_household_security.sql",
        import.meta.url,
      ),
    ),
  ],
  { stdio: "inherit", env: { ...process.env, PGDATABASE: database } },
);
if (result.error)
  console.error(
    "Unable to run psql. Install the official PostgreSQL client before running this suite.",
  );
process.exit(result.status ?? 1);
