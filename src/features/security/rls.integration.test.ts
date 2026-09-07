import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

/**
 * RLS is a database-level guarantee — it cannot be meaningfully verified
 * without a real Postgres instance running the migrations in
 * supabase/migrations/. There is no Docker/Postgres available in the
 * environment this test suite was authored in (see docs/ARCHITECTURE.md),
 * so these tests are written but SKIPPED unless pointed at a real
 * (disposable/test) Supabase project via env vars:
 *
 *   SUPABASE_TEST_URL, SUPABASE_TEST_ANON_KEY
 *   SUPABASE_TEST_USER_A_EMAIL / _PASSWORD  (has a personal wallet)
 *   SUPABASE_TEST_USER_B_EMAIL / _PASSWORD  (unrelated user)
 *   SUPABASE_TEST_HOUSEHOLD_MEMBER_EMAIL / _PASSWORD (member of a household
 *     that owns SUPABASE_TEST_HOUSEHOLD_WALLET_ID)
 *   SUPABASE_TEST_PERSONAL_WALLET_ID (owned by user A)
 *   SUPABASE_TEST_HOUSEHOLD_WALLET_ID
 *
 * Run with: SUPABASE_TEST_URL=... npm test -- rls.integration
 *
 * This satisfies items 6 and 7 of the Milestone 1 test plan
 * (docs/DOMAIN_RULES.md "Security"): a household member can access
 * permitted household resources, and an unrelated user cannot access
 * another user's personal resources — enforced by Postgres RLS, not by
 * this test or by frontend code.
 */
const hasLiveProject = Boolean(process.env.SUPABASE_TEST_URL && process.env.SUPABASE_TEST_ANON_KEY);

async function signIn(email: string, password: string) {
  const client = createClient(process.env.SUPABASE_TEST_URL!, process.env.SUPABASE_TEST_ANON_KEY!);
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return client;
}

describe.skipIf(!hasLiveProject)("RLS: personal wallet isolation", () => {
  it("an unrelated user cannot read another user's personal wallet", async () => {
    const userB = await signIn(
      process.env.SUPABASE_TEST_USER_B_EMAIL!,
      process.env.SUPABASE_TEST_USER_B_PASSWORD!,
    );

    const { data, error } = await userB
      .from("wallets")
      .select("id")
      .eq("id", process.env.SUPABASE_TEST_PERSONAL_WALLET_ID!)
      .maybeSingle();

    // RLS makes the row invisible, not a 403 — PostgREST returns zero rows.
    expect(error).toBeNull();
    expect(data).toBeNull();
  });
});

describe.skipIf(!hasLiveProject)("RLS: household member access", () => {
  it("a household member can read a household wallet they belong to", async () => {
    const member = await signIn(
      process.env.SUPABASE_TEST_HOUSEHOLD_MEMBER_EMAIL!,
      process.env.SUPABASE_TEST_HOUSEHOLD_MEMBER_PASSWORD!,
    );

    const { data, error } = await member
      .from("wallets")
      .select("id")
      .eq("id", process.env.SUPABASE_TEST_HOUSEHOLD_WALLET_ID!)
      .maybeSingle();

    expect(error).toBeNull();
    expect(data?.id).toBe(process.env.SUPABASE_TEST_HOUSEHOLD_WALLET_ID);
  });

  it("a non-member cannot read that same household wallet", async () => {
    const userB = await signIn(
      process.env.SUPABASE_TEST_USER_B_EMAIL!,
      process.env.SUPABASE_TEST_USER_B_PASSWORD!,
    );

    const { data, error } = await userB
      .from("wallets")
      .select("id")
      .eq("id", process.env.SUPABASE_TEST_HOUSEHOLD_WALLET_ID!)
      .maybeSingle();

    expect(error).toBeNull();
    expect(data).toBeNull();
  });
});

if (!hasLiveProject) {
  describe("RLS integration tests", () => {
    it.skip("skipped: no live Supabase test project configured (see comment at top of this file)", () => {});
  });
}
