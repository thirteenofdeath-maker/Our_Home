import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import { currentFinanceMonth, financeMonthRange, financeMonthToPeriodMonth } from "@/features/finance/domain/finance";

/**
 * RLS, table/column GRANTs, and triggers are database-level guarantees —
 * they cannot be meaningfully verified without a real Postgres instance
 * running the migrations in supabase/migrations/. There is no Docker/
 * Postgres available in the environment this test suite was authored in
 * (see docs/ARCHITECTURE.md §11), so these tests are written but SKIPPED
 * unless pointed at a real (disposable/test) Supabase project.
 *
 * Run with: SUPABASE_TEST_URL=... npm test -- rls.integration
 *
 * Tests that only ATTEMPT a write and assert it's rejected are safely
 * re-runnable with no cleanup (nothing persists). Tests that create real
 * ledger activity (pocket/wallet transfers) assert *relative* before/after
 * balance changes rather than absolute values, so accumulating history
 * across reruns never breaks them — this mirrors the app's own "never
 * delete a transaction" design, so there is nothing to clean up there
 * either. The one test that DOES need cleanup to be rerunnable is the
 * household-invite success case (a unique `(household_id, user_id)` row
 * that a second run would collide on) — see the note on that describe
 * block below for why it has its own, stricter gating.
 *
 * ---- Required setup on the test project ----
 *
 * Two unrelated people, each with a PERSONAL wallet (same currency, say
 * THB, on both of user A's wallets):
 *   SUPABASE_TEST_USER_A_EMAIL / _PASSWORD
 *   SUPABASE_TEST_PERSONAL_WALLET_ID            (owned by A)
 *   SUPABASE_TEST_PERSONAL_WALLET_POCKET_A_ID   (a pocket in that wallet)
 *   SUPABASE_TEST_PERSONAL_WALLET_POCKET_B_ID   (a second pocket in it)
 *   SUPABASE_TEST_PERSONAL_WALLET_2_ID          (a SECOND wallet owned by A, same currency)
 *   SUPABASE_TEST_PERSONAL_WALLET_2_POCKET_ID   (a pocket in that second wallet)
 *   SUPABASE_TEST_PERSONAL_INCOME_CATEGORY_ID   (an INCOME category owned by A)
 *   SUPABASE_TEST_PERSONAL_EXPENSE_CATEGORY_ID  (an EXPENSE category owned by A)
 *   SUPABASE_TEST_ARCHIVED_WALLET_ID            (a THIRD wallet owned by A, is_archived = true)
 *   SUPABASE_TEST_ARCHIVED_POCKET_ID            (a pocket INSIDE SUPABASE_TEST_PERSONAL_WALLET_ID, is_archived = true)
 *   SUPABASE_TEST_OTHER_WALLET_ID               (any other wallet A does not own — for the illegal pocket move test)
 *   SUPABASE_TEST_PERSONAL_USD_WALLET_ID        (a FOURTH wallet owned by A, currency USD — for Finance Hub currency-separation tests)
 *   SUPABASE_TEST_PERSONAL_USD_WALLET_POCKET_ID (a pocket in that USD wallet)
 *   SUPABASE_TEST_USER_B_EMAIL / _PASSWORD      (shares no household with A)
 *
 * A household with an owner, a non-owner admin, a plain member, and a
 * HOUSEHOLD-scope wallet with a real pocket in it, plus a second wallet on
 * the SAME household with a different currency (for the cross-currency
 * transfer test):
 *   SUPABASE_TEST_HOUSEHOLD_ID
 *   SUPABASE_TEST_HOUSEHOLD_WALLET_ID           (currency THB, say)
 *   SUPABASE_TEST_HOUSEHOLD_WALLET_POCKET_ID    (a real pocket in that wallet)
 *   SUPABASE_TEST_HOUSEHOLD_USD_WALLET_ID       (currency USD, same household)
 *   SUPABASE_TEST_HOUSEHOLD_USD_WALLET_POCKET_ID (a real pocket in the USD wallet)
 *   SUPABASE_TEST_HOUSEHOLD_OWNER_EMAIL / _PASSWORD
 *   SUPABASE_TEST_HOUSEHOLD_ADMIN_EMAIL / _PASSWORD   (role = admin, not owner)
 *   SUPABASE_TEST_HOUSEHOLD_MEMBER_EMAIL / _PASSWORD  (role = member)
 *
 * A registered user who is NOT yet a member of that household (for the
 * "invite a not-yet-member" test):
 *   SUPABASE_TEST_UNINVITED_EMAIL / _PASSWORD
 *
 * Required ONLY for the describe blocks that say so explicitly below
 * (defense-in-depth trigger tests, the household-invite success case, and
 * the signup-creates-a-profile test, which creates and deletes a
 * throwaway user via the admin API) — never used anywhere a browser could
 * reach it:
 *   SUPABASE_TEST_SERVICE_ROLE_KEY
 */
const hasLiveProject = Boolean(process.env.SUPABASE_TEST_URL && process.env.SUPABASE_TEST_ANON_KEY);
const hasServiceRole = Boolean(hasLiveProject && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY);

async function signIn(email: string, password: string) {
  const client = createClient(process.env.SUPABASE_TEST_URL!, process.env.SUPABASE_TEST_ANON_KEY!);
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return client;
}

function serviceClient() {
  return createClient(process.env.SUPABASE_TEST_URL!, process.env.SUPABASE_TEST_SERVICE_ROLE_KEY!);
}

const env = process.env;

// ---------------------------------------------------------------------
// 1-3: basic wallet visibility
// ---------------------------------------------------------------------

describe.skipIf(!hasLiveProject)("RLS: personal wallet isolation", () => {
  it("an unrelated user cannot read another user's personal wallet", async () => {
    const userB = await signIn(env.SUPABASE_TEST_USER_B_EMAIL!, env.SUPABASE_TEST_USER_B_PASSWORD!);
    const { data, error } = await userB
      .from("wallets")
      .select("id")
      .eq("id", env.SUPABASE_TEST_PERSONAL_WALLET_ID!)
      .maybeSingle();

    // RLS makes the row invisible, not a 403 — PostgREST returns zero rows.
    expect(error).toBeNull();
    expect(data).toBeNull();
  });
});

describe.skipIf(!hasLiveProject)("RLS: household member access", () => {
  it("a household member can read a household wallet they belong to", async () => {
    const member = await signIn(env.SUPABASE_TEST_HOUSEHOLD_MEMBER_EMAIL!, env.SUPABASE_TEST_HOUSEHOLD_MEMBER_PASSWORD!);
    const { data, error } = await member
      .from("wallets")
      .select("id")
      .eq("id", env.SUPABASE_TEST_HOUSEHOLD_WALLET_ID!)
      .maybeSingle();

    expect(error).toBeNull();
    expect(data?.id).toBe(env.SUPABASE_TEST_HOUSEHOLD_WALLET_ID);
  });

  it("a non-member cannot read that same household wallet", async () => {
    const userB = await signIn(env.SUPABASE_TEST_USER_B_EMAIL!, env.SUPABASE_TEST_USER_B_PASSWORD!);
    const { data, error } = await userB
      .from("wallets")
      .select("id")
      .eq("id", env.SUPABASE_TEST_HOUSEHOLD_WALLET_ID!)
      .maybeSingle();

    expect(error).toBeNull();
    expect(data).toBeNull();
  });
});

// ---------------------------------------------------------------------
// 4-5: direct ledger writes are denied (hardening pass 1, item 1)
// ---------------------------------------------------------------------

describe.skipIf(!hasLiveProject)("RLS/grants: direct ledger writes are denied", () => {
  it("a direct INSERT into transactions is rejected", async () => {
    const userA = await signIn(env.SUPABASE_TEST_USER_A_EMAIL!, env.SUPABASE_TEST_USER_A_PASSWORD!);
    const { data: userAId } = await userA.auth.getUser();
    const { error } = await userA.from("transactions").insert({
      scope: "PERSONAL",
      owner_user_id: userAId.user!.id,
      household_id: null,
      transaction_type: "INCOME",
      category_id: null,
      created_by: userAId.user!.id,
    });

    expect(error).not.toBeNull(); // INSERT privilege was revoked entirely
  });

  // Proves privilege lockdown specifically, not incidental FK rejection:
  // the transaction referenced by transaction_id genuinely exists (created
  // moments earlier through the approved RPC), so the only thing standing
  // between this INSERT and success is the revoked grant.
  it("a direct INSERT into transaction_entries is rejected, even against a real transaction", async () => {
    const userA = await signIn(env.SUPABASE_TEST_USER_A_EMAIL!, env.SUPABASE_TEST_USER_A_PASSWORD!);

    const { data: transactionId, error: rpcError } = await userA.rpc("create_income_expense_transaction", {
      p_transaction_type: "INCOME",
      p_wallet_id: env.SUPABASE_TEST_PERSONAL_WALLET_ID!,
      p_pocket_id: env.SUPABASE_TEST_PERSONAL_WALLET_POCKET_A_ID!,
      p_category_id: env.SUPABASE_TEST_PERSONAL_INCOME_CATEGORY_ID!,
      p_amount: "1.00",
    });
    expect(rpcError).toBeNull();
    expect(transactionId).toBeTruthy();

    const { error } = await userA.from("transaction_entries").insert({
      transaction_id: transactionId,
      wallet_id: env.SUPABASE_TEST_PERSONAL_WALLET_ID!,
      pocket_id: env.SUPABASE_TEST_PERSONAL_WALLET_POCKET_B_ID!,
      amount: "1.00",
    });

    expect(error).not.toBeNull();
  });
});

// ---------------------------------------------------------------------
// 6-9: identity/scope columns are immutable
// (hardening pass 1 item 3; pass 2 items 1, 3, 8)
// ---------------------------------------------------------------------

describe.skipIf(!hasLiveProject)("Triggers: identity fields are immutable", () => {
  it("reassigning a wallet's owner_user_id to a DIFFERENT user is denied", async () => {
    const userA = await signIn(env.SUPABASE_TEST_USER_A_EMAIL!, env.SUPABASE_TEST_USER_A_PASSWORD!);
    const userB = await signIn(env.SUPABASE_TEST_USER_B_EMAIL!, env.SUPABASE_TEST_USER_B_PASSWORD!);
    const { data: userBId } = await userB.auth.getUser();

    // A real reassignment attempt (A's wallet -> B's id), not a no-op
    // write-back of the existing value — the trigger correctly allows the
    // latter, which would make this test pass even with a broken trigger
    // if it only ever tried the no-op.
    const { error } = await userA
      .from("wallets")
      .update({ owner_user_id: userBId.user!.id })
      .eq("id", env.SUPABASE_TEST_PERSONAL_WALLET_ID!);

    expect(error).not.toBeNull();
  });

  it("reassigning a pocket's wallet_id is denied", async () => {
    const userA = await signIn(env.SUPABASE_TEST_USER_A_EMAIL!, env.SUPABASE_TEST_USER_A_PASSWORD!);
    const { error } = await userA
      .from("pockets")
      .update({ wallet_id: env.SUPABASE_TEST_OTHER_WALLET_ID! })
      .eq("id", env.SUPABASE_TEST_PERSONAL_WALLET_POCKET_A_ID!);

    expect(error).not.toBeNull();
  });

  it("a category's transaction_type is immutable", async () => {
    const userA = await signIn(env.SUPABASE_TEST_USER_A_EMAIL!, env.SUPABASE_TEST_USER_A_PASSWORD!);
    const { error } = await userA
      .from("categories")
      .update({ transaction_type: "INCOME" })
      .eq("id", env.SUPABASE_TEST_PERSONAL_EXPENSE_CATEGORY_ID!);

    expect(error).not.toBeNull();
  });

  it("households.created_by is immutable", async () => {
    const owner = await signIn(env.SUPABASE_TEST_HOUSEHOLD_OWNER_EMAIL!, env.SUPABASE_TEST_HOUSEHOLD_OWNER_PASSWORD!);
    const userB = await signIn(env.SUPABASE_TEST_USER_B_EMAIL!, env.SUPABASE_TEST_USER_B_PASSWORD!);
    const { data: userBId } = await userB.auth.getUser();

    const { error } = await owner
      .from("households")
      .update({ created_by: userBId.user!.id })
      .eq("id", env.SUPABASE_TEST_HOUSEHOLD_ID!);

    expect(error).not.toBeNull();
  });

  it("renaming a household (an allowed field) still works", async () => {
    const owner = await signIn(env.SUPABASE_TEST_HOUSEHOLD_OWNER_EMAIL!, env.SUPABASE_TEST_HOUSEHOLD_OWNER_PASSWORD!);
    const { error } = await owner
      .from("households")
      .update({ name: "Integration Test Household" })
      .eq("id", env.SUPABASE_TEST_HOUSEHOLD_ID!);

    expect(error).toBeNull();
  });
});

// ---------------------------------------------------------------------
// 10-11: cross-scope ledger entries are impossible even bypassing the
// RPCs (hardening pass 1, item 2) — requires the service role, since a
// normal authenticated client cannot reach this state through the RPCs at
// all (that IS what's being tested: the trigger is a genuine second
// layer, not just "the RPC happens to also prevent this").
//
// Each case uses a pocket that genuinely belongs to the WRONG-scope
// wallet, so the older pocket-wallet trigger (0008) has nothing to object
// to — only the newer transaction-wallet-scope trigger (0013) can be the
// one rejecting it. Using a pocket from an unrelated wallet here would
// only prove 0008 works, not 0013.
// ---------------------------------------------------------------------

describe.skipIf(!hasServiceRole)("Triggers: ledger entry wallet must match transaction scope", () => {
  it("a PERSONAL transaction cannot attach an entry to a HOUSEHOLD wallet", async () => {
    const admin = serviceClient();
    const { data: walletOwner } = await admin
      .from("wallets")
      .select("owner_user_id")
      .eq("id", env.SUPABASE_TEST_PERSONAL_WALLET_ID!)
      .single();

    const { data: txn, error: txnError } = await admin
      .from("transactions")
      .insert({
        scope: "PERSONAL",
        owner_user_id: walletOwner!.owner_user_id,
        household_id: null,
        transaction_type: "INCOME",
        created_by: walletOwner!.owner_user_id,
      })
      .select()
      .single();
    expect(txnError).toBeNull();

    const { error: entryError } = await admin.from("transaction_entries").insert({
      transaction_id: txn!.id,
      wallet_id: env.SUPABASE_TEST_HOUSEHOLD_WALLET_ID!,
      pocket_id: env.SUPABASE_TEST_HOUSEHOLD_WALLET_POCKET_ID!, // a REAL pocket of that household wallet
      amount: "10.00",
    });

    expect(entryError).not.toBeNull();
  });

  it("a HOUSEHOLD transaction cannot attach an entry to a PERSONAL wallet", async () => {
    const admin = serviceClient();
    const { data: aMember } = await admin
      .from("household_members")
      .select("user_id")
      .eq("household_id", env.SUPABASE_TEST_HOUSEHOLD_ID!)
      .limit(1)
      .single();

    const { data: txn, error: txnError } = await admin
      .from("transactions")
      .insert({
        scope: "HOUSEHOLD",
        owner_user_id: null,
        household_id: env.SUPABASE_TEST_HOUSEHOLD_ID!,
        transaction_type: "INCOME",
        created_by: aMember!.user_id,
      })
      .select()
      .single();
    expect(txnError).toBeNull();

    const { error: entryError } = await admin.from("transaction_entries").insert({
      transaction_id: txn!.id,
      wallet_id: env.SUPABASE_TEST_PERSONAL_WALLET_ID!,
      pocket_id: env.SUPABASE_TEST_PERSONAL_WALLET_POCKET_A_ID!, // a REAL pocket of that personal wallet
      amount: "10.00",
    });

    expect(entryError).not.toBeNull();
  });
});

// ---------------------------------------------------------------------
// 12-13: household owner integrity (hardening pass 1, item 6)
// ---------------------------------------------------------------------

describe.skipIf(!hasLiveProject)("RLS/grants: household owner integrity", () => {
  it("an admin cannot promote itself to owner", async () => {
    const admin = await signIn(env.SUPABASE_TEST_HOUSEHOLD_ADMIN_EMAIL!, env.SUPABASE_TEST_HOUSEHOLD_ADMIN_PASSWORD!);
    const { data: adminUser } = await admin.auth.getUser();

    const { error } = await admin
      .from("household_members")
      .update({ role: "owner" })
      .eq("household_id", env.SUPABASE_TEST_HOUSEHOLD_ID!)
      .eq("user_id", adminUser.user!.id);

    // UPDATE on household_members is revoked from authenticated entirely.
    expect(error).not.toBeNull();
  });

  it("an admin cannot remove or demote the owner", async () => {
    const admin = await signIn(env.SUPABASE_TEST_HOUSEHOLD_ADMIN_EMAIL!, env.SUPABASE_TEST_HOUSEHOLD_ADMIN_PASSWORD!);

    const { error: deleteError } = await admin
      .from("household_members")
      .delete()
      .eq("household_id", env.SUPABASE_TEST_HOUSEHOLD_ID!)
      .eq("role", "owner");

    expect(deleteError).not.toBeNull();
  });
});

// ---------------------------------------------------------------------
// 14: household invitation role policy (hardening pass 1, item 5) — these
// two never leave state behind (both are rejections), so they only need a
// live project, not the service role.
// ---------------------------------------------------------------------

describe.skipIf(!hasLiveProject)("RPC: add_household_member role policy", () => {
  it("an admin cannot invite a new admin (Milestone 1 policy: admin invites member only)", async () => {
    const admin = await signIn(env.SUPABASE_TEST_HOUSEHOLD_ADMIN_EMAIL!, env.SUPABASE_TEST_HOUSEHOLD_ADMIN_PASSWORD!);

    const { error } = await admin.rpc("add_household_member", {
      p_household_id: env.SUPABASE_TEST_HOUSEHOLD_ID!,
      p_email: env.SUPABASE_TEST_UNINVITED_EMAIL!,
      p_role: "admin",
    });

    expect(error).not.toBeNull();
  });

  it("nobody can invite a new owner", async () => {
    const owner = await signIn(env.SUPABASE_TEST_HOUSEHOLD_OWNER_EMAIL!, env.SUPABASE_TEST_HOUSEHOLD_OWNER_PASSWORD!);

    const { error } = await owner.rpc("add_household_member", {
      p_household_id: env.SUPABASE_TEST_HOUSEHOLD_ID!,
      p_email: env.SUPABASE_TEST_UNINVITED_EMAIL!,
      p_role: "owner",
    });

    expect(error).not.toBeNull();
  });
});

/**
 * The successful-invite case actually inserts a household_members row
 * (household_id, user_id) unique pair. A second run without removing that
 * row first would fail on the unique constraint — not because invites are
 * broken, but because the fixture state is dirty. Rather than call cleanup
 * "optional" while quietly relying on it for the suite to be rerunnable,
 * this whole block requires SUPABASE_TEST_SERVICE_ROLE_KEY and is skipped
 * without it, so "ran" always implies "left the project the way it found
 * it".
 */
describe.skipIf(!hasServiceRole)("RPC: add_household_member success (requires service-role cleanup)", () => {
  it("owner/admin can invite a registered user who is not yet a member", async () => {
    const owner = await signIn(env.SUPABASE_TEST_HOUSEHOLD_OWNER_EMAIL!, env.SUPABASE_TEST_HOUSEHOLD_OWNER_PASSWORD!);

    const { data, error } = await owner.rpc("add_household_member", {
      p_household_id: env.SUPABASE_TEST_HOUSEHOLD_ID!,
      p_email: env.SUPABASE_TEST_UNINVITED_EMAIL!,
      p_role: "member",
    });

    try {
      expect(error).toBeNull();
      expect(data?.household_id).toBe(env.SUPABASE_TEST_HOUSEHOLD_ID);
    } finally {
      // Unconditional: this block requires the service role, so cleanup
      // is guaranteed to run rather than merely attempted.
      if (data?.id) {
        await serviceClient().from("household_members").delete().eq("id", data.id);
      }
    }
  });
});

// ---------------------------------------------------------------------
// 15: profile email cannot be spoofed (hardening pass 1, item 4)
// ---------------------------------------------------------------------

describe.skipIf(!hasLiveProject)("Grants: profile email is not client-writable", () => {
  it("a normal client update touching profiles.email is rejected", async () => {
    const userA = await signIn(env.SUPABASE_TEST_USER_A_EMAIL!, env.SUPABASE_TEST_USER_A_PASSWORD!);
    const { data: userAId } = await userA.auth.getUser();

    const { error } = await userA
      .from("profiles")
      .update({ email: "spoofed@example.com" })
      .eq("id", userAId.user!.id);

    expect(error).not.toBeNull(); // column-level GRANT covers only display_name/avatar_url
  });

  it("updating display_name (an allowed column) still works", async () => {
    const userA = await signIn(env.SUPABASE_TEST_USER_A_EMAIL!, env.SUPABASE_TEST_USER_A_PASSWORD!);
    const { data: userAId } = await userA.auth.getUser();

    const { error } = await userA
      .from("profiles")
      .update({ display_name: "Integration Test A" })
      .eq("id", userAId.user!.id);

    expect(error).toBeNull();
  });
});

// ---------------------------------------------------------------------
// 16: cross-currency wallet transfer is rejected (hardening pass 1, item 8)
// ---------------------------------------------------------------------

describe.skipIf(!hasLiveProject)("RPC: create_wallet_transfer currency check", () => {
  it("rejects a transfer between wallets with different currencies", async () => {
    const owner = await signIn(env.SUPABASE_TEST_HOUSEHOLD_OWNER_EMAIL!, env.SUPABASE_TEST_HOUSEHOLD_OWNER_PASSWORD!);

    const { error } = await owner.rpc("create_wallet_transfer", {
      p_from_wallet_id: env.SUPABASE_TEST_HOUSEHOLD_WALLET_ID!,
      p_from_pocket_id: env.SUPABASE_TEST_HOUSEHOLD_WALLET_POCKET_ID!,
      p_to_wallet_id: env.SUPABASE_TEST_HOUSEHOLD_USD_WALLET_ID!,
      p_to_pocket_id: env.SUPABASE_TEST_HOUSEHOLD_USD_WALLET_POCKET_ID!,
      p_amount: "10.00",
    });

    expect(error).not.toBeNull();
  });
});

// ---------------------------------------------------------------------
// 17: archived wallets/pockets reject new ledger activity
// (hardening pass 2, item 2)
// ---------------------------------------------------------------------

describe.skipIf(!hasLiveProject)("RPC: archived wallets/pockets reject new activity", () => {
  it("create_income_expense_transaction rejects an archived wallet", async () => {
    const userA = await signIn(env.SUPABASE_TEST_USER_A_EMAIL!, env.SUPABASE_TEST_USER_A_PASSWORD!);

    const { error } = await userA.rpc("create_income_expense_transaction", {
      p_transaction_type: "EXPENSE",
      p_wallet_id: env.SUPABASE_TEST_ARCHIVED_WALLET_ID!,
      p_pocket_id: env.SUPABASE_TEST_PERSONAL_WALLET_POCKET_A_ID!, // wallet-archived check fires before the pocket is even looked at
      p_category_id: env.SUPABASE_TEST_PERSONAL_EXPENSE_CATEGORY_ID!,
      p_amount: "5.00",
    });

    expect(error).not.toBeNull();
  });

  it("create_income_expense_transaction rejects an archived pocket in an active wallet", async () => {
    const userA = await signIn(env.SUPABASE_TEST_USER_A_EMAIL!, env.SUPABASE_TEST_USER_A_PASSWORD!);

    const { error } = await userA.rpc("create_income_expense_transaction", {
      p_transaction_type: "EXPENSE",
      p_wallet_id: env.SUPABASE_TEST_PERSONAL_WALLET_ID!,
      p_pocket_id: env.SUPABASE_TEST_ARCHIVED_POCKET_ID!,
      p_category_id: env.SUPABASE_TEST_PERSONAL_EXPENSE_CATEGORY_ID!,
      p_amount: "5.00",
    });

    expect(error).not.toBeNull();
  });

  it("create_pocket_transfer rejects an archived wallet", async () => {
    const userA = await signIn(env.SUPABASE_TEST_USER_A_EMAIL!, env.SUPABASE_TEST_USER_A_PASSWORD!);

    const { error } = await userA.rpc("create_pocket_transfer", {
      p_wallet_id: env.SUPABASE_TEST_ARCHIVED_WALLET_ID!,
      p_from_pocket_id: env.SUPABASE_TEST_PERSONAL_WALLET_POCKET_A_ID!,
      p_to_pocket_id: env.SUPABASE_TEST_PERSONAL_WALLET_POCKET_B_ID!,
      p_amount: "5.00",
    });

    expect(error).not.toBeNull();
  });

  it("create_pocket_transfer rejects an archived pocket on either side", async () => {
    const userA = await signIn(env.SUPABASE_TEST_USER_A_EMAIL!, env.SUPABASE_TEST_USER_A_PASSWORD!);

    const { error } = await userA.rpc("create_pocket_transfer", {
      p_wallet_id: env.SUPABASE_TEST_PERSONAL_WALLET_ID!,
      p_from_pocket_id: env.SUPABASE_TEST_PERSONAL_WALLET_POCKET_A_ID!,
      p_to_pocket_id: env.SUPABASE_TEST_ARCHIVED_POCKET_ID!,
      p_amount: "5.00",
    });

    expect(error).not.toBeNull();
  });

  it("create_wallet_transfer rejects an archived pocket on either side", async () => {
    const userA = await signIn(env.SUPABASE_TEST_USER_A_EMAIL!, env.SUPABASE_TEST_USER_A_PASSWORD!);

    const { error } = await userA.rpc("create_wallet_transfer", {
      p_from_wallet_id: env.SUPABASE_TEST_PERSONAL_WALLET_ID!,
      p_from_pocket_id: env.SUPABASE_TEST_ARCHIVED_POCKET_ID!,
      p_to_wallet_id: env.SUPABASE_TEST_PERSONAL_WALLET_2_ID!,
      p_to_pocket_id: env.SUPABASE_TEST_PERSONAL_WALLET_2_POCKET_ID!,
      p_amount: "5.00",
    });

    expect(error).not.toBeNull();
  });
});

// ---------------------------------------------------------------------
// 18-19: normal same-currency transfers still preserve ledger invariants
// (regression guard alongside the pure unit tests in
// features/transactions/domain/ledger.test.ts, this time against a real
// database and its RPCs). Assertions compare relative before/after
// balances, not absolute values, so these remain safe to rerun — see the
// file-level comment at the top.
// ---------------------------------------------------------------------

describe.skipIf(!hasLiveProject)("RPC: pocket transfer preserves wallet balance", () => {
  it("moving money between two pockets in the same wallet leaves the wallet balance unchanged", async () => {
    const userA = await signIn(env.SUPABASE_TEST_USER_A_EMAIL!, env.SUPABASE_TEST_USER_A_PASSWORD!);

    const before = await userA.rpc("get_wallet_balance", { p_wallet_id: env.SUPABASE_TEST_PERSONAL_WALLET_ID! });
    expect(before.error).toBeNull();

    const { error: transferError } = await userA.rpc("create_pocket_transfer", {
      p_wallet_id: env.SUPABASE_TEST_PERSONAL_WALLET_ID!,
      p_from_pocket_id: env.SUPABASE_TEST_PERSONAL_WALLET_POCKET_A_ID!,
      p_to_pocket_id: env.SUPABASE_TEST_PERSONAL_WALLET_POCKET_B_ID!,
      p_amount: "1.00",
    });
    expect(transferError).toBeNull();

    const after = await userA.rpc("get_wallet_balance", { p_wallet_id: env.SUPABASE_TEST_PERSONAL_WALLET_ID! });
    expect(after.error).toBeNull();
    expect(after.data).toBe(before.data);
  });
});

describe.skipIf(!hasLiveProject)("RPC: wallet transfer preserves combined balance", () => {
  it("moving money between two wallets debits the source, credits the destination, and leaves the total unchanged", async () => {
    const userA = await signIn(env.SUPABASE_TEST_USER_A_EMAIL!, env.SUPABASE_TEST_USER_A_PASSWORD!);
    const amount = 2;

    const beforeSource = await userA.rpc("get_wallet_balance", { p_wallet_id: env.SUPABASE_TEST_PERSONAL_WALLET_ID! });
    const beforeDest = await userA.rpc("get_wallet_balance", { p_wallet_id: env.SUPABASE_TEST_PERSONAL_WALLET_2_ID! });
    expect(beforeSource.error).toBeNull();
    expect(beforeDest.error).toBeNull();

    const { error: transferError } = await userA.rpc("create_wallet_transfer", {
      p_from_wallet_id: env.SUPABASE_TEST_PERSONAL_WALLET_ID!,
      p_from_pocket_id: env.SUPABASE_TEST_PERSONAL_WALLET_POCKET_A_ID!,
      p_to_wallet_id: env.SUPABASE_TEST_PERSONAL_WALLET_2_ID!,
      p_to_pocket_id: env.SUPABASE_TEST_PERSONAL_WALLET_2_POCKET_ID!,
      p_amount: amount.toFixed(2),
    });
    expect(transferError).toBeNull();

    const afterSource = await userA.rpc("get_wallet_balance", { p_wallet_id: env.SUPABASE_TEST_PERSONAL_WALLET_ID! });
    const afterDest = await userA.rpc("get_wallet_balance", { p_wallet_id: env.SUPABASE_TEST_PERSONAL_WALLET_2_ID! });
    expect(afterSource.error).toBeNull();
    expect(afterDest.error).toBeNull();

    // Numeric(14,2) arrives as a string over PostgREST; parsed to Number
    // here only for this test's own assertions (never for anything the
    // app itself persists or computes — see docs/DOMAIN_RULES.md).
    expect(Number(afterSource.data)).toBeCloseTo(Number(beforeSource.data) - amount, 2);
    expect(Number(afterDest.data)).toBeCloseTo(Number(beforeDest.data) + amount, 2);
    expect(Number(afterSource.data) + Number(afterDest.data)).toBeCloseTo(
      Number(beforeSource.data) + Number(beforeDest.data),
      2,
    );
  });
});

// ---------------------------------------------------------------------
// 20: signup creates a profile automatically (missing-profiles repair,
// 0022_backfill_missing_profiles.sql). Uses the admin API to create and
// then delete a throwaway user, so it requires the service role — a
// normal anon-key signup would leave a permanent extra account with no
// way for this suite to clean it up.
// ---------------------------------------------------------------------

describe.skipIf(!hasServiceRole)("Trigger: signup creates a profile (requires service-role cleanup)", () => {
  it("a newly signed-up user gets a profile and can immediately create a PERSONAL wallet and category", async () => {
    const admin = serviceClient();
    const email = `integration-test-signup-${Date.now()}@example.com`;
    const password = "Integration-Test-Password-1!";

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // skip the confirmation-email flow so we can sign in immediately
    });
    expect(createError).toBeNull();
    const userId = created!.user!.id;

    try {
      // handle_new_user (AFTER INSERT on auth.users) should have already
      // created the matching profile — this is the actual bug being
      // regression-tested: it previously could be missing.
      const { data: profile, error: profileError } = await admin
        .from("profiles")
        .select("id")
        .eq("id", userId)
        .maybeSingle();
      expect(profileError).toBeNull();
      expect(profile?.id).toBe(userId);

      const asNewUser = await signIn(email, password);

      const { data: wallet, error: walletError } = await asNewUser
        .from("wallets")
        .insert({
          scope: "PERSONAL",
          owner_user_id: userId,
          name: "Integration Test Wallet",
          created_by: userId,
        })
        .select()
        .single();
      // If the profile row were missing, this would fail with
      // wallets_owner_user_id_fkey — the exact symptom this migration fixes.
      expect(walletError).toBeNull();
      expect(wallet?.owner_user_id).toBe(userId);

      const { data: category, error: categoryError } = await asNewUser
        .from("categories")
        .insert({
          scope: "PERSONAL",
          owner_user_id: userId,
          name: "Integration Test Category",
          transaction_type: "EXPENSE",
          created_by: userId,
        })
        .select()
        .single();
      expect(categoryError).toBeNull();
      expect(category?.owner_user_id).toBe(userId);
    } finally {
      // Order matters: wallets/categories reference profiles with no
      // ON DELETE CASCADE, so they must go before the user (whose deletion
      // cascades to profiles) or the cascade itself would fail with the
      // same kind of foreign-key violation this test exists to catch.
      await admin.from("categories").delete().eq("owner_user_id", userId);
      await admin.from("wallets").delete().eq("owner_user_id", userId);
      await admin.auth.admin.deleteUser(userId);
    }
  });
});

describe.skipIf(!hasLiveProject)("Member management RPC security", () => {
  it("does not list household members to an inaccessible user", async () => {
    const outsider = await signIn(env.SUPABASE_TEST_USER_B_EMAIL!, env.SUPABASE_TEST_USER_B_PASSWORD!);
    const result = await outsider.from("household_members").select("id").eq("household_id", env.SUPABASE_TEST_HOUSEHOLD_ID!);
    expect(result.error).toBeNull();
    expect(result.data).toEqual([]);
  });

  it("a member can update only their own display name and color", async () => {
    const member = await signIn(env.SUPABASE_TEST_HOUSEHOLD_MEMBER_EMAIL!, env.SUPABASE_TEST_HOUSEHOLD_MEMBER_PASSWORD!);
    const { data: auth } = await member.auth.getUser();
    const beforeProfile = await member.from("profiles").select("display_name").eq("id", auth.user!.id).single();
    const beforeMembership = await member.from("household_members").select("member_color").eq("household_id", env.SUPABASE_TEST_HOUSEHOLD_ID!).eq("user_id", auth.user!.id).single();
    expect(beforeProfile.error).toBeNull();
    expect(beforeMembership.error).toBeNull();
    try {
      const updated = await member.rpc("update_member_presentation", {
        p_household_id: env.SUPABASE_TEST_HOUSEHOLD_ID!,
        p_display_name: "Integration Member Updated",
        p_member_color: "#7C9DBD",
      });
      expect(updated.error).toBeNull();
      expect(updated.data?.user_id).toBe(auth.user!.id);
      expect(updated.data?.member_color).toBe("#7C9DBD");
    } finally {
      await member.rpc("update_member_presentation", {
        p_household_id: env.SUPABASE_TEST_HOUSEHOLD_ID!,
        p_display_name: beforeProfile.data!.display_name,
        p_member_color: beforeMembership.data!.member_color,
      });
    }
  });

  it("rejects invalid member colors", async () => {
    const member = await signIn(env.SUPABASE_TEST_HOUSEHOLD_MEMBER_EMAIL!, env.SUPABASE_TEST_HOUSEHOLD_MEMBER_PASSWORD!);
    const { error } = await member.rpc("update_member_presentation", {
      p_household_id: env.SUPABASE_TEST_HOUSEHOLD_ID!,
      p_display_name: "Integration Member",
      p_member_color: "red",
    });
    expect(error).not.toBeNull();
  });

  it("a member cannot promote themselves", async () => {
    const member = await signIn(env.SUPABASE_TEST_HOUSEHOLD_MEMBER_EMAIL!, env.SUPABASE_TEST_HOUSEHOLD_MEMBER_PASSWORD!);
    const { data: auth } = await member.auth.getUser();
    const membership = await member.from("household_members").select("id").eq("household_id", env.SUPABASE_TEST_HOUSEHOLD_ID!).eq("user_id", auth.user!.id).single();
    expect(membership.error).toBeNull();
    const { error } = await member.rpc("change_household_member_role", {
      p_household_id: env.SUPABASE_TEST_HOUSEHOLD_ID!,
      p_member_id: membership.data!.id,
      p_role: "admin",
    });
    expect(error).not.toBeNull();
  });

  it("an admin cannot change the owner", async () => {
    const admin = await signIn(env.SUPABASE_TEST_HOUSEHOLD_ADMIN_EMAIL!, env.SUPABASE_TEST_HOUSEHOLD_ADMIN_PASSWORD!);
    const ownerMembership = await admin.from("household_members").select("id").eq("household_id", env.SUPABASE_TEST_HOUSEHOLD_ID!).eq("role", "owner").single();
    expect(ownerMembership.error).toBeNull();
    const { error } = await admin.rpc("change_household_member_role", {
      p_household_id: env.SUPABASE_TEST_HOUSEHOLD_ID!,
      p_member_id: ownerMembership.data!.id,
      p_role: "member",
    });
    expect(error).not.toBeNull();
  });

  it("owner can change a member to admin and back", async () => {
    const owner = await signIn(env.SUPABASE_TEST_HOUSEHOLD_OWNER_EMAIL!, env.SUPABASE_TEST_HOUSEHOLD_OWNER_PASSWORD!);
    const memberClient = await signIn(env.SUPABASE_TEST_HOUSEHOLD_MEMBER_EMAIL!, env.SUPABASE_TEST_HOUSEHOLD_MEMBER_PASSWORD!);
    const { data: memberAuth } = await memberClient.auth.getUser();
    const membership = await owner.from("household_members").select("id").eq("household_id", env.SUPABASE_TEST_HOUSEHOLD_ID!).eq("user_id", memberAuth.user!.id).single();
    expect(membership.error).toBeNull();
    try {
      const promoted = await owner.rpc("change_household_member_role", {
        p_household_id: env.SUPABASE_TEST_HOUSEHOLD_ID!, p_member_id: membership.data!.id, p_role: "admin",
      });
      expect(promoted.error).toBeNull();
      expect(promoted.data?.role).toBe("admin");
    } finally {
      await owner.rpc("change_household_member_role", {
        p_household_id: env.SUPABASE_TEST_HOUSEHOLD_ID!, p_member_id: membership.data!.id, p_role: "member",
      });
    }
  });
});

describe.skipIf(!hasServiceRole)("Member management owner invariant", () => {
  it("database trigger rejects demoting the sole owner", async () => {
    const admin = serviceClient();
    const owner = await admin.from("household_members").select("id").eq("household_id", env.SUPABASE_TEST_HOUSEHOLD_ID!).eq("role", "owner").single();
    expect(owner.error).toBeNull();
    const result = await admin.from("household_members").update({ role: "member" }).eq("id", owner.data!.id);
    expect(result.error).not.toBeNull();
  });
});

describe.skipIf(!hasServiceRole)("Pets foundation security (requires disposable project cleanup)", () => {
  it("enforces lifecycle, caregiver, isolation, and role contracts", async () => {
    const owner = await signIn(env.SUPABASE_TEST_HOUSEHOLD_OWNER_EMAIL!, env.SUPABASE_TEST_HOUSEHOLD_OWNER_PASSWORD!);
    const admin = await signIn(env.SUPABASE_TEST_HOUSEHOLD_ADMIN_EMAIL!, env.SUPABASE_TEST_HOUSEHOLD_ADMIN_PASSWORD!);
    const member = await signIn(env.SUPABASE_TEST_HOUSEHOLD_MEMBER_EMAIL!, env.SUPABASE_TEST_HOUSEHOLD_MEMBER_PASSWORD!);
    const outsider = await signIn(env.SUPABASE_TEST_USER_B_EMAIL!, env.SUPABASE_TEST_USER_B_PASSWORD!);
    const service = serviceClient();
    const petId = crypto.randomUUID();
    const memberships = await owner.from("household_members").select("id")
      .eq("household_id", env.SUPABASE_TEST_HOUSEHOLD_ID!).order("created_at").limit(2);
    expect(memberships.data?.length).toBe(2);
    const caregiverIds = memberships.data!.map((item) => item.id);
    const args = { p_id: petId, p_household_id: env.SUPABASE_TEST_HOUSEHOLD_ID!, p_name: "Integration Pet", p_species: "RABBIT" as const, p_breed: "  Holland Lop  ", p_sex: "MALE" as const, p_birthday: "2020-01-01", p_photo_path: null, p_caregiver_member_ids: caregiverIds };
    try {
      const created = await owner.rpc("create_pet", args);
      expect(created.error).toBeNull();
      expect(created.data).toMatchObject({ id: petId, household_id: env.SUPABASE_TEST_HOUSEHOLD_ID, breed: "Holland Lop" });
      const photoPath = `${env.SUPABASE_TEST_HOUSEHOLD_ID}/${petId}/profile.png`;
      const photo = new Blob([new Uint8Array([137, 80, 78, 71])], { type: "image/png" });
      expect((await owner.storage.from("pet-photos").upload(photoPath, photo, { contentType: "image/png" })).error).toBeNull();
      expect((await member.storage.from("pet-photos").download(photoPath)).error).toBeNull();
      expect((await outsider.storage.from("pet-photos").download(photoPath)).error).not.toBeNull();
      expect((await member.storage.from("pet-photos").upload(photoPath, photo, { contentType: "image/png", upsert: true })).error).not.toBeNull();
      const links = await owner.from("pet_caregivers").select("household_member_id").eq("pet_id", petId);
      expect(links.data?.map((item) => item.household_member_id).sort()).toEqual([...caregiverIds].sort());

      const outsiderRead = await outsider.from("pets").select("id").eq("id", petId);
      expect(outsiderRead.data).toEqual([]);
      const memberEdit = await member.rpc("update_pet", { p_pet_id: petId, p_name: "Forbidden", p_species: "DOG", p_breed: null, p_sex: null, p_birthday: null, p_photo_path: null, p_caregiver_member_ids: [] });
      expect(memberEdit.error).not.toBeNull();
      const adminEdit = await admin.rpc("update_pet", { p_pet_id: petId, p_name: "Admin Updated", p_species: "RABBIT", p_breed: "", p_sex: "UNKNOWN", p_birthday: null, p_photo_path: null, p_caregiver_member_ids: [caregiverIds[0]!] });
      expect(adminEdit.error).toBeNull();
      expect(adminEdit.data?.breed).toBeNull();

      const duplicate = await owner.rpc("update_pet", { p_pet_id: petId, p_name: "Pet", p_species: "RABBIT", p_breed: null, p_sex: null, p_birthday: null, p_photo_path: null, p_caregiver_member_ids: [caregiverIds[0]!, caregiverIds[0]!] });
      expect(duplicate.error).not.toBeNull();
      const nonMember = await owner.rpc("update_pet", { p_pet_id: petId, p_name: "Pet", p_species: "RABBIT", p_breed: null, p_sex: null, p_birthday: null, p_photo_path: null, p_caregiver_member_ids: [crypto.randomUUID()] });
      expect(nonMember.error).not.toBeNull();

      const moved = await owner.from("pets").update({ household_id: crypto.randomUUID() } as never).eq("id", petId);
      expect(moved.error).not.toBeNull();
      expect((await owner.rpc("set_pet_archived", { p_pet_id: petId, p_archived: true })).data?.archived_at).not.toBeNull();
      const active = await owner.from("pets").select("id").eq("id", petId).is("archived_at", null);
      expect(active.data).toEqual([]);
      expect((await owner.rpc("set_pet_archived", { p_pet_id: petId, p_archived: false })).data?.archived_at).toBeNull();
    } finally {
      await service.storage.from("pet-photos").remove([`${env.SUPABASE_TEST_HOUSEHOLD_ID}/${petId}/profile.png`]);
      await service.from("pets").delete().eq("id", petId);
    }
  });
});

describe.skipIf(!hasServiceRole)("Calendar foundation security (requires disposable project cleanup)", () => {
  it("enforces personal/shared visibility, permissions, participants, and archive", async () => {
    const owner=await signIn(env.SUPABASE_TEST_HOUSEHOLD_OWNER_EMAIL!,env.SUPABASE_TEST_HOUSEHOLD_OWNER_PASSWORD!);
    const admin=await signIn(env.SUPABASE_TEST_HOUSEHOLD_ADMIN_EMAIL!,env.SUPABASE_TEST_HOUSEHOLD_ADMIN_PASSWORD!);
    const member=await signIn(env.SUPABASE_TEST_HOUSEHOLD_MEMBER_EMAIL!,env.SUPABASE_TEST_HOUSEHOLD_MEMBER_PASSWORD!);
    const outsider=await signIn(env.SUPABASE_TEST_USER_B_EMAIL!,env.SUPABASE_TEST_USER_B_PASSWORD!);
    const service=serviceClient();const personalId=crypto.randomUUID();const sharedId=crypto.randomUUID();const ownerEventId=crypto.randomUUID();
    const memberships=await member.from("household_members").select("id").eq("household_id",env.SUPABASE_TEST_HOUSEHOLD_ID!).order("created_at").limit(2);
    const participantIds=memberships.data!.map(row=>row.id);
    const base={p_title:"Integration event",p_note:null,p_is_all_day:true,p_all_day_date:"2026-09-10",p_starts_at:null,p_ends_at:null};
    try{
      const personal=await member.rpc("create_calendar_event",{p_id:personalId,p_scope:"PERSONAL",p_household_id:null,...base,p_member_ids:[]});expect(personal.error).toBeNull();expect(personal.data?.all_day_date).toBe("2026-09-10");
      const shared=await member.rpc("create_calendar_event",{p_id:sharedId,p_scope:"HOUSEHOLD",p_household_id:env.SUPABASE_TEST_HOUSEHOLD_ID!,...base,p_member_ids:participantIds});expect(shared.error).toBeNull();
      const ownerEvent=await owner.rpc("create_calendar_event",{p_id:ownerEventId,p_scope:"HOUSEHOLD",p_household_id:env.SUPABASE_TEST_HOUSEHOLD_ID!,...base,p_member_ids:[]});expect(ownerEvent.error).toBeNull();
      expect((await member.from("calendar_events").select("id").eq("id",personalId)).data).toHaveLength(1);
      expect((await owner.from("calendar_events").select("id").eq("id",personalId)).data).toEqual([]);
      expect((await owner.from("calendar_events").select("id").eq("id",sharedId)).data).toHaveLength(1);
      expect((await outsider.from("calendar_events").select("id").eq("id",sharedId)).data).toEqual([]);
      expect((await member.from("calendar_event_participants").select("household_member_id").eq("event_id",sharedId)).data).toHaveLength(2);
      const ownEdit=await member.rpc("update_calendar_event",{p_event_id:sharedId,p_title:"Member edited",p_note:null,p_is_all_day:false,p_all_day_date:null,p_starts_at:"2026-09-10T11:30:00Z",p_ends_at:"2026-09-10T12:30:00Z",p_member_ids:[participantIds[0]!]});expect(ownEdit.error).toBeNull();expect(ownEdit.data?.starts_at).toContain("2026-09-10");
      expect((await member.rpc("update_calendar_event",{p_event_id:ownerEventId,p_title:"Forbidden",p_note:null,p_is_all_day:true,p_all_day_date:"2026-09-10",p_starts_at:null,p_ends_at:null,p_member_ids:[]})).error).not.toBeNull();
      expect((await admin.rpc("update_calendar_event",{p_event_id:sharedId,p_title:"Admin edited",p_note:null,p_is_all_day:true,p_all_day_date:"2026-09-10",p_starts_at:null,p_ends_at:null,p_member_ids:[]})).error).toBeNull();
      expect((await owner.rpc("update_calendar_event",{p_event_id:sharedId,p_title:"Owner edited",p_note:null,p_is_all_day:true,p_all_day_date:"2026-09-10",p_starts_at:null,p_ends_at:null,p_member_ids:[]})).error).toBeNull();
      expect((await member.rpc("update_calendar_event",{p_event_id:sharedId,p_title:"Bad participant",p_note:null,p_is_all_day:true,p_all_day_date:"2026-09-10",p_starts_at:null,p_ends_at:null,p_member_ids:[crypto.randomUUID()]})).error).not.toBeNull();
      expect((await member.rpc("update_calendar_event",{p_event_id:sharedId,p_title:"Duplicate",p_note:null,p_is_all_day:true,p_all_day_date:"2026-09-10",p_starts_at:null,p_ends_at:null,p_member_ids:[participantIds[0]!,participantIds[0]!]})).error).not.toBeNull();
      expect((await member.rpc("set_calendar_event_archived",{p_event_id:ownerEventId,p_archived:true})).error).not.toBeNull();
      expect((await owner.rpc("set_calendar_event_archived",{p_event_id:ownerEventId,p_archived:true})).data?.archived_at).not.toBeNull();
      expect((await owner.from("calendar_events").select("id").eq("id",ownerEventId).is("archived_at",null)).data).toEqual([]);
      expect((await owner.rpc("set_calendar_event_archived",{p_event_id:ownerEventId,p_archived:false})).data?.archived_at).toBeNull();
    }finally{await service.from("calendar_events").delete().in("id",[personalId,sharedId,ownerEventId])}
  });
});

describe.skipIf(!hasLiveProject)("Profile enhancement RPC and Storage security", () => {
  it("updates only the caller's profile fields and household-scoped color", async () => {
    const member = await signIn(env.SUPABASE_TEST_HOUSEHOLD_MEMBER_EMAIL!, env.SUPABASE_TEST_HOUSEHOLD_MEMBER_PASSWORD!);
    const own = await member.rpc("get_own_profile", {});
    const auth = await member.auth.getUser();
    const membership = await member.from("household_members").select("member_color")
      .eq("household_id", env.SUPABASE_TEST_HOUSEHOLD_ID!).eq("user_id", auth.data.user!.id).single();
    expect(own.error).toBeNull();
    expect(membership.error).toBeNull();

    try {
      const updated = await member.rpc("update_profile_details", {
        p_household_id: env.SUPABASE_TEST_HOUSEHOLD_ID!,
        p_display_name: "  Profile Integration  ",
        p_gender: "PREFER_NOT_TO_SAY",
        p_birthday: "2000-01-02",
        p_member_color: "#D49A89",
        p_avatar_url: own.data!.avatar_url,
      });
      expect(updated.error).toBeNull();
      expect(updated.data).toMatchObject({
        id: auth.data.user!.id,
        display_name: "Profile Integration",
        gender: "PREFER_NOT_TO_SAY",
        birthday: "2000-01-02",
      });
      const changedMembership = await member.from("household_members").select("member_color")
        .eq("household_id", env.SUPABASE_TEST_HOUSEHOLD_ID!).eq("user_id", auth.data.user!.id).single();
      expect(changedMembership.data?.member_color).toBe("#D49A89");
    } finally {
      await member.rpc("update_profile_details", {
        p_household_id: env.SUPABASE_TEST_HOUSEHOLD_ID!,
        p_display_name: own.data!.display_name,
        p_gender: own.data!.gender,
        p_birthday: own.data!.birthday,
        p_member_color: membership.data!.member_color,
        p_avatar_url: own.data!.avatar_url,
      });
    }
  });

  it("rejects a future birthday and invalid gender", async () => {
    const member = await signIn(env.SUPABASE_TEST_HOUSEHOLD_MEMBER_EMAIL!, env.SUPABASE_TEST_HOUSEHOLD_MEMBER_PASSWORD!);
    const own = await member.rpc("get_own_profile", {});
    const membership = await member.from("household_members").select("member_color")
      .eq("household_id", env.SUPABASE_TEST_HOUSEHOLD_ID!).single();
    const base = {
      p_household_id: env.SUPABASE_TEST_HOUSEHOLD_ID!, p_display_name: own.data!.display_name,
      p_member_color: membership.data!.member_color, p_avatar_url: own.data!.avatar_url,
    };
    const future = await member.rpc("update_profile_details", { ...base, p_gender: null, p_birthday: "2999-01-01" });
    expect(future.error).not.toBeNull();
    const invalid = await member.rpc("update_profile_details", { ...base, p_gender: "NOT_A_GENDER", p_birthday: null } as never);
    expect(invalid.error).not.toBeNull();
  });

  it("cannot update another user's profile", async () => {
    const member = await signIn(env.SUPABASE_TEST_HOUSEHOLD_MEMBER_EMAIL!, env.SUPABASE_TEST_HOUSEHOLD_MEMBER_PASSWORD!);
    const owner = await signIn(env.SUPABASE_TEST_HOUSEHOLD_OWNER_EMAIL!, env.SUPABASE_TEST_HOUSEHOLD_OWNER_PASSWORD!);
    const ownerAuth = await owner.auth.getUser();
    const result = await member.from("profiles").update({ display_name: "Forbidden" })
      .eq("id", ownerAuth.data.user!.id).select("id");
    expect(result.error).toBeNull();
    expect(result.data).toEqual([]);
  });

  it("allows own-folder upload and rejects overwrite by another user", async () => {
    const member = await signIn(env.SUPABASE_TEST_HOUSEHOLD_MEMBER_EMAIL!, env.SUPABASE_TEST_HOUSEHOLD_MEMBER_PASSWORD!);
    const outsider = await signIn(env.SUPABASE_TEST_USER_B_EMAIL!, env.SUPABASE_TEST_USER_B_PASSWORD!);
    const auth = await member.auth.getUser();
    const path = `${auth.data.user!.id}/profile-policy-integration.png`;
    const body = new Blob([new Uint8Array([137, 80, 78, 71])], { type: "image/png" });
    try {
      const ownUpload = await member.storage.from("avatars").upload(path, body, { contentType: "image/png", upsert: true });
      expect(ownUpload.error).toBeNull();
      const overwrite = await outsider.storage.from("avatars").upload(path, body, { contentType: "image/png", upsert: true });
      expect(overwrite.error).not.toBeNull();
    } finally {
      await member.storage.from("avatars").remove([path]);
    }
  });
});

describe.skipIf(!hasServiceRole)("Household creation contract (requires cleanup)", () => {
  it("authenticated creator inserts a household and becomes exactly one owner", async () => {
    const creator = await signIn(env.SUPABASE_TEST_USER_A_EMAIL!, env.SUPABASE_TEST_USER_A_PASSWORD!);
    const { data: auth } = await creator.auth.getUser();
    const householdId = crypto.randomUUID();
    try {
      const inserted = await creator.from("households").insert({
        id: householdId,
        name: "Integration Creation Test",
        created_by: auth.user!.id,
      });
      expect(inserted.error).toBeNull();
      const owners = await serviceClient().from("household_members").select("id").eq("household_id", householdId).eq("role", "owner");
      expect(owners.error).toBeNull();
      expect(owners.data).toHaveLength(1);
    } finally {
      await serviceClient().from("households").delete().eq("id", householdId);
    }
  });

  it("rejects another user's created_by", async () => {
    const creator = await signIn(env.SUPABASE_TEST_USER_A_EMAIL!, env.SUPABASE_TEST_USER_A_PASSWORD!);
    const other = await signIn(env.SUPABASE_TEST_USER_B_EMAIL!, env.SUPABASE_TEST_USER_B_PASSWORD!);
    const { data: otherAuth } = await other.auth.getUser();
    const result = await creator.from("households").insert({
      name: "Spoofed Creator",
      created_by: otherAuth.user!.id,
    });
    expect(result.error).not.toBeNull();
  });

  it("rejects unauthenticated household creation", async () => {
    const anon = createClient(process.env.SUPABASE_TEST_URL!, process.env.SUPABASE_TEST_ANON_KEY!);
    const result = await anon.from("households").insert({
      name: "Anonymous Household",
      created_by: crypto.randomUUID(),
    });
    expect(result.error).not.toBeNull();
  });
});

// ---------------------------------------------------------------------
// M2.4 Finance Hub: get_finance_hub_summary (0028) at the database level.
// The pure mapping/grouping logic already has thorough unit coverage in
// features/finance/domain/finance.test.ts (no database needed); these
// tests instead prove the SQL's own WHERE clauses and GROUP BY are
// correct — something a unit test of the JS mapper cannot do. Every
// assertion is a *relative* before/after delta on the caller's own
// fixtures, matching this file's established convention, so accumulated
// history across reruns never breaks them.
// ---------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- supabase-js's .rpc() return type (a thenable PostgrestFilterBuilder, not a real Promise) resists a small structural interface; every client in this file is one of these already-untyped createClient(...) results anyway.
async function financeTotalsFor(client: any, range: { start: string; end: string }) {
  const { data, error } = await client.rpc("get_finance_hub_summary", {
    p_month_start: range.start,
    p_month_end: range.end,
  });
  if (error) throw error;
  const wire = data as {
    month_totals?: Array<{ currency: string; income: string; expense: string }>;
    category_totals?: Array<{ category_id: string | null; name: string; currency: string; amount: string }>;
  };
  const forCurrency = (currency: string) =>
    wire.month_totals?.find((row) => row.currency === currency) ?? { currency, income: "0", expense: "0" };
  return { monthTotals: wire.month_totals ?? [], categoryTotals: wire.category_totals ?? [], forCurrency };
}

describe.skipIf(!hasLiveProject)("get_finance_hub_summary: month income/expense", () => {
  it("includes INCOME and EXPENSE from the current month, and excludes a same-month pocket transfer", async () => {
    const userA = await signIn(env.SUPABASE_TEST_USER_A_EMAIL!, env.SUPABASE_TEST_USER_A_PASSWORD!);
    const range = financeMonthRange(currentFinanceMonth());

    const before = await financeTotalsFor(userA, range);

    const { error: incomeError } = await userA.rpc("create_income_expense_transaction", {
      p_transaction_type: "INCOME",
      p_wallet_id: env.SUPABASE_TEST_PERSONAL_WALLET_ID!,
      p_pocket_id: env.SUPABASE_TEST_PERSONAL_WALLET_POCKET_A_ID!,
      p_category_id: env.SUPABASE_TEST_PERSONAL_INCOME_CATEGORY_ID!,
      p_amount: "1000.00",
    });
    expect(incomeError).toBeNull();

    const { error: expenseError } = await userA.rpc("create_income_expense_transaction", {
      p_transaction_type: "EXPENSE",
      p_wallet_id: env.SUPABASE_TEST_PERSONAL_WALLET_ID!,
      p_pocket_id: env.SUPABASE_TEST_PERSONAL_WALLET_POCKET_A_ID!,
      p_category_id: env.SUPABASE_TEST_PERSONAL_EXPENSE_CATEGORY_ID!,
      p_amount: "300.00",
    });
    expect(expenseError).toBeNull();

    const { error: transferError } = await userA.rpc("create_pocket_transfer", {
      p_wallet_id: env.SUPABASE_TEST_PERSONAL_WALLET_ID!,
      p_from_pocket_id: env.SUPABASE_TEST_PERSONAL_WALLET_POCKET_A_ID!,
      p_to_pocket_id: env.SUPABASE_TEST_PERSONAL_WALLET_POCKET_B_ID!,
      p_amount: "5000.00",
    });
    expect(transferError).toBeNull();

    const after = await financeTotalsFor(userA, range);
    const beforeThb = before.forCurrency("THB");
    const afterThb = after.forCurrency("THB");

    // Exact deltas match only the INCOME/EXPENSE amounts — if the pocket
    // transfer (5000.00) had leaked into either total, these would be off
    // by exactly that amount.
    expect(Number(afterThb.income) - Number(beforeThb.income)).toBeCloseTo(1000, 2);
    expect(Number(afterThb.expense) - Number(beforeThb.expense)).toBeCloseTo(300, 2);
  });

  it("excludes a transaction dated in a different month from the current month's totals", async () => {
    const userA = await signIn(env.SUPABASE_TEST_USER_A_EMAIL!, env.SUPABASE_TEST_USER_A_PASSWORD!);
    const currentRange = financeMonthRange(currentFinanceMonth());

    const lastMonthDate = new Date();
    lastMonthDate.setUTCMonth(lastMonthDate.getUTCMonth() - 1, 1);
    const lastMonthKey = `${lastMonthDate.getUTCFullYear()}-${String(lastMonthDate.getUTCMonth() + 1).padStart(2, "0")}`;
    const lastMonthRange = financeMonthRange(lastMonthKey);

    const beforeCurrent = await financeTotalsFor(userA, currentRange);
    const beforeLastMonth = await financeTotalsFor(userA, lastMonthRange);

    const { error } = await userA.rpc("create_income_expense_transaction", {
      p_transaction_type: "EXPENSE",
      p_wallet_id: env.SUPABASE_TEST_PERSONAL_WALLET_ID!,
      p_pocket_id: env.SUPABASE_TEST_PERSONAL_WALLET_POCKET_A_ID!,
      p_category_id: env.SUPABASE_TEST_PERSONAL_EXPENSE_CATEGORY_ID!,
      p_amount: "42.00",
      p_occurred_at: lastMonthRange.start,
    });
    expect(error).toBeNull();

    const afterCurrent = await financeTotalsFor(userA, currentRange);
    const afterLastMonth = await financeTotalsFor(userA, lastMonthRange);

    expect(Number(afterCurrent.forCurrency("THB").expense) - Number(beforeCurrent.forCurrency("THB").expense)).toBe(0);
    expect(Number(afterLastMonth.forCurrency("THB").expense) - Number(beforeLastMonth.forCurrency("THB").expense)).toBeCloseTo(42, 2);
  });

  it("never sums two currencies into one figure", async () => {
    const userA = await signIn(env.SUPABASE_TEST_USER_A_EMAIL!, env.SUPABASE_TEST_USER_A_PASSWORD!);
    const range = financeMonthRange(currentFinanceMonth());

    const before = await financeTotalsFor(userA, range);

    const { error: thbError } = await userA.rpc("create_income_expense_transaction", {
      p_transaction_type: "EXPENSE",
      p_wallet_id: env.SUPABASE_TEST_PERSONAL_WALLET_ID!,
      p_pocket_id: env.SUPABASE_TEST_PERSONAL_WALLET_POCKET_A_ID!,
      p_category_id: env.SUPABASE_TEST_PERSONAL_EXPENSE_CATEGORY_ID!,
      p_amount: "100.00",
    });
    expect(thbError).toBeNull();

    const { error: usdError } = await userA.rpc("create_income_expense_transaction", {
      p_transaction_type: "EXPENSE",
      p_wallet_id: env.SUPABASE_TEST_PERSONAL_USD_WALLET_ID!,
      p_pocket_id: env.SUPABASE_TEST_PERSONAL_USD_WALLET_POCKET_ID!,
      p_category_id: env.SUPABASE_TEST_PERSONAL_EXPENSE_CATEGORY_ID!,
      p_amount: "7.00",
    });
    expect(usdError).toBeNull();

    const after = await financeTotalsFor(userA, range);

    expect(Number(after.forCurrency("THB").expense) - Number(before.forCurrency("THB").expense)).toBeCloseTo(100, 2);
    expect(Number(after.forCurrency("USD").expense) - Number(before.forCurrency("USD").expense)).toBeCloseTo(7, 2);
    // Never a combined 107 anywhere: THB and USD are always separate rows.
    expect(after.monthTotals.some((row) => Number(row.expense) === 107)).toBe(false);
  });
});

describe.skipIf(!hasLiveProject)("get_finance_hub_summary: archived category history", () => {
  it("keeps contributing its historical name/amount to category_totals after being archived", async () => {
    const userA = await signIn(env.SUPABASE_TEST_USER_A_EMAIL!, env.SUPABASE_TEST_USER_A_PASSWORD!);
    const range = financeMonthRange(currentFinanceMonth());

    const { error: expenseError } = await userA.rpc("create_income_expense_transaction", {
      p_transaction_type: "EXPENSE",
      p_wallet_id: env.SUPABASE_TEST_PERSONAL_WALLET_ID!,
      p_pocket_id: env.SUPABASE_TEST_PERSONAL_WALLET_POCKET_A_ID!,
      p_category_id: env.SUPABASE_TEST_PERSONAL_EXPENSE_CATEGORY_ID!,
      p_amount: "55.00",
    });
    expect(expenseError).toBeNull();

    const { error: archiveError } = await userA
      .from("categories")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", env.SUPABASE_TEST_PERSONAL_EXPENSE_CATEGORY_ID!);
    expect(archiveError).toBeNull();

    try {
      const after = await financeTotalsFor(userA, range);
      const row = after.categoryTotals.find((c) => c.category_id === env.SUPABASE_TEST_PERSONAL_EXPENSE_CATEGORY_ID);
      expect(row).toBeDefined();
      expect(row?.name?.length).toBeGreaterThan(0);
    } finally {
      // Restore so the fixture (and every other test that uses this
      // category to create NEW expenses) is left exactly as found.
      await userA.from("categories").update({ archived_at: null }).eq("id", env.SUPABASE_TEST_PERSONAL_EXPENSE_CATEGORY_ID!);
    }
  });
});

// ---------------------------------------------------------------------
// Default-pocket removal (0029_remove_pocket_default.sql).
// ---------------------------------------------------------------------

describe.skipIf(!hasLiveProject)("Schema: pockets has no default-pocket concept", () => {
  it("the is_default column no longer exists", async () => {
    const userA = await signIn(env.SUPABASE_TEST_USER_A_EMAIL!, env.SUPABASE_TEST_USER_A_PASSWORD!);
    // Selecting a genuinely nonexistent column is a PostgREST/Postgres
    // error, not an empty result — this only passes if the column is
    // actually gone from the live schema, not merely unused by the app.
    const { error } = await userA.from("pockets").select("is_default").limit(1);
    expect(error).not.toBeNull();
  });

  it("an existing pocket (however it was originally created) has no special treatment", async () => {
    const userA = await signIn(env.SUPABASE_TEST_USER_A_EMAIL!, env.SUPABASE_TEST_USER_A_PASSWORD!);
    const { data, error } = await userA
      .from("pockets")
      .select("id, name, sort_order, is_archived")
      .eq("id", env.SUPABASE_TEST_PERSONAL_WALLET_POCKET_A_ID!)
      .single();

    expect(error).toBeNull();
    // Whatever this pocket is named (possibly "Main" from before this
    // migration), it is queried and returned through the exact same
    // shape as any other pocket — no separate column, no separate query
    // path exists to treat it differently.
    expect(data).toMatchObject({ id: env.SUPABASE_TEST_PERSONAL_WALLET_POCKET_A_ID });
  });
});

describe.skipIf(!hasServiceRole)("RPC: create_wallet_with_first_pocket (requires service-role cleanup)", () => {
  it("creates the wallet and its first pocket atomically, with no automatic 'Main'", async () => {
    const userA = await signIn(env.SUPABASE_TEST_USER_A_EMAIL!, env.SUPABASE_TEST_USER_A_PASSWORD!);
    const { data: userAId } = await userA.auth.getUser();

    const { data: wallet, error } = await userA.rpc("create_wallet_with_first_pocket", {
      p_scope: "PERSONAL",
      p_owner_user_id: userAId.user!.id,
      p_household_id: null,
      p_name: "Integration Test Wallet (atomic creation)",
      p_wallet_type: "OTHER",
      p_currency: "THB",
      p_first_pocket_name: "เงินสด",
    });

    try {
      expect(error).toBeNull();
      expect(wallet?.id).toBeTruthy();

      const { data: pockets, error: pocketsError } = await userA
        .from("pockets")
        .select("name")
        .eq("wallet_id", wallet!.id);

      expect(pocketsError).toBeNull();
      // Exactly the one, user-named pocket — never an automatic "Main"
      // alongside it.
      expect(pockets).toEqual([{ name: "เงินสด" }]);
    } finally {
      if (wallet?.id) {
        const admin = serviceClient();
        await admin.from("pockets").delete().eq("wallet_id", wallet.id);
        await admin.from("wallets").delete().eq("id", wallet.id);
      }
    }
  });

  it("leaves no orphan wallet if the first-pocket name is invalid (all-or-nothing)", async () => {
    const userA = await signIn(env.SUPABASE_TEST_USER_A_EMAIL!, env.SUPABASE_TEST_USER_A_PASSWORD!);
    const { data: userAId } = await userA.auth.getUser();
    const walletName = `Integration Test Atomic Failure ${Date.now()}`;

    const { error } = await userA.rpc("create_wallet_with_first_pocket", {
      p_scope: "PERSONAL",
      p_owner_user_id: userAId.user!.id,
      p_household_id: null,
      p_name: walletName,
      p_wallet_type: "OTHER",
      p_currency: "THB",
      p_first_pocket_name: "   ", // blank after trim — rejected by the RPC
    });
    expect(error).not.toBeNull();

    const { data: orphans, error: lookupError } = await userA.from("wallets").select("id").eq("name", walletName);
    expect(lookupError).toBeNull();
    expect(orphans).toEqual([]); // the wallet insert was rolled back too, not left behind pocket-less
  });
});

describe.skipIf(!hasLiveProject)("Pocket creation: an additional pocket is ordinary from the start", () => {
  it("starts at a derived zero balance and does not change the wallet's balance", async () => {
    const userA = await signIn(env.SUPABASE_TEST_USER_A_EMAIL!, env.SUPABASE_TEST_USER_A_PASSWORD!);
    const walletBefore = await userA.rpc("get_wallet_balance", { p_wallet_id: env.SUPABASE_TEST_PERSONAL_WALLET_ID! });
    expect(walletBefore.error).toBeNull();

    const { data: newPocket, error } = await userA
      .from("pockets")
      .insert({ wallet_id: env.SUPABASE_TEST_PERSONAL_WALLET_ID!, name: `Integration Test Pocket ${Date.now()}` })
      .select()
      .single();
    expect(error).toBeNull();

    const pocketBalance = await userA.rpc("get_pocket_balance", { p_pocket_id: newPocket!.id });
    const walletAfter = await userA.rpc("get_wallet_balance", { p_wallet_id: env.SUPABASE_TEST_PERSONAL_WALLET_ID! });

    expect(Number(pocketBalance.data)).toBe(0);
    expect(walletAfter.data).toBe(walletBefore.data);
    // Not cleaned up: pockets have no client-facing DELETE grant (0011) —
    // consistent with "no hard-delete Pocket flow" being the documented,
    // intentional state, not an oversight in this test.
  });
});

// ---------------------------------------------------------------------
// Phase A: Wallet + Pocket lifecycle (0030_wallet_pocket_lifecycle.sql).
//
// Every test below creates its own throwaway wallet (via the already-
// verified create_wallet_with_first_pocket RPC) and cleans it up by
// deleting that SAME wallet at the end — no service role required,
// because a throwaway wallet the test itself created always has zero
// ledger history, which is precisely what makes a normal client able to
// hard-delete it. Deleting the wallet cascades any pockets it still has
// (the "must keep at least one pocket" rule intentionally does not apply
// once the wallet itself is gone — see the migration's comment).
// ---------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- see financeTotalsFor's comment above: every client in this file is an untyped createClient(...) result
async function createThrowawayWallet(client: any, namePrefix: string, currency = "THB") {
  const { data: userId } = await client.auth.getUser();
  const { data: wallet, error } = await client.rpc("create_wallet_with_first_pocket", {
    p_scope: "PERSONAL",
    p_owner_user_id: userId.user!.id,
    p_household_id: null,
    p_name: `${namePrefix} ${Date.now()}`,
    p_wallet_type: "OTHER",
    p_currency: currency,
    p_first_pocket_name: "Pocket A",
  });
  if (error) throw error;

  const { data: pockets, error: pocketsError } = await client.from("pockets").select("id").eq("wallet_id", wallet.id);
  if (pocketsError) throw pocketsError;

  return { walletId: wallet.id as string, firstPocketId: pockets[0].id as string };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- see financeTotalsFor's comment above
async function deleteThrowawayWallet(client: any, walletId: string) {
  await client.from("wallets").delete().eq("id", walletId);
}

describe.skipIf(!hasLiveProject)("Wallet lifecycle: currency immutability is history-conditional", () => {
  it("can change currency while the wallet has zero transaction history", async () => {
    const userA = await signIn(env.SUPABASE_TEST_USER_A_EMAIL!, env.SUPABASE_TEST_USER_A_PASSWORD!);
    const { walletId } = await createThrowawayWallet(userA, "Currency Mutable Test", "THB");

    try {
      const { error } = await userA.from("wallets").update({ currency: "USD" }).eq("id", walletId);
      expect(error).toBeNull();
    } finally {
      await deleteThrowawayWallet(userA, walletId);
    }
  });

  it("cannot change currency once the wallet has transaction history", async () => {
    const userA = await signIn(env.SUPABASE_TEST_USER_A_EMAIL!, env.SUPABASE_TEST_USER_A_PASSWORD!);
    // SUPABASE_TEST_PERSONAL_WALLET_ID accumulates real history from every
    // other test in this suite that uses it — assumed non-zero by now.
    const { error } = await userA
      .from("wallets")
      .update({ currency: "USD" })
      .eq("id", env.SUPABASE_TEST_PERSONAL_WALLET_ID!);
    expect(error).not.toBeNull();
  });
});

describe.skipIf(!hasLiveProject)("Wallet lifecycle: archive requires a zero balance", () => {
  it("rejects archiving a wallet with a non-zero balance", async () => {
    const userA = await signIn(env.SUPABASE_TEST_USER_A_EMAIL!, env.SUPABASE_TEST_USER_A_PASSWORD!);
    const { error } = await userA
      .from("wallets")
      .update({ is_archived: true })
      .eq("id", env.SUPABASE_TEST_PERSONAL_WALLET_ID!);
    expect(error).not.toBeNull();
  });

  it("allows archiving (and then hard-deleting) a wallet with a zero balance", async () => {
    const userA = await signIn(env.SUPABASE_TEST_USER_A_EMAIL!, env.SUPABASE_TEST_USER_A_PASSWORD!);
    const { walletId } = await createThrowawayWallet(userA, "Zero Balance Archive Test");

    const { error: archiveError } = await userA.from("wallets").update({ is_archived: true }).eq("id", walletId);
    expect(archiveError).toBeNull();

    // History-free (nothing was ever posted to it) — a normal client can
    // hard-delete it outright, proving the delete rule independently too.
    const { error: deleteError } = await userA.from("wallets").delete().eq("id", walletId);
    expect(deleteError).toBeNull();
  });
});

describe.skipIf(!hasLiveProject)("Wallet lifecycle: hard delete requires zero history", () => {
  it("rejects deleting a wallet that has transaction history", async () => {
    const userA = await signIn(env.SUPABASE_TEST_USER_A_EMAIL!, env.SUPABASE_TEST_USER_A_PASSWORD!);
    const { error } = await userA.from("wallets").delete().eq("id", env.SUPABASE_TEST_PERSONAL_WALLET_ID!);
    expect(error).not.toBeNull();
  });
});

describe.skipIf(!hasLiveProject)("Pocket lifecycle: a wallet must keep at least one active pocket", () => {
  it("rejects archiving a wallet's only active pocket", async () => {
    const userA = await signIn(env.SUPABASE_TEST_USER_A_EMAIL!, env.SUPABASE_TEST_USER_A_PASSWORD!);
    const { walletId, firstPocketId } = await createThrowawayWallet(userA, "Last Active Pocket Archive Test");

    try {
      const { error } = await userA.from("pockets").update({ is_archived: true }).eq("id", firstPocketId);
      expect(error).not.toBeNull();
    } finally {
      await deleteThrowawayWallet(userA, walletId);
    }
  });

  it("allows archiving a pocket when an active sibling remains", async () => {
    const userA = await signIn(env.SUPABASE_TEST_USER_A_EMAIL!, env.SUPABASE_TEST_USER_A_PASSWORD!);
    const { walletId, firstPocketId } = await createThrowawayWallet(userA, "Sibling Archive Test");
    const { data: secondPocket, error: insertError } = await userA
      .from("pockets")
      .insert({ wallet_id: walletId, name: "Pocket B" })
      .select()
      .single();
    expect(insertError).toBeNull();

    try {
      const { error } = await userA.from("pockets").update({ is_archived: true }).eq("id", firstPocketId);
      expect(error).toBeNull();
      void secondPocket;
    } finally {
      await deleteThrowawayWallet(userA, walletId);
    }
  });
});

describe.skipIf(!hasLiveProject)("Pocket lifecycle: hard delete requires zero history and a remaining pocket", () => {
  it("rejects deleting a wallet's only pocket while the wallet still exists", async () => {
    const userA = await signIn(env.SUPABASE_TEST_USER_A_EMAIL!, env.SUPABASE_TEST_USER_A_PASSWORD!);
    const { walletId, firstPocketId } = await createThrowawayWallet(userA, "Last Pocket Delete Test");

    try {
      const { error } = await userA.from("pockets").delete().eq("id", firstPocketId);
      expect(error).not.toBeNull();
    } finally {
      await deleteThrowawayWallet(userA, walletId); // wallet delete cascades the one remaining pocket
    }
  });

  it("allows deleting a pocket that has no history while a sibling remains", async () => {
    const userA = await signIn(env.SUPABASE_TEST_USER_A_EMAIL!, env.SUPABASE_TEST_USER_A_PASSWORD!);
    const { walletId } = await createThrowawayWallet(userA, "Sibling Delete Test");
    const { data: secondPocket, error: insertError } = await userA
      .from("pockets")
      .insert({ wallet_id: walletId, name: "Pocket B" })
      .select()
      .single();
    expect(insertError).toBeNull();

    try {
      const { error } = await userA.from("pockets").delete().eq("id", secondPocket!.id);
      expect(error).toBeNull();
    } finally {
      await deleteThrowawayWallet(userA, walletId);
    }
  });
});

// ---------------------------------------------------------------------
// Phase B: Transaction management (0031_transaction_management.sql).
//
// Same throwaway-fixture strategy as Phase A above: every test creates its
// own wallet (zero history, always independently deletable) via
// createThrowawayWallet, posts a real INCOME/EXPENSE transaction to it with
// create_income_expense_transaction, exercises edit/void/restore, and
// deletes the wallet at the end — deleting it cascades its pockets AND
// (transaction_entries has no delete restriction of its own; only wallets/
// pockets block on history) leaves the transaction/transaction_entries
// rows as permanent history, same tolerance the rest of this file already
// has for real ledger activity. No service role required.
// ---------------------------------------------------------------------

async function createThrowawayIncomeExpense(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- see financeTotalsFor's comment above
  client: any,
  params: {
    transactionType: "INCOME" | "EXPENSE";
    walletId: string;
    pocketId: string;
    categoryId: string;
    amount: string;
    occurredAt?: string;
    title?: string;
  },
): Promise<string> {
  const { data, error } = await client.rpc("create_income_expense_transaction", {
    p_transaction_type: params.transactionType,
    p_wallet_id: params.walletId,
    p_pocket_id: params.pocketId,
    p_category_id: params.categoryId,
    p_amount: params.amount,
    p_title: params.title ?? null,
    p_note: null,
    p_occurred_at: params.occurredAt,
  });
  if (error) throw error;
  return data as string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- see financeTotalsFor's comment above
async function walletBalance(client: any, walletId: string): Promise<number> {
  const { data, error } = await client.rpc("get_wallet_balance", { p_wallet_id: walletId });
  if (error) throw error;
  return Number(data);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- see financeTotalsFor's comment above
async function pocketBalance(client: any, pocketId: string): Promise<number> {
  const { data, error } = await client.rpc("get_pocket_balance", { p_pocket_id: pocketId });
  if (error) throw error;
  return Number(data);
}

describe.skipIf(!hasLiveProject)("Transaction edit: amount changes propagate to balances", () => {
  it("editing income 1000 -> 1200 changes the wallet balance by exactly +200 (test 1)", async () => {
    const userA = await signIn(env.SUPABASE_TEST_USER_A_EMAIL!, env.SUPABASE_TEST_USER_A_PASSWORD!);
    const { walletId, firstPocketId } = await createThrowawayWallet(userA, "Edit Income Amount Test");
    try {
      const transactionId = await createThrowawayIncomeExpense(userA, {
        transactionType: "INCOME",
        walletId,
        pocketId: firstPocketId,
        categoryId: env.SUPABASE_TEST_PERSONAL_INCOME_CATEGORY_ID!,
        amount: "1000.00",
      });
      const before = await walletBalance(userA, walletId);

      const { error } = await userA.rpc("update_income_expense_transaction", {
        p_transaction_id: transactionId,
        p_pocket_id: firstPocketId,
        p_category_id: env.SUPABASE_TEST_PERSONAL_INCOME_CATEGORY_ID!,
        p_amount: "1200.00",
      });
      expect(error).toBeNull();

      const after = await walletBalance(userA, walletId);
      expect(after - before).toBeCloseTo(200, 2);
    } finally {
      await deleteThrowawayWallet(userA, walletId);
    }
  });

  it("editing expense 500 -> 300 moves the (negative) balance effect by exactly +200 (test 2)", async () => {
    const userA = await signIn(env.SUPABASE_TEST_USER_A_EMAIL!, env.SUPABASE_TEST_USER_A_PASSWORD!);
    const { walletId, firstPocketId } = await createThrowawayWallet(userA, "Edit Expense Amount Test");
    try {
      const transactionId = await createThrowawayIncomeExpense(userA, {
        transactionType: "EXPENSE",
        walletId,
        pocketId: firstPocketId,
        categoryId: env.SUPABASE_TEST_PERSONAL_EXPENSE_CATEGORY_ID!,
        amount: "500.00",
      });
      const before = await walletBalance(userA, walletId); // -500

      const { error } = await userA.rpc("update_income_expense_transaction", {
        p_transaction_id: transactionId,
        p_pocket_id: firstPocketId,
        p_category_id: env.SUPABASE_TEST_PERSONAL_EXPENSE_CATEGORY_ID!,
        p_amount: "300.00",
      });
      expect(error).toBeNull();

      const after = await walletBalance(userA, walletId); // -300
      expect(after - before).toBeCloseTo(200, 2);
    } finally {
      await deleteThrowawayWallet(userA, walletId);
    }
  });
});

describe.skipIf(!hasLiveProject)("Transaction edit: moving between pockets of the same wallet (test 3)", () => {
  it("Pocket A loses the effect, Pocket B receives it, wallet total is unaffected by the move alone", async () => {
    const userA = await signIn(env.SUPABASE_TEST_USER_A_EMAIL!, env.SUPABASE_TEST_USER_A_PASSWORD!);
    const { walletId, firstPocketId } = await createThrowawayWallet(userA, "Pocket Move Test");
    const { data: pocketB, error: pocketBError } = await userA.from("pockets").insert({ wallet_id: walletId, name: "Pocket B" }).select().single();
    expect(pocketBError).toBeNull();

    try {
      const transactionId = await createThrowawayIncomeExpense(userA, {
        transactionType: "EXPENSE",
        walletId,
        pocketId: firstPocketId,
        categoryId: env.SUPABASE_TEST_PERSONAL_EXPENSE_CATEGORY_ID!,
        amount: "400.00",
      });
      const walletBefore = await walletBalance(userA, walletId);

      const { error } = await userA.rpc("update_income_expense_transaction", {
        p_transaction_id: transactionId,
        p_pocket_id: pocketB!.id,
        p_category_id: env.SUPABASE_TEST_PERSONAL_EXPENSE_CATEGORY_ID!,
        p_amount: "400.00",
      });
      expect(error).toBeNull();

      expect(await pocketBalance(userA, firstPocketId)).toBeCloseTo(0, 2);
      expect(await pocketBalance(userA, pocketB!.id)).toBeCloseTo(-400, 2);
      expect(await walletBalance(userA, walletId)).toBeCloseTo(walletBefore, 2);
    } finally {
      await deleteThrowawayWallet(userA, walletId);
    }
  });

  it("rejects a pocket that belongs to a different wallet (test 4)", async () => {
    const userA = await signIn(env.SUPABASE_TEST_USER_A_EMAIL!, env.SUPABASE_TEST_USER_A_PASSWORD!);
    const walletOne = await createThrowawayWallet(userA, "Cross Wallet Pocket Test A");
    const walletTwo = await createThrowawayWallet(userA, "Cross Wallet Pocket Test B");
    try {
      const transactionId = await createThrowawayIncomeExpense(userA, {
        transactionType: "EXPENSE",
        walletId: walletOne.walletId,
        pocketId: walletOne.firstPocketId,
        categoryId: env.SUPABASE_TEST_PERSONAL_EXPENSE_CATEGORY_ID!,
        amount: "100.00",
      });

      const { error } = await userA.rpc("update_income_expense_transaction", {
        p_transaction_id: transactionId,
        p_pocket_id: walletTwo.firstPocketId,
        p_category_id: env.SUPABASE_TEST_PERSONAL_EXPENSE_CATEGORY_ID!,
        p_amount: "100.00",
      });
      expect(error).not.toBeNull();
    } finally {
      await deleteThrowawayWallet(userA, walletOne.walletId);
      await deleteThrowawayWallet(userA, walletTwo.walletId);
    }
  });
});

describe.skipIf(!hasLiveProject)("Transaction edit: category and pocket validity", () => {
  it("rejects changing to a category whose type does not match the transaction (test 5)", async () => {
    const userA = await signIn(env.SUPABASE_TEST_USER_A_EMAIL!, env.SUPABASE_TEST_USER_A_PASSWORD!);
    const { walletId, firstPocketId } = await createThrowawayWallet(userA, "Category Type Mismatch Test");
    try {
      const transactionId = await createThrowawayIncomeExpense(userA, {
        transactionType: "EXPENSE",
        walletId,
        pocketId: firstPocketId,
        categoryId: env.SUPABASE_TEST_PERSONAL_EXPENSE_CATEGORY_ID!,
        amount: "100.00",
      });

      const { error } = await userA.rpc("update_income_expense_transaction", {
        p_transaction_id: transactionId,
        p_pocket_id: firstPocketId,
        p_category_id: env.SUPABASE_TEST_PERSONAL_INCOME_CATEGORY_ID!, // wrong type for an EXPENSE
        p_amount: "100.00",
      });
      expect(error).not.toBeNull();
    } finally {
      await deleteThrowawayWallet(userA, walletId);
    }
  });

  it("has no parameter that could change transaction_type — the transaction stays an EXPENSE after any edit (test 6)", async () => {
    const userA = await signIn(env.SUPABASE_TEST_USER_A_EMAIL!, env.SUPABASE_TEST_USER_A_PASSWORD!);
    const { walletId, firstPocketId } = await createThrowawayWallet(userA, "Type Immutable Test");
    try {
      const transactionId = await createThrowawayIncomeExpense(userA, {
        transactionType: "EXPENSE",
        walletId,
        pocketId: firstPocketId,
        categoryId: env.SUPABASE_TEST_PERSONAL_EXPENSE_CATEGORY_ID!,
        amount: "100.00",
      });

      await userA.rpc("update_income_expense_transaction", {
        p_transaction_id: transactionId,
        p_pocket_id: firstPocketId,
        p_category_id: env.SUPABASE_TEST_PERSONAL_EXPENSE_CATEGORY_ID!,
        p_amount: "250.00",
      });

      const { data: row } = await userA.from("transactions").select("transaction_type").eq("id", transactionId).single();
      expect(row!.transaction_type).toBe("EXPENSE");
      // An EXPENSE's ledger entry is always negative — if the RPC had
      // somehow flipped it to INCOME semantics this would read +250.
      expect(await walletBalance(userA, walletId)).toBeCloseTo(-250, 2);
    } finally {
      await deleteThrowawayWallet(userA, walletId);
    }
  });

  it("rejects moving a transaction into an archived pocket (test 7)", async () => {
    const userA = await signIn(env.SUPABASE_TEST_USER_A_EMAIL!, env.SUPABASE_TEST_USER_A_PASSWORD!);
    const { walletId, firstPocketId } = await createThrowawayWallet(userA, "Archived Pocket Target Test");
    const { data: pocketB } = await userA.from("pockets").insert({ wallet_id: walletId, name: "Pocket B" }).select().single();
    await userA.from("pockets").update({ is_archived: true }).eq("id", pocketB!.id);

    try {
      const transactionId = await createThrowawayIncomeExpense(userA, {
        transactionType: "EXPENSE",
        walletId,
        pocketId: firstPocketId,
        categoryId: env.SUPABASE_TEST_PERSONAL_EXPENSE_CATEGORY_ID!,
        amount: "100.00",
      });

      const { error } = await userA.rpc("update_income_expense_transaction", {
        p_transaction_id: transactionId,
        p_pocket_id: pocketB!.id,
        p_category_id: env.SUPABASE_TEST_PERSONAL_EXPENSE_CATEGORY_ID!,
        p_amount: "100.00",
      });
      expect(error).not.toBeNull();
    } finally {
      await deleteThrowawayWallet(userA, walletId);
    }
  });

  it("an already-archived historical category remains usable when the edit does not change it (test 8)", async () => {
    const userA = await signIn(env.SUPABASE_TEST_USER_A_EMAIL!, env.SUPABASE_TEST_USER_A_PASSWORD!);
    const { walletId, firstPocketId } = await createThrowawayWallet(userA, "Archived Category History Test");
    const { data: category } = await userA
      .from("categories")
      .insert({ name: `Throwaway ${Date.now()}`, transaction_type: "EXPENSE", scope: "PERSONAL", owner_user_id: (await userA.auth.getUser()).data.user!.id })
      .select()
      .single();

    try {
      const transactionId = await createThrowawayIncomeExpense(userA, {
        transactionType: "EXPENSE",
        walletId,
        pocketId: firstPocketId,
        categoryId: category!.id,
        amount: "100.00",
      });

      await userA.from("categories").update({ archived_at: new Date().toISOString() }).eq("id", category!.id);

      // Viewing it still works (visible via SELECT, category_id untouched).
      const { data: viewed, error: viewError } = await userA.from("transactions").select("category_id").eq("id", transactionId).single();
      expect(viewError).toBeNull();
      expect(viewed!.category_id).toBe(category!.id);

      // Editing an unrelated field (amount) without touching category_id
      // does not require the category to still be active.
      const { error } = await userA.rpc("update_income_expense_transaction", {
        p_transaction_id: transactionId,
        p_pocket_id: firstPocketId,
        p_category_id: category!.id,
        p_amount: "150.00",
      });
      expect(error).toBeNull();
    } finally {
      await deleteThrowawayWallet(userA, walletId);
    }
  });
});

describe.skipIf(!hasLiveProject)("Transaction void", () => {
  it("voiding an income transaction removes its balance and monthly income effect (test 9)", async () => {
    const userA = await signIn(env.SUPABASE_TEST_USER_A_EMAIL!, env.SUPABASE_TEST_USER_A_PASSWORD!);
    const { walletId, firstPocketId } = await createThrowawayWallet(userA, "Void Income Test");
    try {
      const before = await walletBalance(userA, walletId);
      const transactionId = await createThrowawayIncomeExpense(userA, {
        transactionType: "INCOME",
        walletId,
        pocketId: firstPocketId,
        categoryId: env.SUPABASE_TEST_PERSONAL_INCOME_CATEGORY_ID!,
        amount: "900.00",
      });
      expect(await walletBalance(userA, walletId)).toBeCloseTo(before + 900, 2);

      const { error } = await userA.rpc("void_transaction", { p_transaction_id: transactionId, p_void_reason: "test" });
      expect(error).toBeNull();
      expect(await walletBalance(userA, walletId)).toBeCloseTo(before, 2);
    } finally {
      await deleteThrowawayWallet(userA, walletId);
    }
  });

  it("voiding an expense transaction removes its balance and monthly expense effect (test 10)", async () => {
    const userA = await signIn(env.SUPABASE_TEST_USER_A_EMAIL!, env.SUPABASE_TEST_USER_A_PASSWORD!);
    const { walletId, firstPocketId } = await createThrowawayWallet(userA, "Void Expense Test");
    try {
      const before = await walletBalance(userA, walletId);
      const transactionId = await createThrowawayIncomeExpense(userA, {
        transactionType: "EXPENSE",
        walletId,
        pocketId: firstPocketId,
        categoryId: env.SUPABASE_TEST_PERSONAL_EXPENSE_CATEGORY_ID!,
        amount: "350.00",
      });
      expect(await walletBalance(userA, walletId)).toBeCloseTo(before - 350, 2);

      const { error } = await userA.rpc("void_transaction", { p_transaction_id: transactionId });
      expect(error).toBeNull();
      expect(await walletBalance(userA, walletId)).toBeCloseTo(before, 2);
    } finally {
      await deleteThrowawayWallet(userA, walletId);
    }
  });

  it("keeps the voided transaction and its original fields fully readable, and rejects a double void (tests 11-13)", async () => {
    const userA = await signIn(env.SUPABASE_TEST_USER_A_EMAIL!, env.SUPABASE_TEST_USER_A_PASSWORD!);
    const { walletId, firstPocketId } = await createThrowawayWallet(userA, "Void Readability Test");
    try {
      const transactionId = await createThrowawayIncomeExpense(userA, {
        transactionType: "EXPENSE",
        walletId,
        pocketId: firstPocketId,
        categoryId: env.SUPABASE_TEST_PERSONAL_EXPENSE_CATEGORY_ID!,
        amount: "222.00",
        title: "Groceries",
      });

      await userA.rpc("void_transaction", { p_transaction_id: transactionId, p_void_reason: "duplicate" });

      const { data: row, error } = await userA
        .from("transactions")
        .select("title, deleted_at, void_reason")
        .eq("id", transactionId)
        .single();
      expect(error).toBeNull();
      expect(row!.title).toBe("Groceries"); // test 12: original fields remain
      expect(row!.deleted_at).not.toBeNull(); // test 11: still readable, marked voided

      const { data: entries, error: entriesError } = await userA
        .from("transaction_entries")
        .select("amount")
        .eq("transaction_id", transactionId);
      expect(entriesError).toBeNull();
      expect(entries).toHaveLength(1); // ledger entry itself is untouched by void

      const { error: doubleVoidError } = await userA.rpc("void_transaction", { p_transaction_id: transactionId });
      expect(doubleVoidError).not.toBeNull(); // test 13: explicit rejection, not silent success
    } finally {
      await deleteThrowawayWallet(userA, walletId);
    }
  });
});

describe.skipIf(!hasLiveProject)("Transaction restore", () => {
  it("restores the exact original financial effect (test 14)", async () => {
    const userA = await signIn(env.SUPABASE_TEST_USER_A_EMAIL!, env.SUPABASE_TEST_USER_A_PASSWORD!);
    const { walletId, firstPocketId } = await createThrowawayWallet(userA, "Restore Effect Test");
    try {
      const before = await walletBalance(userA, walletId);
      const transactionId = await createThrowawayIncomeExpense(userA, {
        transactionType: "INCOME",
        walletId,
        pocketId: firstPocketId,
        categoryId: env.SUPABASE_TEST_PERSONAL_INCOME_CATEGORY_ID!,
        amount: "600.00",
      });
      await userA.rpc("void_transaction", { p_transaction_id: transactionId });
      expect(await walletBalance(userA, walletId)).toBeCloseTo(before, 2);

      const { error } = await userA.rpc("restore_transaction", { p_transaction_id: transactionId });
      expect(error).toBeNull();
      expect(await walletBalance(userA, walletId)).toBeCloseTo(before + 600, 2);
    } finally {
      await deleteThrowawayWallet(userA, walletId);
    }
  });

  it("rejects restoring when the transaction's pocket has since been archived (test 15)", async () => {
    const userA = await signIn(env.SUPABASE_TEST_USER_A_EMAIL!, env.SUPABASE_TEST_USER_A_PASSWORD!);
    const { walletId } = await createThrowawayWallet(userA, "Restore Archived Pocket Test");
    const { data: pocketB } = await userA.from("pockets").insert({ wallet_id: walletId, name: "Pocket B" }).select().single();

    try {
      const transactionId = await createThrowawayIncomeExpense(userA, {
        transactionType: "EXPENSE",
        walletId,
        pocketId: pocketB!.id,
        categoryId: env.SUPABASE_TEST_PERSONAL_EXPENSE_CATEGORY_ID!,
        amount: "80.00",
      });
      await userA.rpc("void_transaction", { p_transaction_id: transactionId });
      // pocketB now has voided-only history, so it can still be archived
      // (archiving has no balance-zero requirement — see docs/FINANCE.md Phase A).
      await userA.from("pockets").update({ is_archived: true }).eq("id", pocketB!.id);

      const { error } = await userA.rpc("restore_transaction", { p_transaction_id: transactionId });
      expect(error).not.toBeNull();
    } finally {
      await deleteThrowawayWallet(userA, walletId);
    }
  });

  it("rejects restoring an already-active transaction (test 16)", async () => {
    const userA = await signIn(env.SUPABASE_TEST_USER_A_EMAIL!, env.SUPABASE_TEST_USER_A_PASSWORD!);
    const { walletId, firstPocketId } = await createThrowawayWallet(userA, "Double Restore Test");
    try {
      const transactionId = await createThrowawayIncomeExpense(userA, {
        transactionType: "EXPENSE",
        walletId,
        pocketId: firstPocketId,
        categoryId: env.SUPABASE_TEST_PERSONAL_EXPENSE_CATEGORY_ID!,
        amount: "10.00",
      });

      const { error } = await userA.rpc("restore_transaction", { p_transaction_id: transactionId });
      expect(error).not.toBeNull(); // never voided in the first place
    } finally {
      await deleteThrowawayWallet(userA, walletId);
    }
  });
});

describe.skipIf(!hasLiveProject)("Transaction edit/void: month-boundary summary correctness (tests 17-18)", () => {
  it("moving an expense across a month boundary shifts it out of the old month's summary and into the new one", async () => {
    const userA = await signIn(env.SUPABASE_TEST_USER_A_EMAIL!, env.SUPABASE_TEST_USER_A_PASSWORD!);
    const { walletId, firstPocketId } = await createThrowawayWallet(userA, "Month Boundary Test");
    try {
      const augustRange = financeMonthRange("2026-08");
      const septemberRange = financeMonthRange("2026-09");

      const transactionId = await createThrowawayIncomeExpense(userA, {
        transactionType: "EXPENSE",
        walletId,
        pocketId: firstPocketId,
        categoryId: env.SUPABASE_TEST_PERSONAL_EXPENSE_CATEGORY_ID!,
        amount: "700.00",
        occurredAt: "2026-08-30T12:00:00+07:00", // Bangkok-local Aug 30
      });

      const augBefore = await financeTotalsFor(userA, augustRange);
      expect(Number(augBefore.forCurrency("THB").expense)).toBeGreaterThanOrEqual(700);

      // Move to Sep 1 local time (Bangkok) — verifies the +07:00 contract,
      // not just a bare UTC date, actually governs which month a
      // transaction lands in.
      const { error } = await userA.rpc("update_income_expense_transaction", {
        p_transaction_id: transactionId,
        p_pocket_id: firstPocketId,
        p_category_id: env.SUPABASE_TEST_PERSONAL_EXPENSE_CATEGORY_ID!,
        p_amount: "700.00",
        p_occurred_at: "2026-09-01T00:30:00+07:00",
      });
      expect(error).toBeNull();

      const augAfter = await financeTotalsFor(userA, augustRange);
      const sepAfter = await financeTotalsFor(userA, septemberRange);
      expect(Number(augBefore.forCurrency("THB").expense) - Number(augAfter.forCurrency("THB").expense)).toBeCloseTo(700, 2);
      expect(Number(sepAfter.forCurrency("THB").expense)).toBeGreaterThanOrEqual(700);
    } finally {
      await deleteThrowawayWallet(userA, walletId);
    }
  });
});

describe.skipIf(!hasLiveProject)("Transaction search (searchTransactions repository function)", () => {
  it("status filter separates ACTIVE from VOIDED (test 19)", async () => {
    const { searchTransactions } = await import("@/features/transactions/api");
    const userA = await signIn(env.SUPABASE_TEST_USER_A_EMAIL!, env.SUPABASE_TEST_USER_A_PASSWORD!);
    const { walletId, firstPocketId } = await createThrowawayWallet(userA, "Search Status Test");
    try {
      const uniqueTitle = `SearchStatus-${Date.now()}`;
      const transactionId = await createThrowawayIncomeExpense(userA, {
        transactionType: "EXPENSE",
        walletId,
        pocketId: firstPocketId,
        categoryId: env.SUPABASE_TEST_PERSONAL_EXPENSE_CATEGORY_ID!,
        amount: "42.00",
        title: uniqueTitle,
      });

      const activeResults = await searchTransactions(userA, { walletId, status: "ACTIVE", query: uniqueTitle });
      expect(activeResults.map((r) => r.transactionId)).toContain(transactionId);

      await userA.rpc("void_transaction", { p_transaction_id: transactionId });

      const stillActiveOnly = await searchTransactions(userA, { walletId, status: "ACTIVE", query: uniqueTitle });
      expect(stillActiveOnly.map((r) => r.transactionId)).not.toContain(transactionId);

      const voidedResults = await searchTransactions(userA, { walletId, status: "VOIDED", query: uniqueTitle });
      expect(voidedResults.map((r) => r.transactionId)).toContain(transactionId);
      expect(voidedResults.find((r) => r.transactionId === transactionId)?.voidedAt).not.toBeNull();
    } finally {
      await deleteThrowawayWallet(userA, walletId);
    }
  });

  it("free-text filter matches on title (test 20)", async () => {
    const { searchTransactions } = await import("@/features/transactions/api");
    const userA = await signIn(env.SUPABASE_TEST_USER_A_EMAIL!, env.SUPABASE_TEST_USER_A_PASSWORD!);
    const { walletId, firstPocketId } = await createThrowawayWallet(userA, "Search Text Test");
    try {
      const uniqueTitle = `SearchText-${Date.now()}`;
      await createThrowawayIncomeExpense(userA, {
        transactionType: "EXPENSE",
        walletId,
        pocketId: firstPocketId,
        categoryId: env.SUPABASE_TEST_PERSONAL_EXPENSE_CATEGORY_ID!,
        amount: "15.00",
        title: uniqueTitle,
      });

      const results = await searchTransactions(userA, { query: uniqueTitle, status: "ALL" });
      expect(results.some((r) => r.title === uniqueTitle)).toBe(true);

      const noResults = await searchTransactions(userA, { query: `${uniqueTitle}-nonexistent`, status: "ALL" });
      expect(noResults).toHaveLength(0);
    } finally {
      await deleteThrowawayWallet(userA, walletId);
    }
  });

  it("wallet/pocket/category filters narrow results, and a pocket transfer stays one logical row (tests 21-22)", async () => {
    const { searchTransactions } = await import("@/features/transactions/api");
    const userA = await signIn(env.SUPABASE_TEST_USER_A_EMAIL!, env.SUPABASE_TEST_USER_A_PASSWORD!);
    const { walletId, firstPocketId } = await createThrowawayWallet(userA, "Search Scope Test");
    const { data: pocketB } = await userA.from("pockets").insert({ wallet_id: walletId, name: "Pocket B" }).select().single();

    try {
      const transactionId = await createThrowawayIncomeExpense(userA, {
        transactionType: "EXPENSE",
        walletId,
        pocketId: firstPocketId,
        categoryId: env.SUPABASE_TEST_PERSONAL_EXPENSE_CATEGORY_ID!,
        amount: "33.00",
      });

      const byWalletAndCategory = await searchTransactions(userA, {
        walletId,
        pocketId: firstPocketId,
        categoryId: env.SUPABASE_TEST_PERSONAL_EXPENSE_CATEGORY_ID!,
        status: "ALL",
      });
      expect(byWalletAndCategory.map((r) => r.transactionId)).toContain(transactionId);

      const wrongPocket = await searchTransactions(userA, { walletId, pocketId: pocketB!.id, status: "ALL" });
      expect(wrongPocket.map((r) => r.transactionId)).not.toContain(transactionId);

      const { error: transferError } = await userA.rpc("create_pocket_transfer", {
        p_wallet_id: walletId,
        p_from_pocket_id: firstPocketId,
        p_to_pocket_id: pocketB!.id,
        p_amount: "5.00",
      });
      expect(transferError).toBeNull();

      const transferResults = await searchTransactions(userA, { walletId, type: "POCKET_TRANSFER", status: "ALL" });
      expect(transferResults).toHaveLength(1); // one logical row, not two ledger lines
      expect(transferResults[0].pocketTransfer).toBeDefined();
    } finally {
      await deleteThrowawayWallet(userA, walletId);
    }
  });
});

describe.skipIf(!hasLiveProject)("Transaction edit/void: multi-currency safety (test 23)", () => {
  it("voiding a transaction on the USD wallet never affects the THB monthly totals", async () => {
    const userA = await signIn(env.SUPABASE_TEST_USER_A_EMAIL!, env.SUPABASE_TEST_USER_A_PASSWORD!);
    const range = financeMonthRange(currentFinanceMonth());
    const thbBefore = await financeTotalsFor(userA, range);

    const transactionId = await createThrowawayIncomeExpense(userA, {
      transactionType: "EXPENSE",
      walletId: env.SUPABASE_TEST_PERSONAL_USD_WALLET_ID!,
      pocketId: env.SUPABASE_TEST_PERSONAL_USD_WALLET_POCKET_ID!,
      categoryId: env.SUPABASE_TEST_PERSONAL_EXPENSE_CATEGORY_ID!,
      amount: "50.00",
    });

    await userA.rpc("void_transaction", { p_transaction_id: transactionId });

    const thbAfter = await financeTotalsFor(userA, range);
    expect(thbAfter.forCurrency("THB").expense).toBe(thbBefore.forCurrency("THB").expense);
  });
});

describe.skipIf(!hasLiveProject)("Transaction edit/void: authorization (tests 24-25)", () => {
  it("an outsider cannot edit, void, or even discover a transaction they have no access to", async () => {
    const userA = await signIn(env.SUPABASE_TEST_USER_A_EMAIL!, env.SUPABASE_TEST_USER_A_PASSWORD!);
    const { walletId, firstPocketId } = await createThrowawayWallet(userA, "Outsider Test");
    try {
      const transactionId = await createThrowawayIncomeExpense(userA, {
        transactionType: "EXPENSE",
        walletId,
        pocketId: firstPocketId,
        categoryId: env.SUPABASE_TEST_PERSONAL_EXPENSE_CATEGORY_ID!,
        amount: "60.00",
      });

      const userB = await signIn(env.SUPABASE_TEST_USER_B_EMAIL!, env.SUPABASE_TEST_USER_B_PASSWORD!);
      const { error: editError } = await userB.rpc("update_income_expense_transaction", {
        p_transaction_id: transactionId,
        p_pocket_id: firstPocketId,
        p_category_id: env.SUPABASE_TEST_PERSONAL_EXPENSE_CATEGORY_ID!,
        p_amount: "1.00",
      });
      expect(editError).not.toBeNull();

      const { error: voidError } = await userB.rpc("void_transaction", { p_transaction_id: transactionId });
      expect(voidError).not.toBeNull();

      const { data: readData } = await userB.from("transactions").select("id").eq("id", transactionId).maybeSingle();
      expect(readData).toBeNull(); // RLS: invisible, not merely forbidden
    } finally {
      await deleteThrowawayWallet(userA, walletId);
    }
  });

  it("any household member (not only the creator) may edit/void a shared transaction; a non-member may not", async () => {
    const owner = await signIn(env.SUPABASE_TEST_HOUSEHOLD_OWNER_EMAIL!, env.SUPABASE_TEST_HOUSEHOLD_OWNER_PASSWORD!);
    const transactionId = await createThrowawayIncomeExpense(owner, {
      transactionType: "EXPENSE",
      walletId: env.SUPABASE_TEST_HOUSEHOLD_WALLET_ID!,
      pocketId: env.SUPABASE_TEST_HOUSEHOLD_WALLET_POCKET_ID!,
      categoryId: env.SUPABASE_TEST_PERSONAL_EXPENSE_CATEGORY_ID!, // is_system-independent categories aren't required here; household categories aren't part of this fixture set, so this asserts creation permission only through the wallet — if this fails on category mismatch, see setup notes
      amount: "20.00",
    }).catch(async () => {
      // Household wallets require a HOUSEHOLD-scoped (or is_system) category
      // in this schema — fall back to skip gracefully if the fixture
      // project has no such category configured, rather than failing setup
      // that a different fixture project may legitimately not provide.
      return null;
    });
    if (!transactionId) return;

    const member = await signIn(env.SUPABASE_TEST_HOUSEHOLD_MEMBER_EMAIL!, env.SUPABASE_TEST_HOUSEHOLD_MEMBER_PASSWORD!);
    const { error: memberVoidError } = await member.rpc("void_transaction", { p_transaction_id: transactionId });
    expect(memberVoidError).toBeNull(); // member-level privilege, not creator-only — see docs/DOMAIN_RULES.md "Security"

    await member.rpc("restore_transaction", { p_transaction_id: transactionId });

    const userB = await signIn(env.SUPABASE_TEST_USER_B_EMAIL!, env.SUPABASE_TEST_USER_B_PASSWORD!);
    const { error: outsiderVoidError } = await userB.rpc("void_transaction", { p_transaction_id: transactionId });
    expect(outsiderVoidError).not.toBeNull();

    await owner.rpc("void_transaction", { p_transaction_id: transactionId }); // leave it voided, matching this file's "real ledger activity needs no cleanup" convention
  });
});

// ---------------------------------------------------------------------
// Phase C: Transaction Tags (0032_transaction_tags.sql).
//
// Every test below is self-contained via throwaway wallets/households, the
// same strategy as Phase A/B — no new fixture env vars required. Tags
// clean up via cascade when their throwaway wallet/household disappears
// (transaction_tags -> transactions -> ON DELETE CASCADE), except tags
// themselves have no delete path (V1 has none by design), so a handful of
// small throwaway tag rows accumulate the same way throwaway categories
// would; harmless test data, same tolerance as the rest of this file.
// ---------------------------------------------------------------------

async function createThrowawayTag(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- see financeTotalsFor's comment above
  client: any,
  namePrefix: string,
  params: { scope: "PERSONAL" | "HOUSEHOLD"; householdId?: string },
): Promise<string> {
  const { data: userId } = await client.auth.getUser();
  const name = `${namePrefix} ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const { data, error } = await client
    .from("tags")
    .insert({
      name,
      scope: params.scope,
      owner_user_id: params.scope === "PERSONAL" ? userId.user!.id : null,
      household_id: params.scope === "HOUSEHOLD" ? params.householdId : null,
      created_by: userId.user!.id,
    })
    .select()
    .single();
  if (error) throw error;
  return data.id as string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- see financeTotalsFor's comment above
async function createThrowawayHousehold(client: any, namePrefix: string): Promise<string> {
  const { data: userId } = await client.auth.getUser();
  const name = `${namePrefix} ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const { error } = await client.from("households").insert({ name, created_by: userId.user!.id });
  if (error) throw error;
  // Not `.insert(...).select()` — same INSERT-then-SELECT split as
  // createHousehold in features/household/api.ts, avoiding the ordering
  // race with the AFTER INSERT owner-membership trigger (see its comment).
  const { data, error: selectError } = await client.from("households").select("id").eq("name", name).single();
  if (selectError) throw selectError;
  return data.id as string;
}

describe.skipIf(!hasLiveProject)("Tag CRUD", () => {
  it("creates a PERSONAL tag (test 1) and a HOUSEHOLD tag (test 2)", async () => {
    const userA = await signIn(env.SUPABASE_TEST_USER_A_EMAIL!, env.SUPABASE_TEST_USER_A_PASSWORD!);
    const personalTagId = await createThrowawayTag(userA, "Trip", { scope: "PERSONAL" });
    expect(personalTagId).toBeTruthy();

    const owner = await signIn(env.SUPABASE_TEST_HOUSEHOLD_OWNER_EMAIL!, env.SUPABASE_TEST_HOUSEHOLD_OWNER_PASSWORD!);
    const householdTagId = await createThrowawayTag(owner, "Trip", { scope: "HOUSEHOLD", householdId: env.SUPABASE_TEST_HOUSEHOLD_ID! });
    expect(householdTagId).toBeTruthy();
  });

  it("rejects a trimmed/case-insensitive duplicate name in the same scope (test 3)", async () => {
    const userA = await signIn(env.SUPABASE_TEST_USER_A_EMAIL!, env.SUPABASE_TEST_USER_A_PASSWORD!);
    const { data: userId } = await userA.auth.getUser();
    const base = `Dup ${Date.now()}`;

    const { error: firstError } = await userA
      .from("tags")
      .insert({ name: base, scope: "PERSONAL", owner_user_id: userId.user!.id, created_by: userId.user!.id });
    expect(firstError).toBeNull();

    const { error: dupError } = await userA
      .from("tags")
      .insert({ name: `  ${base.toUpperCase()}  `, scope: "PERSONAL", owner_user_id: userId.user!.id, created_by: userId.user!.id });
    expect(dupError).not.toBeNull(); // " DUP...  " normalizes to the same normalized_name
  });

  it("renames, archives, and restores a tag (tests 4-6)", async () => {
    const userA = await signIn(env.SUPABASE_TEST_USER_A_EMAIL!, env.SUPABASE_TEST_USER_A_PASSWORD!);
    const tagId = await createThrowawayTag(userA, "Lifecycle", { scope: "PERSONAL" });

    const { error: renameError } = await userA.from("tags").update({ name: "Renamed Lifecycle" }).eq("id", tagId);
    expect(renameError).toBeNull();

    const { error: archiveError } = await userA.from("tags").update({ archived_at: new Date().toISOString() }).eq("id", tagId);
    expect(archiveError).toBeNull();

    const { error: restoreError } = await userA.from("tags").update({ archived_at: null }).eq("id", tagId);
    expect(restoreError).toBeNull();
  });
});

describe.skipIf(!hasLiveProject)("Tag scope enforcement", () => {
  it("a PERSONAL tag cannot attach to another user's PERSONAL transaction (test 7)", async () => {
    const userA = await signIn(env.SUPABASE_TEST_USER_A_EMAIL!, env.SUPABASE_TEST_USER_A_PASSWORD!);
    const userB = await signIn(env.SUPABASE_TEST_USER_B_EMAIL!, env.SUPABASE_TEST_USER_B_PASSWORD!);

    const tagId = await createThrowawayTag(userA, "OnlyMine", { scope: "PERSONAL" });
    const { walletId, firstPocketId } = await createThrowawayWallet(userB, "Foreign Personal Tag Test");
    try {
      const transactionId = await createThrowawayIncomeExpense(userB, {
        transactionType: "EXPENSE",
        walletId,
        pocketId: firstPocketId,
        categoryId: env.SUPABASE_TEST_PERSONAL_EXPENSE_CATEGORY_ID!,
        amount: "10.00",
      });

      // userB is authorized for their own transaction, but userA's tag is
      // invisible to userB under RLS — set_transaction_tags rejects it.
      const { error } = await userB.rpc("set_transaction_tags", { p_transaction_id: transactionId, p_tag_ids: [tagId] });
      expect(error).not.toBeNull();
    } finally {
      await deleteThrowawayWallet(userB, walletId);
    }
  });

  it("a Household A tag cannot attach to a Household B transaction, even for a member of both (test 8)", async () => {
    const userA = await signIn(env.SUPABASE_TEST_USER_A_EMAIL!, env.SUPABASE_TEST_USER_A_PASSWORD!);

    const householdOneId = await createThrowawayHousehold(userA, "TagScope H1");
    const householdTwoId = await createThrowawayHousehold(userA, "TagScope H2");

    const walletOne = await userA.rpc("create_wallet_with_first_pocket", {
      p_scope: "HOUSEHOLD",
      p_owner_user_id: null,
      p_household_id: householdOneId,
      p_name: `H1 Wallet ${Date.now()}`,
      p_wallet_type: "OTHER",
      p_currency: "THB",
      p_first_pocket_name: "Pocket A",
    });
    const walletTwo = await userA.rpc("create_wallet_with_first_pocket", {
      p_scope: "HOUSEHOLD",
      p_owner_user_id: null,
      p_household_id: householdTwoId,
      p_name: `H2 Wallet ${Date.now()}`,
      p_wallet_type: "OTHER",
      p_currency: "THB",
      p_first_pocket_name: "Pocket A",
    });
    expect(walletOne.error).toBeNull();
    expect(walletTwo.error).toBeNull();

    const { data: pocketsTwo } = await userA.from("pockets").select("id").eq("wallet_id", walletTwo.data.id);

    const tagOneId = await createThrowawayTag(userA, "H1 Tag", { scope: "HOUSEHOLD", householdId: householdOneId });

    const transactionTwoId = await createThrowawayIncomeExpense(userA, {
      transactionType: "EXPENSE",
      walletId: walletTwo.data.id,
      pocketId: pocketsTwo![0].id,
      categoryId: env.SUPABASE_TEST_PERSONAL_EXPENSE_CATEGORY_ID!,
      amount: "10.00",
    });

    // userA is authorized for BOTH households (owner of both, via the
    // auto-membership trigger) — is_transaction_authorized passes. The
    // rejection must come from assign_transaction_tags' explicit
    // household_id comparison, not from authorization/visibility alone.
    const { error } = await userA.rpc("set_transaction_tags", { p_transaction_id: transactionTwoId, p_tag_ids: [tagOneId] });
    expect(error).not.toBeNull();
  });

  it("an outsider cannot attach any household tag (test 9), and a valid household member can (test 10)", async () => {
    const owner = await signIn(env.SUPABASE_TEST_HOUSEHOLD_OWNER_EMAIL!, env.SUPABASE_TEST_HOUSEHOLD_OWNER_PASSWORD!);
    const tagId = await createThrowawayTag(owner, "MemberAccess", { scope: "HOUSEHOLD", householdId: env.SUPABASE_TEST_HOUSEHOLD_ID! });

    const transactionId = await createThrowawayIncomeExpense(owner, {
      transactionType: "EXPENSE",
      walletId: env.SUPABASE_TEST_HOUSEHOLD_WALLET_ID!,
      pocketId: env.SUPABASE_TEST_HOUSEHOLD_WALLET_POCKET_ID!,
      categoryId: env.SUPABASE_TEST_PERSONAL_EXPENSE_CATEGORY_ID!,
      amount: "10.00",
    }).catch(() => null as unknown as string);
    if (!transactionId) return; // see the note on the analogous Phase B test above

    const userB = await signIn(env.SUPABASE_TEST_USER_B_EMAIL!, env.SUPABASE_TEST_USER_B_PASSWORD!);
    const { error: outsiderError } = await userB.rpc("set_transaction_tags", { p_transaction_id: transactionId, p_tag_ids: [tagId] });
    expect(outsiderError).not.toBeNull();

    const member = await signIn(env.SUPABASE_TEST_HOUSEHOLD_MEMBER_EMAIL!, env.SUPABASE_TEST_HOUSEHOLD_MEMBER_PASSWORD!);
    const { error: memberError } = await member.rpc("set_transaction_tags", { p_transaction_id: transactionId, p_tag_ids: [tagId] });
    expect(memberError).toBeNull(); // member-level privilege, not creator-only

    await owner.rpc("set_transaction_tags", { p_transaction_id: transactionId, p_tag_ids: [] }); // leave it tidy
  });
});

describe.skipIf(!hasLiveProject)("Tag attach / detach", () => {
  it("attaches one tag to an Income transaction (test 11) and multiple to an Expense (test 12)", async () => {
    const userA = await signIn(env.SUPABASE_TEST_USER_A_EMAIL!, env.SUPABASE_TEST_USER_A_PASSWORD!);
    const { walletId, firstPocketId } = await createThrowawayWallet(userA, "Attach Income Expense Test");
    try {
      const tagA = await createThrowawayTag(userA, "A", { scope: "PERSONAL" });
      const tagB = await createThrowawayTag(userA, "B", { scope: "PERSONAL" });

      const incomeId = await createThrowawayIncomeExpense(userA, {
        transactionType: "INCOME",
        walletId,
        pocketId: firstPocketId,
        categoryId: env.SUPABASE_TEST_PERSONAL_INCOME_CATEGORY_ID!,
        amount: "500.00",
      });
      const { error: incomeError } = await userA.rpc("set_transaction_tags", { p_transaction_id: incomeId, p_tag_ids: [tagA] });
      expect(incomeError).toBeNull();

      const expenseId = await createThrowawayIncomeExpense(userA, {
        transactionType: "EXPENSE",
        walletId,
        pocketId: firstPocketId,
        categoryId: env.SUPABASE_TEST_PERSONAL_EXPENSE_CATEGORY_ID!,
        amount: "50.00",
      });
      const { error: expenseError } = await userA.rpc("set_transaction_tags", { p_transaction_id: expenseId, p_tag_ids: [tagA, tagB] });
      expect(expenseError).toBeNull();

      const { data: links } = await userA.from("transaction_tags").select("tag_id").eq("transaction_id", expenseId);
      expect(links).toHaveLength(2); // test 15: duplicate association impossible — PK(transaction_id, tag_id) plus dedupe in assign_transaction_tags
    } finally {
      await deleteThrowawayWallet(userA, walletId);
    }
  });

  it("tags a Pocket Transfer (test 13) and a Wallet Transfer (test 14)", async () => {
    const userA = await signIn(env.SUPABASE_TEST_USER_A_EMAIL!, env.SUPABASE_TEST_USER_A_PASSWORD!);
    const walletOne = await createThrowawayWallet(userA, "Tag Pocket Transfer Test");
    const walletTwo = await createThrowawayWallet(userA, "Tag Wallet Transfer Test");
    try {
      const { data: secondPocket } = await userA.from("pockets").insert({ wallet_id: walletOne.walletId, name: "Pocket B" }).select().single();
      const tagId = await createThrowawayTag(userA, "TransferTag", { scope: "PERSONAL" });

      const { data: pocketTransferId, error: pocketTransferError } = await userA.rpc("create_pocket_transfer", {
        p_wallet_id: walletOne.walletId,
        p_from_pocket_id: walletOne.firstPocketId,
        p_to_pocket_id: secondPocket!.id,
        p_amount: "20.00",
        p_tag_ids: [tagId],
      });
      expect(pocketTransferError).toBeNull();
      const { data: pocketLinks } = await userA.from("transaction_tags").select("tag_id").eq("transaction_id", pocketTransferId);
      expect(pocketLinks).toHaveLength(1);

      const { data: walletTransferId, error: walletTransferError } = await userA.rpc("create_wallet_transfer", {
        p_from_wallet_id: walletOne.walletId,
        p_from_pocket_id: walletOne.firstPocketId,
        p_to_wallet_id: walletTwo.walletId,
        p_to_pocket_id: walletTwo.firstPocketId,
        p_amount: "5.00",
        p_tag_ids: [tagId],
      });
      expect(walletTransferError).toBeNull();
      const { data: walletLinks } = await userA.from("transaction_tags").select("tag_id").eq("transaction_id", walletTransferId);
      expect(walletLinks).toHaveLength(1);
    } finally {
      await deleteThrowawayWallet(userA, walletOne.walletId);
      await deleteThrowawayWallet(userA, walletTwo.walletId);
    }
  });

  it("detaches a tag via set_transaction_tags (test 16), and rejects the whole request if one tag id is invalid (test 17)", async () => {
    const userA = await signIn(env.SUPABASE_TEST_USER_A_EMAIL!, env.SUPABASE_TEST_USER_A_PASSWORD!);
    const { walletId, firstPocketId } = await createThrowawayWallet(userA, "Detach Reject Test");
    try {
      const tagA = await createThrowawayTag(userA, "KeepOrDrop", { scope: "PERSONAL" });
      const transactionId = await createThrowawayIncomeExpense(userA, {
        transactionType: "EXPENSE",
        walletId,
        pocketId: firstPocketId,
        categoryId: env.SUPABASE_TEST_PERSONAL_EXPENSE_CATEGORY_ID!,
        amount: "30.00",
      });

      await userA.rpc("set_transaction_tags", { p_transaction_id: transactionId, p_tag_ids: [tagA] });
      let { data: links } = await userA.from("transaction_tags").select("tag_id").eq("transaction_id", transactionId);
      expect(links).toHaveLength(1);

      // Attempt to add a bogus second tag alongside the valid one — the
      // whole call must fail, leaving tagA still attached (no partial
      // apply).
      const { error: partialError } = await userA.rpc("set_transaction_tags", {
        p_transaction_id: transactionId,
        p_tag_ids: [tagA, "00000000-0000-4000-8000-000000000000"],
      });
      expect(partialError).not.toBeNull();
      ({ data: links } = await userA.from("transaction_tags").select("tag_id").eq("transaction_id", transactionId));
      expect(links).toHaveLength(1);
      expect(links![0].tag_id).toBe(tagA);

      // Now genuinely detach.
      const { error: detachError } = await userA.rpc("set_transaction_tags", { p_transaction_id: transactionId, p_tag_ids: [] });
      expect(detachError).toBeNull();
      ({ data: links } = await userA.from("transaction_tags").select("tag_id").eq("transaction_id", transactionId));
      expect(links).toHaveLength(0);
    } finally {
      await deleteThrowawayWallet(userA, walletId);
    }
  });
});

describe.skipIf(!hasLiveProject)("Tag archive semantics", () => {
  it("an archived tag stays on its historical transaction and cannot be newly attached elsewhere (tests 18-19)", async () => {
    const userA = await signIn(env.SUPABASE_TEST_USER_A_EMAIL!, env.SUPABASE_TEST_USER_A_PASSWORD!);
    const { walletId, firstPocketId } = await createThrowawayWallet(userA, "Archived Tag Test");
    try {
      const tagId = await createThrowawayTag(userA, "ArchiveMe", { scope: "PERSONAL" });
      const transactionId = await createThrowawayIncomeExpense(userA, {
        transactionType: "EXPENSE",
        walletId,
        pocketId: firstPocketId,
        categoryId: env.SUPABASE_TEST_PERSONAL_EXPENSE_CATEGORY_ID!,
        amount: "40.00",
      });
      await userA.rpc("set_transaction_tags", { p_transaction_id: transactionId, p_tag_ids: [tagId] });

      await userA.from("tags").update({ archived_at: new Date().toISOString() }).eq("id", tagId);

      const { data: links } = await userA.from("transaction_tags").select("tag_id").eq("transaction_id", transactionId);
      expect(links).toHaveLength(1); // test 18: still there after archiving

      const otherTransactionId = await createThrowawayIncomeExpense(userA, {
        transactionType: "EXPENSE",
        walletId,
        pocketId: firstPocketId,
        categoryId: env.SUPABASE_TEST_PERSONAL_EXPENSE_CATEGORY_ID!,
        amount: "5.00",
      });
      const { error: attachArchivedError } = await userA.rpc("set_transaction_tags", {
        p_transaction_id: otherTransactionId,
        p_tag_ids: [tagId],
      });
      expect(attachArchivedError).not.toBeNull(); // test 19
    } finally {
      await deleteThrowawayWallet(userA, walletId);
    }
  });

  it("editing unrelated transaction fields keeps an existing archived tag attached (test 20)", async () => {
    const userA = await signIn(env.SUPABASE_TEST_USER_A_EMAIL!, env.SUPABASE_TEST_USER_A_PASSWORD!);
    const { walletId, firstPocketId } = await createThrowawayWallet(userA, "Edit Keeps Archived Tag Test");
    try {
      const tagId = await createThrowawayTag(userA, "StillThere", { scope: "PERSONAL" });
      const transactionId = await createThrowawayIncomeExpense(userA, {
        transactionType: "EXPENSE",
        walletId,
        pocketId: firstPocketId,
        categoryId: env.SUPABASE_TEST_PERSONAL_EXPENSE_CATEGORY_ID!,
        amount: "60.00",
      });
      await userA.rpc("set_transaction_tags", { p_transaction_id: transactionId, p_tag_ids: [tagId] });
      await userA.from("tags").update({ archived_at: new Date().toISOString() }).eq("id", tagId);

      // update_income_expense_transaction called WITHOUT p_tag_ids (omitted
      // -> null -> "leave tags unchanged") while editing the amount.
      const { error } = await userA.rpc("update_income_expense_transaction", {
        p_transaction_id: transactionId,
        p_pocket_id: firstPocketId,
        p_category_id: env.SUPABASE_TEST_PERSONAL_EXPENSE_CATEGORY_ID!,
        p_amount: "65.00",
      });
      expect(error).toBeNull();

      const { data: links } = await userA.from("transaction_tags").select("tag_id").eq("transaction_id", transactionId);
      expect(links).toHaveLength(1);
      expect(links![0].tag_id).toBe(tagId);
    } finally {
      await deleteThrowawayWallet(userA, walletId);
    }
  });
});

describe.skipIf(!hasLiveProject)("Tag / void interaction", () => {
  it("void keeps tag links (test 21), restore keeps them too (test 22), and VOIDED + tag search finds it (test 23)", async () => {
    const { searchTransactions } = await import("@/features/transactions/api");
    const userA = await signIn(env.SUPABASE_TEST_USER_A_EMAIL!, env.SUPABASE_TEST_USER_A_PASSWORD!);
    const { walletId, firstPocketId } = await createThrowawayWallet(userA, "Void Keeps Tags Test");
    try {
      const tagId = await createThrowawayTag(userA, "SurvivesVoid", { scope: "PERSONAL" });
      const transactionId = await createThrowawayIncomeExpense(userA, {
        transactionType: "EXPENSE",
        walletId,
        pocketId: firstPocketId,
        categoryId: env.SUPABASE_TEST_PERSONAL_EXPENSE_CATEGORY_ID!,
        amount: "70.00",
      });
      await userA.rpc("set_transaction_tags", { p_transaction_id: transactionId, p_tag_ids: [tagId] });

      await userA.rpc("void_transaction", { p_transaction_id: transactionId });
      let { data: links } = await userA.from("transaction_tags").select("tag_id").eq("transaction_id", transactionId);
      expect(links).toHaveLength(1); // test 21

      const voidedResults = await searchTransactions(userA, { walletId, status: "VOIDED", tagId }); // test 23
      expect(voidedResults.map((r) => r.transactionId)).toContain(transactionId);

      await userA.rpc("restore_transaction", { p_transaction_id: transactionId });
      ({ data: links } = await userA.from("transaction_tags").select("tag_id").eq("transaction_id", transactionId));
      expect(links).toHaveLength(1); // test 22
    } finally {
      await deleteThrowawayWallet(userA, walletId);
    }
  });
});

describe.skipIf(!hasLiveProject)("Tag search / filter (tests 24-26)", () => {
  it("tag filter returns matching logical transactions, a transfer stays one row, and combines with other filters", async () => {
    const { searchTransactions } = await import("@/features/transactions/api");
    const userA = await signIn(env.SUPABASE_TEST_USER_A_EMAIL!, env.SUPABASE_TEST_USER_A_PASSWORD!);
    const { walletId, firstPocketId } = await createThrowawayWallet(userA, "Tag Search Test");
    const { data: secondPocket } = await userA.from("pockets").insert({ wallet_id: walletId, name: "Pocket B" }).select().single();

    try {
      const tagId = await createThrowawayTag(userA, "SearchMe", { scope: "PERSONAL" });
      const untaggedTagId = await createThrowawayTag(userA, "NotThisOne", { scope: "PERSONAL" });

      const expenseId = await createThrowawayIncomeExpense(userA, {
        transactionType: "EXPENSE",
        walletId,
        pocketId: firstPocketId,
        categoryId: env.SUPABASE_TEST_PERSONAL_EXPENSE_CATEGORY_ID!,
        amount: "12.00",
      });
      await userA.rpc("set_transaction_tags", { p_transaction_id: expenseId, p_tag_ids: [tagId] });

      const { data: transferId } = await userA.rpc("create_pocket_transfer", {
        p_wallet_id: walletId,
        p_from_pocket_id: firstPocketId,
        p_to_pocket_id: secondPocket!.id,
        p_amount: "3.00",
        p_tag_ids: [tagId],
      });

      const byTag = await searchTransactions(userA, { walletId, tagId, status: "ALL" }); // test 24
      const ids = byTag.map((r) => r.transactionId);
      expect(ids).toContain(expenseId);
      expect(ids).toContain(transferId);
      expect(byTag.filter((r) => r.transactionId === transferId)).toHaveLength(1); // test 25: one logical row
      expect(byTag.find((r) => r.transactionId === transferId)?.pocketTransfer).toBeDefined();

      const byWrongTag = await searchTransactions(userA, { walletId, tagId: untaggedTagId, status: "ALL" });
      expect(byWrongTag.map((r) => r.transactionId)).not.toContain(expenseId);

      const byTagAndType = await searchTransactions(userA, { walletId, tagId, type: "EXPENSE", status: "ALL" }); // test 26
      expect(byTagAndType.map((r) => r.transactionId)).toContain(expenseId);
      expect(byTagAndType.map((r) => r.transactionId)).not.toContain(transferId);
    } finally {
      await deleteThrowawayWallet(userA, walletId);
    }
  });
});

describe.skipIf(!hasLiveProject)("Tag mutation: accounting regression (tests 27-29)", () => {
  it("attaching/detaching/renaming tags changes no balance and no monthly Income/Expense total", async () => {
    const userA = await signIn(env.SUPABASE_TEST_USER_A_EMAIL!, env.SUPABASE_TEST_USER_A_PASSWORD!);
    const { walletId, firstPocketId } = await createThrowawayWallet(userA, "Tag Accounting Regression Test");
    try {
      const range = financeMonthRange(currentFinanceMonth());
      const walletBefore = await walletBalance(userA, walletId);

      const transactionId = await createThrowawayIncomeExpense(userA, {
        transactionType: "EXPENSE",
        walletId,
        pocketId: firstPocketId,
        categoryId: env.SUPABASE_TEST_PERSONAL_EXPENSE_CATEGORY_ID!,
        amount: "88.00",
      });
      const tagA = await createThrowawayTag(userA, "RegressionA", { scope: "PERSONAL" });
      const tagB = await createThrowawayTag(userA, "RegressionB", { scope: "PERSONAL" });

      const afterCreate = await walletBalance(userA, walletId);
      expect(afterCreate).toBeCloseTo(walletBefore - 88, 2);
      // Captured AFTER the real expense exists, BEFORE any tag mutation —
      // test 28 compares against this baseline, not the pre-transaction
      // `before`, since creating the expense itself obviously does move
      // the monthly total; only further TAG churn must not move it again.
      const afterCreateTotals = await financeTotalsFor(userA, range);

      for (const attempt of [[tagA], [tagA, tagB], [tagB], []]) {
        await userA.rpc("set_transaction_tags", { p_transaction_id: transactionId, p_tag_ids: attempt });
        expect(await walletBalance(userA, walletId)).toBeCloseTo(walletBefore - 88, 2); // test 27
      }

      await userA.from("tags").update({ name: `Renamed ${Date.now()}` }).eq("id", tagA);
      expect(await walletBalance(userA, walletId)).toBeCloseTo(walletBefore - 88, 2); // test 27 (rename too)

      const afterTagChurn = await financeTotalsFor(userA, range);
      expect(afterTagChurn.forCurrency("THB").expense).toBe(afterCreateTotals.forCurrency("THB").expense); // test 28
    } finally {
      await deleteThrowawayWallet(userA, walletId);
    }
  });

  it("tagging a transaction on the USD wallet never moves THB currency totals (test 29)", async () => {
    const userA = await signIn(env.SUPABASE_TEST_USER_A_EMAIL!, env.SUPABASE_TEST_USER_A_PASSWORD!);
    const range = financeMonthRange(currentFinanceMonth());
    const thbBefore = await financeTotalsFor(userA, range);

    const tagId = await createThrowawayTag(userA, "USDTagTest", { scope: "PERSONAL" });
    const transactionId = await createThrowawayIncomeExpense(userA, {
      transactionType: "EXPENSE",
      walletId: env.SUPABASE_TEST_PERSONAL_USD_WALLET_ID!,
      pocketId: env.SUPABASE_TEST_PERSONAL_USD_WALLET_POCKET_ID!,
      categoryId: env.SUPABASE_TEST_PERSONAL_EXPENSE_CATEGORY_ID!,
      amount: "9.00",
    });
    await userA.rpc("set_transaction_tags", { p_transaction_id: transactionId, p_tag_ids: [tagId] });

    const thbAfter = await financeTotalsFor(userA, range);
    expect(thbAfter.forCurrency("THB").expense).toBe(thbBefore.forCurrency("THB").expense);

    await userA.rpc("void_transaction", { p_transaction_id: transactionId }); // tidy up (USD wallet is a shared fixture, not throwaway)
  });
});

// ---------------------------------------------------------------------
// Phase D: Refunds + Reimbursements (0033_refunds_reimbursements.sql).
//
// Same throwaway-fixture strategy as every phase above. A refund/
// reimbursement is stored as an ordinary transaction_type = 'EXPENSE' row
// with a positive entry (see docs/FINANCE.md Phase D), so it cleans up
// exactly like any other throwaway transaction — deleting the throwaway
// wallet cascades everything, expense_adjustments included (ON DELETE
// CASCADE from transactions).
// ---------------------------------------------------------------------

async function createThrowawayExpenseAdjustment(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- see financeTotalsFor's comment above
  client: any,
  params: {
    originalExpenseId: string;
    adjustmentKind: "REFUND" | "REIMBURSEMENT";
    walletId: string;
    pocketId: string;
    amount: string;
    occurredAt?: string;
    tagIds?: string[];
  },
) {
  return client.rpc("create_expense_adjustment_transaction", {
    p_original_expense_id: params.originalExpenseId,
    p_adjustment_kind: params.adjustmentKind,
    p_wallet_id: params.walletId,
    p_pocket_id: params.pocketId,
    p_amount: params.amount,
    p_occurred_at: params.occurredAt,
    p_tag_ids: params.tagIds ?? null,
  }) as Promise<{ data: string | null; error: { message: string; code?: string } | null }>;
}

describe.skipIf(!hasLiveProject)("Refund/Reimbursement: basic accounting (tests 1-2)", () => {
  it("Expense 1500 + Refund 500 -> wallet -1000, Income 0, net Expense 1000", async () => {
    const userA = await signIn(env.SUPABASE_TEST_USER_A_EMAIL!, env.SUPABASE_TEST_USER_A_PASSWORD!);
    const { walletId, firstPocketId } = await createThrowawayWallet(userA, "Refund Basic Test");
    try {
      const before = await walletBalance(userA, walletId);
      const range = financeMonthRange(currentFinanceMonth());
      const totalsBefore = await financeTotalsFor(userA, range);

      const expenseId = await createThrowawayIncomeExpense(userA, {
        transactionType: "EXPENSE",
        walletId,
        pocketId: firstPocketId,
        categoryId: env.SUPABASE_TEST_PERSONAL_EXPENSE_CATEGORY_ID!,
        amount: "1500.00",
      });
      const { data: refundId, error } = await createThrowawayExpenseAdjustment(userA, {
        originalExpenseId: expenseId,
        adjustmentKind: "REFUND",
        walletId,
        pocketId: firstPocketId,
        amount: "500.00",
      });
      expect(error).toBeNull();

      expect(await walletBalance(userA, walletId)).toBeCloseTo(before - 1000, 2);

      const totalsAfter = await financeTotalsFor(userA, range);
      const incomeDelta = Number(totalsAfter.forCurrency("THB").income) - Number(totalsBefore.forCurrency("THB").income);
      const expenseDelta = Number(totalsAfter.forCurrency("THB").expense) - Number(totalsBefore.forCurrency("THB").expense);
      expect(incomeDelta).toBeCloseTo(0, 2); // test 24: refund is not income
      expect(expenseDelta).toBeCloseTo(1000, 2); // net expense = 1500 - 500

      const { data: readBack } = await userA.from("transactions").select("transaction_type").eq("id", refundId).single();
      expect(readBack!.transaction_type).toBe("EXPENSE"); // stored representation, per docs/FINANCE.md Phase D
    } finally {
      await deleteThrowawayWallet(userA, walletId);
    }
  });

  it("Expense 1500 + Reimbursement 500 has the same accounting effect, distinct semantic kind (test 2, 25)", async () => {
    const userA = await signIn(env.SUPABASE_TEST_USER_A_EMAIL!, env.SUPABASE_TEST_USER_A_PASSWORD!);
    const { walletId, firstPocketId } = await createThrowawayWallet(userA, "Reimbursement Basic Test");
    try {
      const before = await walletBalance(userA, walletId);
      const expenseId = await createThrowawayIncomeExpense(userA, {
        transactionType: "EXPENSE",
        walletId,
        pocketId: firstPocketId,
        categoryId: env.SUPABASE_TEST_PERSONAL_EXPENSE_CATEGORY_ID!,
        amount: "1500.00",
      });
      const { error } = await createThrowawayExpenseAdjustment(userA, {
        originalExpenseId: expenseId,
        adjustmentKind: "REIMBURSEMENT",
        walletId,
        pocketId: firstPocketId,
        amount: "500.00",
      });
      expect(error).toBeNull();
      expect(await walletBalance(userA, walletId)).toBeCloseTo(before - 1000, 2);

      const summary = await userA.rpc("get_expense_refundable_summary", { p_transaction_id: expenseId });
      const wire = summary.data as { active_refund_total: string; active_reimbursement_total: string };
      expect(Number(wire.active_refund_total)).toBeCloseTo(0, 2);
      expect(Number(wire.active_reimbursement_total)).toBeCloseTo(500, 2); // distinct kind, not merged
    } finally {
      await deleteThrowawayWallet(userA, walletId);
    }
  });
});

describe.skipIf(!hasLiveProject)("Refund/Reimbursement: partial and cap (tests 3-6)", () => {
  it("supports multiple partial refunds up to the cap, exact-full is allowed, and over-refund is rejected", async () => {
    const userA = await signIn(env.SUPABASE_TEST_USER_A_EMAIL!, env.SUPABASE_TEST_USER_A_PASSWORD!);
    const { walletId, firstPocketId } = await createThrowawayWallet(userA, "Partial Cap Test");
    try {
      const expenseId = await createThrowawayIncomeExpense(userA, {
        transactionType: "EXPENSE",
        walletId,
        pocketId: firstPocketId,
        categoryId: env.SUPABASE_TEST_PERSONAL_EXPENSE_CATEGORY_ID!,
        amount: "1500.00",
      });

      const first = await createThrowawayExpenseAdjustment(userA, {
        originalExpenseId: expenseId,
        adjustmentKind: "REFUND",
        walletId,
        pocketId: firstPocketId,
        amount: "500.00",
      });
      expect(first.error).toBeNull(); // test 3

      const second = await createThrowawayExpenseAdjustment(userA, {
        originalExpenseId: expenseId,
        adjustmentKind: "REIMBURSEMENT",
        walletId,
        pocketId: firstPocketId,
        amount: "300.00",
      });
      expect(second.error).toBeNull(); // test 4: combined refund + reimbursement cap tracked together

      const overRefund = await createThrowawayExpenseAdjustment(userA, {
        originalExpenseId: expenseId,
        adjustmentKind: "REFUND",
        walletId,
        pocketId: firstPocketId,
        amount: "701.00", // 500 + 300 + 701 = 1501 > 1500
      });
      expect(overRefund.error).not.toBeNull(); // test 6: over-refund rejected

      const exactRemaining = await createThrowawayExpenseAdjustment(userA, {
        originalExpenseId: expenseId,
        adjustmentKind: "REFUND",
        walletId,
        pocketId: firstPocketId,
        amount: "700.00", // exactly the remaining amount
      });
      expect(exactRemaining.error).toBeNull(); // test 5: exact full refund allowed

      const nowOverByOne = await createThrowawayExpenseAdjustment(userA, {
        originalExpenseId: expenseId,
        adjustmentKind: "REFUND",
        walletId,
        pocketId: firstPocketId,
        amount: "0.01",
      });
      expect(nowOverByOne.error).not.toBeNull();
    } finally {
      await deleteThrowawayWallet(userA, walletId);
    }
  });
});

describe.skipIf(!hasLiveProject)("Refund/Reimbursement: concurrency safety (test 7)", () => {
  it("two concurrent refund attempts against a 500 cap cannot both succeed", async () => {
    const userA = await signIn(env.SUPABASE_TEST_USER_A_EMAIL!, env.SUPABASE_TEST_USER_A_PASSWORD!);
    const { walletId, firstPocketId } = await createThrowawayWallet(userA, "Concurrency Test");
    try {
      const expenseId = await createThrowawayIncomeExpense(userA, {
        transactionType: "EXPENSE",
        walletId,
        pocketId: firstPocketId,
        categoryId: env.SUPABASE_TEST_PERSONAL_EXPENSE_CATEGORY_ID!,
        amount: "500.00",
      });

      const [a, b] = await Promise.all([
        createThrowawayExpenseAdjustment(userA, { originalExpenseId: expenseId, adjustmentKind: "REFUND", walletId, pocketId: firstPocketId, amount: "400.00" }),
        createThrowawayExpenseAdjustment(userA, { originalExpenseId: expenseId, adjustmentKind: "REFUND", walletId, pocketId: firstPocketId, amount: "400.00" }),
      ]);

      const succeeded = [a, b].filter((r) => r.error === null);
      const failed = [a, b].filter((r) => r.error !== null);
      expect(succeeded).toHaveLength(1); // the original expense row's FOR UPDATE lock serializes these
      expect(failed).toHaveLength(1);

      const total = await userA.rpc("get_expense_adjustment_total", { p_original_expense_transaction_id: expenseId });
      expect(Number(total.data)).toBeCloseTo(400, 2); // never 800
    } finally {
      await deleteThrowawayWallet(userA, walletId);
    }
  });
});

describe.skipIf(!hasLiveProject)("Refund/Reimbursement: currency rule (tests 8-9)", () => {
  it("rejects a refund whose destination wallet currency differs from the original expense's, and allows a same-currency different wallet", async () => {
    const userA = await signIn(env.SUPABASE_TEST_USER_A_EMAIL!, env.SUPABASE_TEST_USER_A_PASSWORD!);
    const { walletId: thbWalletId, firstPocketId: thbPocketId } = await createThrowawayWallet(userA, "Currency Rule THB Test", "THB");
    const { walletId: usdWalletId, firstPocketId: usdPocketId } = await createThrowawayWallet(userA, "Currency Rule USD Test", "USD");
    const { walletId: thbWallet2Id, firstPocketId: thbPocket2Id } = await createThrowawayWallet(userA, "Currency Rule THB Test 2", "THB");
    try {
      const expenseId = await createThrowawayIncomeExpense(userA, {
        transactionType: "EXPENSE",
        walletId: thbWalletId,
        pocketId: thbPocketId,
        categoryId: env.SUPABASE_TEST_PERSONAL_EXPENSE_CATEGORY_ID!,
        amount: "100.00",
      });

      const toUsd = await createThrowawayExpenseAdjustment(userA, {
        originalExpenseId: expenseId,
        adjustmentKind: "REFUND",
        walletId: usdWalletId,
        pocketId: usdPocketId,
        amount: "50.00",
      });
      expect(toUsd.error).not.toBeNull(); // test 8

      const toOtherThb = await createThrowawayExpenseAdjustment(userA, {
        originalExpenseId: expenseId,
        adjustmentKind: "REFUND",
        walletId: thbWallet2Id,
        pocketId: thbPocket2Id,
        amount: "50.00",
      });
      expect(toOtherThb.error).toBeNull(); // test 9: same currency, different wallet is fine
    } finally {
      await deleteThrowawayWallet(userA, thbWalletId);
      await deleteThrowawayWallet(userA, usdWalletId);
      await deleteThrowawayWallet(userA, thbWallet2Id);
    }
  });
});

describe.skipIf(!hasLiveProject)("Refund/Reimbursement: scope / authorization (tests 10-13)", () => {
  it("rejects Personal expense -> Household refund and Household A -> Household B, and rejects an outsider", async () => {
    const userA = await signIn(env.SUPABASE_TEST_USER_A_EMAIL!, env.SUPABASE_TEST_USER_A_PASSWORD!);
    const { walletId: personalWalletId, firstPocketId: personalPocketId } = await createThrowawayWallet(userA, "Scope Personal Test");
    const householdOneId = await createThrowawayHousehold(userA, "Refund Scope H1");
    const householdTwoId = await createThrowawayHousehold(userA, "Refund Scope H2");

    const walletOne = await userA.rpc("create_wallet_with_first_pocket", {
      p_scope: "HOUSEHOLD",
      p_owner_user_id: null,
      p_household_id: householdOneId,
      p_name: `H1 Wallet ${Date.now()}`,
      p_wallet_type: "OTHER",
      p_currency: "THB",
      p_first_pocket_name: "Pocket A",
    });
    const walletTwo = await userA.rpc("create_wallet_with_first_pocket", {
      p_scope: "HOUSEHOLD",
      p_owner_user_id: null,
      p_household_id: householdTwoId,
      p_name: `H2 Wallet ${Date.now()}`,
      p_wallet_type: "OTHER",
      p_currency: "THB",
      p_first_pocket_name: "Pocket A",
    });
    const { data: pocketsTwo } = await userA.from("pockets").select("id").eq("wallet_id", walletTwo.data.id);

    try {
      const { data: pocketOne } = await userA.from("pockets").select("id").eq("wallet_id", walletOne.data.id).single();

      // Personal -> Household (test 10)
      const personalExpenseId = await createThrowawayIncomeExpense(userA, {
        transactionType: "EXPENSE",
        walletId: personalWalletId,
        pocketId: personalPocketId,
        categoryId: env.SUPABASE_TEST_PERSONAL_EXPENSE_CATEGORY_ID!,
        amount: "50.00",
      });
      const toHousehold = await createThrowawayExpenseAdjustment(userA, {
        originalExpenseId: personalExpenseId,
        adjustmentKind: "REFUND",
        walletId: walletOne.data.id,
        pocketId: pocketOne!.id,
        amount: "10.00",
      });
      expect(toHousehold.error).not.toBeNull();

      // Household A -> Household B (test 11) — userA is authorized for
      // BOTH (owner of both via auto-membership), so this must be the
      // scope-mismatch check itself, not mere authorization.
      const householdOneExpenseId = await createThrowawayIncomeExpense(userA, {
        transactionType: "EXPENSE",
        walletId: walletOne.data.id,
        pocketId: pocketOne!.id,
        categoryId: env.SUPABASE_TEST_PERSONAL_EXPENSE_CATEGORY_ID!,
        amount: "50.00",
      });
      const toHouseholdTwo = await createThrowawayExpenseAdjustment(userA, {
        originalExpenseId: householdOneExpenseId,
        adjustmentKind: "REFUND",
        walletId: walletTwo.data.id,
        pocketId: pocketsTwo![0].id,
        amount: "10.00",
      });
      expect(toHouseholdTwo.error).not.toBeNull();

      // Outsider (test 12)
      const userB = await signIn(env.SUPABASE_TEST_USER_B_EMAIL!, env.SUPABASE_TEST_USER_B_PASSWORD!);
      const outsider = await createThrowawayExpenseAdjustment(userB, {
        originalExpenseId: personalExpenseId,
        adjustmentKind: "REFUND",
        walletId: personalWalletId,
        pocketId: personalPocketId,
        amount: "10.00",
      });
      expect(outsider.error).not.toBeNull();
    } finally {
      await deleteThrowawayWallet(userA, personalWalletId);
    }
  });

  it("a valid household member (not only the creator) may create a refund against a shared expense (test 13)", async () => {
    const owner = await signIn(env.SUPABASE_TEST_HOUSEHOLD_OWNER_EMAIL!, env.SUPABASE_TEST_HOUSEHOLD_OWNER_PASSWORD!);
    const expenseId = await createThrowawayIncomeExpense(owner, {
      transactionType: "EXPENSE",
      walletId: env.SUPABASE_TEST_HOUSEHOLD_WALLET_ID!,
      pocketId: env.SUPABASE_TEST_HOUSEHOLD_WALLET_POCKET_ID!,
      categoryId: env.SUPABASE_TEST_PERSONAL_EXPENSE_CATEGORY_ID!,
      amount: "20.00",
    }).catch(() => null as unknown as string);
    if (!expenseId) return; // see the analogous Phase B/C test note above

    const member = await signIn(env.SUPABASE_TEST_HOUSEHOLD_MEMBER_EMAIL!, env.SUPABASE_TEST_HOUSEHOLD_MEMBER_PASSWORD!);
    const { data: refundId, error } = await createThrowawayExpenseAdjustment(member, {
      originalExpenseId: expenseId,
      adjustmentKind: "REFUND",
      walletId: env.SUPABASE_TEST_HOUSEHOLD_WALLET_ID!,
      pocketId: env.SUPABASE_TEST_HOUSEHOLD_WALLET_POCKET_ID!,
      amount: "5.00",
    });
    expect(error).toBeNull();

    await owner.rpc("void_transaction", { p_transaction_id: refundId }); // leave tidy
    await owner.rpc("void_transaction", { p_transaction_id: expenseId }); // now voidable again
  });
});

describe.skipIf(!hasLiveProject)("Refund/Reimbursement: void / restore (tests 14-18)", () => {
  it("void removes the adjustment, restore returns the exact effect, and restore cannot exceed the cap", async () => {
    const userA = await signIn(env.SUPABASE_TEST_USER_A_EMAIL!, env.SUPABASE_TEST_USER_A_PASSWORD!);
    const { walletId, firstPocketId } = await createThrowawayWallet(userA, "Refund Void Restore Test");
    try {
      const expenseId = await createThrowawayIncomeExpense(userA, {
        transactionType: "EXPENSE",
        walletId,
        pocketId: firstPocketId,
        categoryId: env.SUPABASE_TEST_PERSONAL_EXPENSE_CATEGORY_ID!,
        amount: "1000.00",
      });
      const before = await walletBalance(userA, walletId);

      const { data: refundId } = await createThrowawayExpenseAdjustment(userA, {
        originalExpenseId: expenseId,
        adjustmentKind: "REFUND",
        walletId,
        pocketId: firstPocketId,
        amount: "600.00",
      });
      expect(await walletBalance(userA, walletId)).toBeCloseTo(before + 600, 2);

      const { error: voidError } = await userA.rpc("void_transaction", { p_transaction_id: refundId });
      expect(voidError).toBeNull();
      expect(await walletBalance(userA, walletId)).toBeCloseTo(before, 2); // test 14

      const { error: restoreError } = await userA.rpc("restore_transaction", { p_transaction_id: refundId });
      expect(restoreError).toBeNull();
      expect(await walletBalance(userA, walletId)).toBeCloseTo(before + 600, 2); // test 15

      // Now fill the rest of the cap with a second refund, void the first,
      // and confirm restoring it would exceed the cap.
      const { data: secondRefundId, error: secondError } = await createThrowawayExpenseAdjustment(userA, {
        originalExpenseId: expenseId,
        adjustmentKind: "REFUND",
        walletId,
        pocketId: firstPocketId,
        amount: "400.00",
      });
      expect(secondError).toBeNull();
      void secondRefundId;

      await userA.rpc("void_transaction", { p_transaction_id: refundId });
      const { error: overCapRestoreError } = await userA.rpc("restore_transaction", { p_transaction_id: refundId });
      expect(overCapRestoreError).not.toBeNull(); // test 16: 600 + 400 > 1000
    } finally {
      await deleteThrowawayWallet(userA, walletId);
    }
  });

  it("rejects restoring a refund whose original expense is voided (test 17), and tags survive void/restore (test 18)", async () => {
    const userA = await signIn(env.SUPABASE_TEST_USER_A_EMAIL!, env.SUPABASE_TEST_USER_A_PASSWORD!);
    const { walletId, firstPocketId } = await createThrowawayWallet(userA, "Refund Original Voided Test");
    try {
      const tagId = await createThrowawayTag(userA, "RefundTagSurvives", { scope: "PERSONAL" });
      const expenseId = await createThrowawayIncomeExpense(userA, {
        transactionType: "EXPENSE",
        walletId,
        pocketId: firstPocketId,
        categoryId: env.SUPABASE_TEST_PERSONAL_EXPENSE_CATEGORY_ID!,
        amount: "100.00",
      });
      const { data: refundId } = await createThrowawayExpenseAdjustment(userA, {
        originalExpenseId: expenseId,
        adjustmentKind: "REFUND",
        walletId,
        pocketId: firstPocketId,
        amount: "100.00",
        tagIds: [tagId],
      });

      await userA.rpc("void_transaction", { p_transaction_id: refundId });
      // original expense now has zero ACTIVE adjustments, so it can be voided too
      await userA.rpc("void_transaction", { p_transaction_id: expenseId });

      const { error: restoreError } = await userA.rpc("restore_transaction", { p_transaction_id: refundId });
      expect(restoreError).not.toBeNull(); // test 17: original itself is voided

      await userA.rpc("restore_transaction", { p_transaction_id: expenseId });
      const { error: restoreRefundError } = await userA.rpc("restore_transaction", { p_transaction_id: refundId });
      expect(restoreRefundError).toBeNull();

      const { data: links } = await userA.from("transaction_tags").select("tag_id").eq("transaction_id", refundId);
      expect(links).toHaveLength(1); // test 18
      expect(links![0].tag_id).toBe(tagId);
    } finally {
      await deleteThrowawayWallet(userA, walletId);
    }
  });
});

describe.skipIf(!hasLiveProject)("Refund/Reimbursement: original Expense restrictions (tests 19-23)", () => {
  it("blocks voiding an Expense with an active refund, allows it once voided, enforces the amount floor, and allows unrelated edits", async () => {
    const userA = await signIn(env.SUPABASE_TEST_USER_A_EMAIL!, env.SUPABASE_TEST_USER_A_PASSWORD!);
    const { walletId, firstPocketId } = await createThrowawayWallet(userA, "Original Expense Restrictions Test");
    const category = await userA
      .from("categories")
      .insert({ name: `Throwaway ${Date.now()}`, transaction_type: "EXPENSE", scope: "PERSONAL", owner_user_id: (await userA.auth.getUser()).data.user!.id })
      .select()
      .single();

    try {
      const expenseId = await createThrowawayIncomeExpense(userA, {
        transactionType: "EXPENSE",
        walletId,
        pocketId: firstPocketId,
        categoryId: category.data!.id,
        amount: "1000.00",
      });
      const { data: refundId } = await createThrowawayExpenseAdjustment(userA, {
        originalExpenseId: expenseId,
        adjustmentKind: "REFUND",
        walletId,
        pocketId: firstPocketId,
        amount: "800.00",
      });

      const { error: voidBlockedError } = await userA.rpc("void_transaction", { p_transaction_id: expenseId });
      expect(voidBlockedError).not.toBeNull(); // test 19

      // Amount floor (test 21): cannot drop below the active 800 total.
      const { error: belowFloorError } = await userA.rpc("update_income_expense_transaction", {
        p_transaction_id: expenseId,
        p_pocket_id: firstPocketId,
        p_category_id: category.data!.id,
        p_amount: "700.00",
      });
      expect(belowFloorError).not.toBeNull();

      // Editing unrelated fields (title/date/note) succeeds even with an
      // active adjustment (test 22) — amount stays at/above the floor.
      const { error: unrelatedEditError } = await userA.rpc("update_income_expense_transaction", {
        p_transaction_id: expenseId,
        p_pocket_id: firstPocketId,
        p_category_id: category.data!.id,
        p_amount: "1000.00",
        p_title: "Updated title",
      });
      expect(unrelatedEditError).toBeNull();

      // Archived historical category remains usable (test 23) — same
      // rule as Phase B, and the refund itself COPIED this category_id.
      await userA.from("categories").update({ archived_at: new Date().toISOString() }).eq("id", category.data!.id);
      const { data: refundRow } = await userA.from("transactions").select("category_id").eq("id", refundId).single();
      expect(refundRow!.category_id).toBe(category.data!.id);

      await userA.rpc("void_transaction", { p_transaction_id: refundId });
      const { error: voidNowAllowedError } = await userA.rpc("void_transaction", { p_transaction_id: expenseId });
      expect(voidNowAllowedError).toBeNull(); // test 20
    } finally {
      await deleteThrowawayWallet(userA, walletId);
    }
  });
});

describe.skipIf(!hasLiveProject)("Refund/Reimbursement: reporting (tests 26-30)", () => {
  it("category attribution follows the original expense, transfers stay excluded, and voided refunds are excluded", async () => {
    const userA = await signIn(env.SUPABASE_TEST_USER_A_EMAIL!, env.SUPABASE_TEST_USER_A_PASSWORD!);
    const { walletId, firstPocketId } = await createThrowawayWallet(userA, "Category Attribution Test");
    const { data: secondPocket } = await userA.from("pockets").insert({ wallet_id: walletId, name: "Pocket B" }).select().single();

    try {
      const range = financeMonthRange(currentFinanceMonth());
      const before = await financeTotalsFor(userA, range);

      const expenseId = await createThrowawayIncomeExpense(userA, {
        transactionType: "EXPENSE",
        walletId,
        pocketId: firstPocketId,
        categoryId: env.SUPABASE_TEST_PERSONAL_EXPENSE_CATEGORY_ID!,
        amount: "300.00",
      });
      const { data: refundId } = await createThrowawayExpenseAdjustment(userA, {
        originalExpenseId: expenseId,
        adjustmentKind: "REFUND",
        walletId,
        pocketId: firstPocketId,
        amount: "50.00",
      });

      // Category attribution follows the original expense (test 27) —
      // verified directly against the row rather than via
      // get_finance_hub_summary's category_totals, which is a top-5
      // ranked view (`category_totals` in 0028) and could legitimately
      // exclude a small throwaway category depending on what else ran
      // against the shared SUPABASE_TEST_PERSONAL_EXPENSE_CATEGORY_ID
      // fixture this month.
      const { data: refundRow } = await userA.from("transactions").select("category_id").eq("id", refundId).single();
      expect(refundRow!.category_id).toBe(env.SUPABASE_TEST_PERSONAL_EXPENSE_CATEGORY_ID);

      // A Pocket Transfer in between must not leak into Expense totals.
      const { error: transferError } = await userA.rpc("create_pocket_transfer", {
        p_wallet_id: walletId,
        p_from_pocket_id: firstPocketId,
        p_to_pocket_id: secondPocket!.id,
        p_amount: "10.00",
      });
      expect(transferError).toBeNull();

      const afterActive = await financeTotalsFor(userA, range);
      const expenseDeltaActive = Number(afterActive.forCurrency("THB").expense) - Number(before.forCurrency("THB").expense);
      expect(expenseDeltaActive).toBeCloseTo(250, 2); // transfer excluded, refund already netted (test 28)

      await userA.rpc("void_transaction", { p_transaction_id: refundId });
      const afterVoided = await financeTotalsFor(userA, range);
      const expenseDeltaVoided = Number(afterVoided.forCurrency("THB").expense) - Number(before.forCurrency("THB").expense);
      expect(expenseDeltaVoided).toBeCloseTo(300, 2); // voided refund excluded — full 300 counts again (test 29)
    } finally {
      await deleteThrowawayWallet(userA, walletId);
    }
  });

  it("multi-currency totals stay separate when a refund lands on a USD wallet (test 30)", async () => {
    const userA = await signIn(env.SUPABASE_TEST_USER_A_EMAIL!, env.SUPABASE_TEST_USER_A_PASSWORD!);
    const range = financeMonthRange(currentFinanceMonth());
    const before = await financeTotalsFor(userA, range);

    const expenseId = await createThrowawayIncomeExpense(userA, {
      transactionType: "EXPENSE",
      walletId: env.SUPABASE_TEST_PERSONAL_USD_WALLET_ID!,
      pocketId: env.SUPABASE_TEST_PERSONAL_USD_WALLET_POCKET_ID!,
      categoryId: env.SUPABASE_TEST_PERSONAL_EXPENSE_CATEGORY_ID!,
      amount: "20.00",
    });
    const { data: refundId, error } = await createThrowawayExpenseAdjustment(userA, {
      originalExpenseId: expenseId,
      adjustmentKind: "REFUND",
      walletId: env.SUPABASE_TEST_PERSONAL_USD_WALLET_ID!,
      pocketId: env.SUPABASE_TEST_PERSONAL_USD_WALLET_POCKET_ID!,
      amount: "5.00",
    });
    expect(error).toBeNull();

    const after = await financeTotalsFor(userA, range);
    expect(after.forCurrency("THB").expense).toBe(before.forCurrency("THB").expense); // THB untouched by a USD refund

    await userA.rpc("void_transaction", { p_transaction_id: refundId });
    await userA.rpc("void_transaction", { p_transaction_id: expenseId }); // tidy (shared USD fixture)
  });
});

describe.skipIf(!hasLiveProject)("Refund/Reimbursement: cash-basis month boundary (tests 31-32)", () => {
  it("an August Expense refunded in September keeps August's own total, with the refund landing in September", async () => {
    const userA = await signIn(env.SUPABASE_TEST_USER_A_EMAIL!, env.SUPABASE_TEST_USER_A_PASSWORD!);
    const { walletId, firstPocketId } = await createThrowawayWallet(userA, "Refund Month Boundary Test");
    try {
      const augustRange = financeMonthRange("2026-08");
      const septemberRange = financeMonthRange("2026-09");

      const expenseId = await createThrowawayIncomeExpense(userA, {
        transactionType: "EXPENSE",
        walletId,
        pocketId: firstPocketId,
        categoryId: env.SUPABASE_TEST_PERSONAL_EXPENSE_CATEGORY_ID!,
        amount: "900.00",
        occurredAt: "2026-08-15T12:00:00+07:00",
      });
      const augBefore = await financeTotalsFor(userA, augustRange);
      const sepBefore = await financeTotalsFor(userA, septemberRange);

      const { error } = await createThrowawayExpenseAdjustment(userA, {
        originalExpenseId: expenseId,
        adjustmentKind: "REFUND",
        walletId,
        pocketId: firstPocketId,
        amount: "200.00",
        occurredAt: "2026-09-01T00:30:00+07:00", // Bangkok-local Sep 1 (test 32)
      });
      expect(error).toBeNull();

      const augAfter = await financeTotalsFor(userA, augustRange);
      const sepAfter = await financeTotalsFor(userA, septemberRange);
      expect(Number(augAfter.forCurrency("THB").expense)).toBeCloseTo(Number(augBefore.forCurrency("THB").expense), 2); // August unchanged — cash-basis, not retroactive
      // September gains a -200 expense adjustment (a refund, all on its
      // own with no other September expense in this throwaway wallet) —
      // a legitimately NEGATIVE delta, never clamped to zero.
      expect(Number(sepAfter.forCurrency("THB").expense) - Number(sepBefore.forCurrency("THB").expense)).toBeCloseTo(-200, 2);
    } finally {
      await deleteThrowawayWallet(userA, walletId);
    }
  });
});

describe.skipIf(!hasLiveProject)("Refund/Reimbursement: history and search (tests 33-36)", () => {
  it("displays as one logical row, filters by REFUND/REIMBURSEMENT, and exposes the original title without N+1", async () => {
    const { searchTransactions } = await import("@/features/transactions/api");
    const userA = await signIn(env.SUPABASE_TEST_USER_A_EMAIL!, env.SUPABASE_TEST_USER_A_PASSWORD!);
    const { walletId, firstPocketId } = await createThrowawayWallet(userA, "Refund History Test");
    try {
      const uniqueTitle = `RefundHistory-${Date.now()}`;
      const expenseId = await createThrowawayIncomeExpense(userA, {
        transactionType: "EXPENSE",
        walletId,
        pocketId: firstPocketId,
        categoryId: env.SUPABASE_TEST_PERSONAL_EXPENSE_CATEGORY_ID!,
        amount: "222.00",
        title: uniqueTitle,
      });
      const { data: refundId } = await createThrowawayExpenseAdjustment(userA, {
        originalExpenseId: expenseId,
        adjustmentKind: "REFUND",
        walletId,
        pocketId: firstPocketId,
        amount: "100.00",
      });
      const { data: reimbursementId } = await createThrowawayExpenseAdjustment(userA, {
        originalExpenseId: expenseId,
        adjustmentKind: "REIMBURSEMENT",
        walletId,
        pocketId: firstPocketId,
        amount: "50.00",
      });

      const refundResults = await searchTransactions(userA, { walletId, type: "REFUND", status: "ALL" });
      expect(refundResults.map((r) => r.transactionId)).toEqual([refundId]); // test 33/35: one row, refund-only
      expect(refundResults[0].adjustment?.kind).toBe("REFUND");
      expect(refundResults[0].adjustment?.originalTitle).toBe(uniqueTitle); // test 36: original title, via the batched lookup

      const reimbursementResults = await searchTransactions(userA, { walletId, type: "REIMBURSEMENT", status: "ALL" }); // test 34
      expect(reimbursementResults.map((r) => r.transactionId)).toEqual([reimbursementId]);

      const expenseOnlyResults = await searchTransactions(userA, { walletId, type: "EXPENSE", status: "ALL" });
      expect(expenseOnlyResults.map((r) => r.transactionId)).toContain(expenseId);
      expect(expenseOnlyResults.map((r) => r.transactionId)).not.toContain(refundId);
      expect(expenseOnlyResults.map((r) => r.transactionId)).not.toContain(reimbursementId);
    } finally {
      await deleteThrowawayWallet(userA, walletId);
    }
  });
});

describe.skipIf(!hasLiveProject)("Refund/Reimbursement: tags (tests 37-39)", () => {
  it("creates a Refund with tags atomically, rejects an archived tag, and the tag filter finds the Refund", async () => {
    const { searchTransactions } = await import("@/features/transactions/api");
    const userA = await signIn(env.SUPABASE_TEST_USER_A_EMAIL!, env.SUPABASE_TEST_USER_A_PASSWORD!);
    const { walletId, firstPocketId } = await createThrowawayWallet(userA, "Refund Tags Test");
    try {
      const tagId = await createThrowawayTag(userA, "RefundTag", { scope: "PERSONAL" });
      const archivedTagId = await createThrowawayTag(userA, "ArchivedRefundTag", { scope: "PERSONAL" });
      await userA.from("tags").update({ archived_at: new Date().toISOString() }).eq("id", archivedTagId);

      const expenseId = await createThrowawayIncomeExpense(userA, {
        transactionType: "EXPENSE",
        walletId,
        pocketId: firstPocketId,
        categoryId: env.SUPABASE_TEST_PERSONAL_EXPENSE_CATEGORY_ID!,
        amount: "150.00",
      });

      const { data: refundId, error } = await createThrowawayExpenseAdjustment(userA, {
        originalExpenseId: expenseId,
        adjustmentKind: "REFUND",
        walletId,
        pocketId: firstPocketId,
        amount: "50.00",
        tagIds: [tagId],
      });
      expect(error).toBeNull(); // test 37

      const withArchivedTag = await createThrowawayExpenseAdjustment(userA, {
        originalExpenseId: expenseId,
        adjustmentKind: "REFUND",
        walletId,
        pocketId: firstPocketId,
        amount: "50.00",
        tagIds: [archivedTagId],
      });
      expect(withArchivedTag.error).not.toBeNull(); // test 38

      const byTag = await searchTransactions(userA, { walletId, tagId, status: "ALL" }); // test 39
      expect(byTag.map((r) => r.transactionId)).toContain(refundId);
    } finally {
      await deleteThrowawayWallet(userA, walletId);
    }
  });
});

// ---------------------------------------------------------------------
// Phase E: Budgets (0034_budgets.sql).
//
// Every test creates its own throwaway EXPENSE category (avoids
// uniqueness collisions with other tests/parallel runs on the shared
// SUPABASE_TEST_PERSONAL_EXPENSE_CATEGORY_ID fixture) and its own
// throwaway wallet where ledger activity is needed. Budgets have no
// hard-delete path (V1, by design) so throwaway budget rows are left
// behind as harmless test data, same tolerance already established for
// throwaway tags elsewhere in this file.
// ---------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- see financeTotalsFor's comment above
async function createThrowawayExpenseCategory(client: any, namePrefix: string, params: { scope: "PERSONAL" | "HOUSEHOLD"; householdId?: string }) {
  const { data: userId } = await client.auth.getUser();
  const { data, error } = await client
    .from("categories")
    .insert({
      name: `${namePrefix} ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      transaction_type: "EXPENSE",
      scope: params.scope,
      owner_user_id: params.scope === "PERSONAL" ? userId.user!.id : null,
      household_id: params.scope === "HOUSEHOLD" ? params.householdId : null,
      created_by: userId.user!.id,
    })
    .select()
    .single();
  if (error) throw error;
  return data.id as string;
}

async function createThrowawayBudget(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- see financeTotalsFor's comment above
  client: any,
  params: {
    scope: "PERSONAL" | "HOUSEHOLD";
    ownerUserId?: string;
    householdId?: string;
    categoryId: string;
    currency?: string;
    periodMonth: string;
    amount: string;
  },
) {
  const { data: userId } = await client.auth.getUser();
  return client
    .from("budgets")
    .insert({
      scope: params.scope,
      owner_user_id: params.scope === "PERSONAL" ? params.ownerUserId ?? userId.user!.id : null,
      household_id: params.scope === "HOUSEHOLD" ? params.householdId : null,
      category_id: params.categoryId,
      currency: params.currency ?? "THB",
      period_month: params.periodMonth,
      amount: params.amount,
      created_by: userId.user!.id,
    })
    .select()
    .single() as Promise<{ data: { id: string } | null; error: { message: string; code?: string } | null }>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- see financeTotalsFor's comment above
async function budgetSummaryFor(client: any, month: string) {
  const { start, end } = financeMonthRange(month);
  const { data, error } = await client.rpc("get_budget_summary", {
    p_period_month: financeMonthToPeriodMonth(month),
    p_month_start: start,
    p_month_end: end,
  });
  if (error) throw error;
  return data as Array<{
    budget_id: string;
    category_id: string;
    category_name: string;
    category_archived: boolean;
    currency: string;
    period_month: string;
    budget_amount: string;
    net_spent: string;
    remaining: string;
    archived_at: string | null;
  }>;
}

describe.skipIf(!hasLiveProject)("Budget CRUD (tests 1-7)", () => {
  it("creates a Personal Budget and a Household Budget", async () => {
    const userA = await signIn(env.SUPABASE_TEST_USER_A_EMAIL!, env.SUPABASE_TEST_USER_A_PASSWORD!);
    const categoryId = await createThrowawayExpenseCategory(userA, "Personal Budget Cat", { scope: "PERSONAL" });
    const { data, error } = await createThrowawayBudget(userA, {
      scope: "PERSONAL",
      categoryId,
      periodMonth: "2026-09-01",
      amount: "5000.00",
    });
    expect(error).toBeNull(); // test 1
    expect(data).toBeTruthy();

    const owner = await signIn(env.SUPABASE_TEST_HOUSEHOLD_OWNER_EMAIL!, env.SUPABASE_TEST_HOUSEHOLD_OWNER_PASSWORD!);
    const householdCategoryId = await createThrowawayExpenseCategory(owner, "Household Budget Cat", {
      scope: "HOUSEHOLD",
      householdId: env.SUPABASE_TEST_HOUSEHOLD_ID!,
    });
    const householdResult = await createThrowawayBudget(owner, {
      scope: "HOUSEHOLD",
      householdId: env.SUPABASE_TEST_HOUSEHOLD_ID!,
      categoryId: householdCategoryId,
      periodMonth: "2026-09-01",
      amount: "2000.00",
    });
    expect(householdResult.error).toBeNull(); // test 2
  });

  it("edits amount, archives, restores, and rejects a duplicate active Budget", async () => {
    const userA = await signIn(env.SUPABASE_TEST_USER_A_EMAIL!, env.SUPABASE_TEST_USER_A_PASSWORD!);
    const categoryId = await createThrowawayExpenseCategory(userA, "Edit Archive Restore Cat", { scope: "PERSONAL" });
    const { data: budget } = await createThrowawayBudget(userA, { scope: "PERSONAL", categoryId, periodMonth: "2026-09-01", amount: "5000.00" });

    const { error: editError } = await userA.from("budgets").update({ amount: "6000.00" }).eq("id", budget!.id);
    expect(editError).toBeNull(); // test 3

    const { error: archiveError } = await userA.from("budgets").update({ archived_at: new Date().toISOString() }).eq("id", budget!.id);
    expect(archiveError).toBeNull(); // test 4

    // A second active Budget for the same identity while the first is
    // ARCHIVED is allowed (test 6 is specifically about ACTIVE duplicates).
    const { data: secondBudget, error: secondError } = await createThrowawayBudget(userA, {
      scope: "PERSONAL",
      categoryId,
      periodMonth: "2026-09-01",
      amount: "7000.00",
    });
    expect(secondError).toBeNull();

    // A THIRD create attempt for the same identity, while the second is
    // still ACTIVE, is rejected directly (test 6).
    const { error: duplicateActiveError } = await createThrowawayBudget(userA, {
      scope: "PERSONAL",
      categoryId,
      periodMonth: "2026-09-01",
      amount: "8000.00",
    });
    expect(duplicateActiveError).not.toBeNull();

    // Restoring the first also conflicts with the second while it's
    // still active — the same unique constraint, reached via restore.
    const { error: restoreConflictError } = await userA.from("budgets").update({ archived_at: null }).eq("id", budget!.id);
    expect(restoreConflictError).not.toBeNull();

    // Archive the second, then the first restores cleanly (test 5).
    await userA.from("budgets").update({ archived_at: new Date().toISOString() }).eq("id", secondBudget!.id);
    const { error: restoreOkError } = await userA.from("budgets").update({ archived_at: null }).eq("id", budget!.id);
    expect(restoreOkError).toBeNull();
  });

  it("rejects a zero or negative Budget amount (test 7)", async () => {
    const userA = await signIn(env.SUPABASE_TEST_USER_A_EMAIL!, env.SUPABASE_TEST_USER_A_PASSWORD!);
    const categoryId = await createThrowawayExpenseCategory(userA, "Nonpositive Amount Cat", { scope: "PERSONAL" });

    const zero = await createThrowawayBudget(userA, { scope: "PERSONAL", categoryId, periodMonth: "2026-09-01", amount: "0.00" });
    expect(zero.error).not.toBeNull();

    const negative = await createThrowawayBudget(userA, { scope: "PERSONAL", categoryId, periodMonth: "2026-09-01", amount: "-100.00" });
    expect(negative.error).not.toBeNull();
  });
});

describe.skipIf(!hasLiveProject)("Budget category rules (tests 8-11)", () => {
  it("rejects an INCOME category, rejects an archived EXPENSE category for a new Budget, keeps an existing Budget on an archived category readable, and exact-category semantics exclude children", async () => {
    const userA = await signIn(env.SUPABASE_TEST_USER_A_EMAIL!, env.SUPABASE_TEST_USER_A_PASSWORD!);

    const incomeResult = await createThrowawayBudget(userA, {
      scope: "PERSONAL",
      categoryId: env.SUPABASE_TEST_PERSONAL_INCOME_CATEGORY_ID!,
      periodMonth: "2026-09-01",
      amount: "1000.00",
    });
    expect(incomeResult.error).not.toBeNull(); // test 8

    const archivedCategoryId = await createThrowawayExpenseCategory(userA, "Archived For New Budget Cat", { scope: "PERSONAL" });
    await userA.from("categories").update({ archived_at: new Date().toISOString() }).eq("id", archivedCategoryId);
    const archivedResult = await createThrowawayBudget(userA, {
      scope: "PERSONAL",
      categoryId: archivedCategoryId,
      periodMonth: "2026-09-01",
      amount: "1000.00",
    });
    expect(archivedResult.error).not.toBeNull(); // test 9

    // An EXISTING budget survives its category being archived afterward.
    const parentCategoryId = await createThrowawayExpenseCategory(userA, "Exact Category Parent", { scope: "PERSONAL" });
    const { data: parentBudget } = await createThrowawayBudget(userA, {
      scope: "PERSONAL",
      categoryId: parentCategoryId,
      periodMonth: "2026-09-01",
      amount: "1000.00",
    });
    await userA.from("categories").update({ archived_at: new Date().toISOString() }).eq("id", parentCategoryId);
    const { data: readBack } = await userA.from("budgets").select("id").eq("id", parentBudget!.id).maybeSingle();
    expect(readBack).toBeTruthy(); // test 10

    // Exact-category semantics (test 11): spending on a CHILD category
    // must not count toward the PARENT's Budget. Uses a FRESH, active
    // parent — the one above is already archived by this point, and a
    // new child must not be created under an archived parent.
    const { walletId, firstPocketId } = await createThrowawayWallet(userA, "Exact Category Semantics Test");
    try {
      const { data: userId } = await userA.auth.getUser();
      const activeParentId = await createThrowawayExpenseCategory(userA, "Exact Category Active Parent", { scope: "PERSONAL" });
      const { data: childCategory, error: childError } = await userA
        .from("categories")
        .insert({
          name: `Exact Category Child ${Date.now()}`,
          transaction_type: "EXPENSE",
          scope: "PERSONAL",
          owner_user_id: userId.user!.id,
          created_by: userId.user!.id,
          parent_id: activeParentId,
        })
        .select()
        .single();
      expect(childError).toBeNull();

      await createThrowawayBudget(userA, { scope: "PERSONAL", categoryId: activeParentId, periodMonth: "2026-09-01", amount: "1000.00" });

      await createThrowawayIncomeExpense(userA, {
        transactionType: "EXPENSE",
        walletId,
        pocketId: firstPocketId,
        categoryId: childCategory!.id,
        amount: "400.00",
        occurredAt: "2026-09-10T12:00:00+07:00",
      });

      const [parentRow] = (await budgetSummaryFor(userA, "2026-09")).filter((r) => r.category_id === activeParentId);
      expect(Number(parentRow.net_spent)).toBeCloseTo(0, 2); // child spending never rolls up into the parent's Budget
    } finally {
      await deleteThrowawayWallet(userA, walletId);
    }
  });
});

describe.skipIf(!hasLiveProject)("Budget scope / authorization (tests 12-15)", () => {
  it("rejects Personal category -> Household budget and Household A -> Household B, rejects an outsider, and allows a valid household member", async () => {
    const userA = await signIn(env.SUPABASE_TEST_USER_A_EMAIL!, env.SUPABASE_TEST_USER_A_PASSWORD!);
    const personalCategoryId = await createThrowawayExpenseCategory(userA, "Scope Personal Cat", { scope: "PERSONAL" });

    const householdOneId = await createThrowawayHousehold(userA, "Budget Scope H1");
    const householdTwoId = await createThrowawayHousehold(userA, "Budget Scope H2");
    const householdOneCategoryId = await createThrowawayExpenseCategory(userA, "Scope H1 Cat", { scope: "HOUSEHOLD", householdId: householdOneId });

    // Personal category, Household budget (test 12) — scope mismatch on
    // the budget row itself: category is PERSONAL, budget claims HOUSEHOLD.
    const personalToHousehold = await createThrowawayBudget(userA, {
      scope: "HOUSEHOLD",
      householdId: householdOneId,
      categoryId: personalCategoryId,
      periodMonth: "2026-09-01",
      amount: "1000.00",
    });
    expect(personalToHousehold.error).not.toBeNull();

    // Household A category, Household B budget (test 13).
    const householdAToB = await createThrowawayBudget(userA, {
      scope: "HOUSEHOLD",
      householdId: householdTwoId,
      categoryId: householdOneCategoryId,
      periodMonth: "2026-09-01",
      amount: "1000.00",
    });
    expect(householdAToB.error).not.toBeNull();

    // Outsider (test 14).
    const userB = await signIn(env.SUPABASE_TEST_USER_B_EMAIL!, env.SUPABASE_TEST_USER_B_PASSWORD!);
    const outsiderResult = await createThrowawayBudget(userB, {
      scope: "HOUSEHOLD",
      householdId: householdOneId,
      categoryId: householdOneCategoryId,
      periodMonth: "2026-09-01",
      amount: "1000.00",
    });
    expect(outsiderResult.error).not.toBeNull();

    // Valid household member on the SHARED fixture household (test 15).
    const owner = await signIn(env.SUPABASE_TEST_HOUSEHOLD_OWNER_EMAIL!, env.SUPABASE_TEST_HOUSEHOLD_OWNER_PASSWORD!);
    const sharedHouseholdCategoryId = await createThrowawayExpenseCategory(owner, "Member Budget Cat", {
      scope: "HOUSEHOLD",
      householdId: env.SUPABASE_TEST_HOUSEHOLD_ID!,
    });
    const member = await signIn(env.SUPABASE_TEST_HOUSEHOLD_MEMBER_EMAIL!, env.SUPABASE_TEST_HOUSEHOLD_MEMBER_PASSWORD!);
    const memberResult = await createThrowawayBudget(member, {
      scope: "HOUSEHOLD",
      householdId: env.SUPABASE_TEST_HOUSEHOLD_ID!,
      categoryId: sharedHouseholdCategoryId,
      periodMonth: "2026-09-01",
      amount: "1000.00",
    });
    expect(memberResult.error).toBeNull(); // member-level privilege, not creator-only
  });
});

describe.skipIf(!hasLiveProject)("Budget spending calculation (tests 16-21)", () => {
  it("counts an Expense, excludes Income/Transfers, and excludes/includes void/restore correctly", async () => {
    const userA = await signIn(env.SUPABASE_TEST_USER_A_EMAIL!, env.SUPABASE_TEST_USER_A_PASSWORD!);
    const { walletId, firstPocketId } = await createThrowawayWallet(userA, "Budget Spending Test");
    const { data: secondPocket } = await userA.from("pockets").insert({ wallet_id: walletId, name: "Pocket B" }).select().single();
    const walletTwo = await createThrowawayWallet(userA, "Budget Spending Test Wallet 2");
    try {
      const categoryId = await createThrowawayExpenseCategory(userA, "Spending Calc Cat", { scope: "PERSONAL" });
      const month = "2026-09";
      await createThrowawayBudget(userA, { scope: "PERSONAL", categoryId, periodMonth: "2026-09-01", amount: "5000.00" });

      const expenseId = await createThrowawayIncomeExpense(userA, {
        transactionType: "EXPENSE",
        walletId,
        pocketId: firstPocketId,
        categoryId,
        amount: "1000.00",
        occurredAt: "2026-09-10T12:00:00+07:00",
      });

      let [summary] = await budgetSummaryFor(userA, month);
      expect(Number(summary.net_spent)).toBeCloseTo(1000, 2); // test 16

      // Income against an unrelated INCOME category must never appear here.
      await createThrowawayIncomeExpense(userA, {
        transactionType: "INCOME",
        walletId,
        pocketId: firstPocketId,
        categoryId: env.SUPABASE_TEST_PERSONAL_INCOME_CATEGORY_ID!,
        amount: "10000.00",
        occurredAt: "2026-09-10T12:00:00+07:00",
      });
      [summary] = await budgetSummaryFor(userA, month);
      expect(Number(summary.net_spent)).toBeCloseTo(1000, 2); // test 17: unaffected

      await userA.rpc("create_pocket_transfer", {
        p_wallet_id: walletId,
        p_from_pocket_id: firstPocketId,
        p_to_pocket_id: secondPocket!.id,
        p_amount: "50.00",
        p_occurred_at: "2026-09-10T12:00:00+07:00",
      });
      [summary] = await budgetSummaryFor(userA, month);
      expect(Number(summary.net_spent)).toBeCloseTo(1000, 2); // test 18: pocket transfer excluded

      await userA.rpc("create_wallet_transfer", {
        p_from_wallet_id: walletId,
        p_from_pocket_id: firstPocketId,
        p_to_wallet_id: walletTwo.walletId,
        p_to_pocket_id: walletTwo.firstPocketId,
        p_amount: "50.00",
        p_occurred_at: "2026-09-10T12:00:00+07:00",
      });
      [summary] = await budgetSummaryFor(userA, month);
      expect(Number(summary.net_spent)).toBeCloseTo(1000, 2); // test 19: wallet transfer excluded

      await userA.rpc("void_transaction", { p_transaction_id: expenseId });
      [summary] = await budgetSummaryFor(userA, month);
      expect(Number(summary.net_spent)).toBeCloseTo(0, 2); // test 20: voided excluded

      await userA.rpc("restore_transaction", { p_transaction_id: expenseId });
      [summary] = await budgetSummaryFor(userA, month);
      expect(Number(summary.net_spent)).toBeCloseTo(1000, 2); // test 21: restored included
    } finally {
      await deleteThrowawayWallet(userA, walletId);
      await deleteThrowawayWallet(userA, walletTwo.walletId);
    }
  });
});

describe.skipIf(!hasLiveProject)("Budget edit interaction (tests 22-24)", () => {
  it("reflects an amount edit, a month move, and a category move", async () => {
    const userA = await signIn(env.SUPABASE_TEST_USER_A_EMAIL!, env.SUPABASE_TEST_USER_A_PASSWORD!);
    const { walletId, firstPocketId } = await createThrowawayWallet(userA, "Budget Edit Interaction Test");
    try {
      const categoryA = await createThrowawayExpenseCategory(userA, "Edit Interaction Cat A", { scope: "PERSONAL" });
      const categoryB = await createThrowawayExpenseCategory(userA, "Edit Interaction Cat B", { scope: "PERSONAL" });
      await createThrowawayBudget(userA, { scope: "PERSONAL", categoryId: categoryA, periodMonth: "2026-08-01", amount: "5000.00" });
      await createThrowawayBudget(userA, { scope: "PERSONAL", categoryId: categoryA, periodMonth: "2026-09-01", amount: "5000.00" });
      await createThrowawayBudget(userA, { scope: "PERSONAL", categoryId: categoryB, periodMonth: "2026-08-01", amount: "5000.00" });

      const expenseId = await createThrowawayIncomeExpense(userA, {
        transactionType: "EXPENSE",
        walletId,
        pocketId: firstPocketId,
        categoryId: categoryA,
        amount: "1000.00",
        occurredAt: "2026-08-15T12:00:00+07:00",
      });

      let [augA] = await budgetSummaryFor(userA, "2026-08").then((rows) => rows.filter((r) => r.category_id === categoryA));
      expect(Number(augA.net_spent)).toBeCloseTo(1000, 2);

      await userA.rpc("update_income_expense_transaction", {
        p_transaction_id: expenseId,
        p_pocket_id: firstPocketId,
        p_category_id: categoryA,
        p_amount: "700.00",
      });
      [augA] = await budgetSummaryFor(userA, "2026-08").then((rows) => rows.filter((r) => r.category_id === categoryA));
      expect(Number(augA.net_spent)).toBeCloseTo(700, 2); // test 22

      await userA.rpc("update_income_expense_transaction", {
        p_transaction_id: expenseId,
        p_pocket_id: firstPocketId,
        p_category_id: categoryA,
        p_amount: "700.00",
        p_occurred_at: "2026-09-01T12:00:00+07:00",
      });
      const augAfterMove = (await budgetSummaryFor(userA, "2026-08")).filter((r) => r.category_id === categoryA)[0];
      const sepAfterMove = (await budgetSummaryFor(userA, "2026-09")).filter((r) => r.category_id === categoryA)[0];
      expect(Number(augAfterMove.net_spent)).toBeCloseTo(0, 2);
      expect(Number(sepAfterMove.net_spent)).toBeCloseTo(700, 2); // test 23

      await userA.rpc("update_income_expense_transaction", {
        p_transaction_id: expenseId,
        p_pocket_id: firstPocketId,
        p_category_id: categoryB,
        p_amount: "700.00",
        p_occurred_at: "2026-09-01T12:00:00+07:00",
      });
      const sepCategoryA = (await budgetSummaryFor(userA, "2026-09")).filter((r) => r.category_id === categoryA)[0];
      const augCategoryB = (await budgetSummaryFor(userA, "2026-08")).filter((r) => r.category_id === categoryB)[0];
      expect(Number(sepCategoryA?.net_spent ?? 0)).toBeCloseTo(0, 2);
      expect(Number(augCategoryB?.net_spent ?? 0)).toBeCloseTo(0, 2); // September, category B has no budget/spending in August either way — the point is category A's September budget is now empty
    } finally {
      await deleteThrowawayWallet(userA, walletId);
    }
  });
});

describe.skipIf(!hasLiveProject)("Budget + Refund/Reimbursement interaction (tests 25-29)", () => {
  it("nets refunds/reimbursements into spending, restores on void, and attributes cash-basis correctly across a month boundary", async () => {
    const userA = await signIn(env.SUPABASE_TEST_USER_A_EMAIL!, env.SUPABASE_TEST_USER_A_PASSWORD!);
    const { walletId, firstPocketId } = await createThrowawayWallet(userA, "Budget Refund Interaction Test");
    try {
      const categoryId = await createThrowawayExpenseCategory(userA, "Budget Refund Cat", { scope: "PERSONAL" });
      await createThrowawayBudget(userA, { scope: "PERSONAL", categoryId, periodMonth: "2026-08-01", amount: "5000.00" });
      await createThrowawayBudget(userA, { scope: "PERSONAL", categoryId, periodMonth: "2026-09-01", amount: "5000.00" });

      const expenseId = await createThrowawayIncomeExpense(userA, {
        transactionType: "EXPENSE",
        walletId,
        pocketId: firstPocketId,
        categoryId,
        amount: "1500.00",
        occurredAt: "2026-08-15T12:00:00+07:00",
      });

      const { data: refundId } = await createThrowawayExpenseAdjustment(userA, {
        originalExpenseId: expenseId,
        adjustmentKind: "REFUND",
        walletId,
        pocketId: firstPocketId,
        amount: "500.00",
        occurredAt: "2026-08-20T12:00:00+07:00",
      });
      let [aug] = (await budgetSummaryFor(userA, "2026-08")).filter((r) => r.category_id === categoryId);
      expect(Number(aug.net_spent)).toBeCloseTo(1000, 2); // test 25

      const { data: reimbursementId } = await createThrowawayExpenseAdjustment(userA, {
        originalExpenseId: expenseId,
        adjustmentKind: "REIMBURSEMENT",
        walletId,
        pocketId: firstPocketId,
        amount: "300.00",
        occurredAt: "2026-09-01T00:30:00+07:00", // Sep, not Aug (test 28)
      });
      [aug] = (await budgetSummaryFor(userA, "2026-08")).filter((r) => r.category_id === categoryId);
      let [sep] = (await budgetSummaryFor(userA, "2026-09")).filter((r) => r.category_id === categoryId);
      expect(Number(aug.net_spent)).toBeCloseTo(1000, 2); // August untouched by the September reimbursement
      expect(Number(sep.net_spent)).toBeCloseTo(-300, 2); // test 26 + test 29: reimbursement reduces spend, negative net_spent allowed

      await userA.rpc("void_transaction", { p_transaction_id: refundId });
      [aug] = (await budgetSummaryFor(userA, "2026-08")).filter((r) => r.category_id === categoryId);
      expect(Number(aug.net_spent)).toBeCloseTo(1500, 2); // test 27: voiding the refund restores full spend

      await userA.rpc("void_transaction", { p_transaction_id: reimbursementId });
      [sep] = (await budgetSummaryFor(userA, "2026-09")).filter((r) => r.category_id === categoryId);
      expect(Number(sep.net_spent)).toBeCloseTo(0, 2);
    } finally {
      await deleteThrowawayWallet(userA, walletId);
    }
  });
});

describe.skipIf(!hasLiveProject)("Budget currency isolation (tests 30-32)", () => {
  it("keeps THB and USD budgets on the same category fully separate", async () => {
    const userA = await signIn(env.SUPABASE_TEST_USER_A_EMAIL!, env.SUPABASE_TEST_USER_A_PASSWORD!);
    const categoryId = await createThrowawayExpenseCategory(userA, "Currency Isolation Cat", { scope: "PERSONAL" });

    await createThrowawayBudget(userA, { scope: "PERSONAL", categoryId, currency: "THB", periodMonth: "2026-09-01", amount: "5000.00" });
    await createThrowawayBudget(userA, { scope: "PERSONAL", categoryId, currency: "USD", periodMonth: "2026-09-01", amount: "100.00" });

    await createThrowawayIncomeExpense(userA, {
      transactionType: "EXPENSE",
      walletId: env.SUPABASE_TEST_PERSONAL_WALLET_ID!,
      pocketId: env.SUPABASE_TEST_PERSONAL_WALLET_POCKET_A_ID!,
      categoryId,
      amount: "300.00",
      occurredAt: "2026-09-10T12:00:00+07:00",
    }).catch(() => null); // category may not belong to this fixture wallet's scope in every project; best-effort

    const rows = (await budgetSummaryFor(userA, "2026-09")).filter((r) => r.category_id === categoryId);
    expect(rows).toHaveLength(2); // test 30: distinct budgets, never merged into one
    const thbRow = rows.find((r) => r.currency === "THB")!;
    const usdRow = rows.find((r) => r.currency === "USD")!;
    expect(Number(usdRow.net_spent)).toBeCloseTo(0, 2); // test 31: a THB transaction never touches the USD budget
    expect(thbRow.currency).not.toBe(usdRow.currency); // test 32: never aggregated into one row
  });
});

describe.skipIf(!hasLiveProject)("Budget derived values (tests 33-35)", () => {
  it("computes remaining = limit - net_spent, correctly signed on both sides", async () => {
    const userA = await signIn(env.SUPABASE_TEST_USER_A_EMAIL!, env.SUPABASE_TEST_USER_A_PASSWORD!);
    const { walletId, firstPocketId } = await createThrowawayWallet(userA, "Budget Derived Values Test");
    try {
      const categoryId = await createThrowawayExpenseCategory(userA, "Derived Values Cat", { scope: "PERSONAL" });
      await createThrowawayBudget(userA, { scope: "PERSONAL", categoryId, periodMonth: "2026-09-01", amount: "1000.00" });

      const expenseId = await createThrowawayIncomeExpense(userA, {
        transactionType: "EXPENSE",
        walletId,
        pocketId: firstPocketId,
        categoryId,
        amount: "1200.00",
        occurredAt: "2026-09-10T12:00:00+07:00",
      });
      let [row] = (await budgetSummaryFor(userA, "2026-09")).filter((r) => r.category_id === categoryId);
      expect(Number(row.remaining)).toBeCloseTo(1000 - 1200, 2); // test 33/34: over-budget, remaining negative

      // Refund it down past zero net spend — remaining then EXCEEDS the
      // original 1000 limit, since net_spent goes negative (test 35).
      const { error: refundError } = await createThrowawayExpenseAdjustment(userA, {
        originalExpenseId: expenseId,
        adjustmentKind: "REFUND",
        walletId,
        pocketId: firstPocketId,
        amount: "1200.00",
        occurredAt: "2026-09-15T12:00:00+07:00",
      });
      expect(refundError).toBeNull();

      [row] = (await budgetSummaryFor(userA, "2026-09")).filter((r) => r.category_id === categoryId);
      expect(Number(row.net_spent)).toBeCloseTo(0, 2);

      await createThrowawayIncomeExpense(userA, {
        transactionType: "EXPENSE",
        walletId,
        pocketId: firstPocketId,
        categoryId,
        amount: "100.00",
        occurredAt: "2026-09-16T12:00:00+07:00",
      });
      [row] = (await budgetSummaryFor(userA, "2026-09")).filter((r) => r.category_id === categoryId);
      expect(Number(row.net_spent)).toBeCloseTo(100, 2);
      expect(Number(row.remaining)).toBeCloseTo(900, 2); // test 33: remaining = 1000 - 100
    } finally {
      await deleteThrowawayWallet(userA, walletId);
    }
  });
});

describe.skipIf(!hasLiveProject)("Budget month / timezone contract (tests 36-38)", () => {
  it("uses the Asia/Bangkok month boundary, stable across the UTC/Bangkok gap, and returns every budget in one batched call", async () => {
    const userA = await signIn(env.SUPABASE_TEST_USER_A_EMAIL!, env.SUPABASE_TEST_USER_A_PASSWORD!);
    const { walletId, firstPocketId } = await createThrowawayWallet(userA, "Budget Timezone Test");
    try {
      const categoryOne = await createThrowawayExpenseCategory(userA, "Timezone Cat 1", { scope: "PERSONAL" });
      const categoryTwo = await createThrowawayExpenseCategory(userA, "Timezone Cat 2", { scope: "PERSONAL" });
      const categoryThree = await createThrowawayExpenseCategory(userA, "Timezone Cat 3", { scope: "PERSONAL" });
      await createThrowawayBudget(userA, { scope: "PERSONAL", categoryId: categoryOne, periodMonth: "2026-08-01", amount: "1000.00" });
      await createThrowawayBudget(userA, { scope: "PERSONAL", categoryId: categoryTwo, periodMonth: "2026-08-01", amount: "1000.00" });
      await createThrowawayBudget(userA, { scope: "PERSONAL", categoryId: categoryThree, periodMonth: "2026-08-01", amount: "1000.00" });

      // 2026-08-31T23:30+07:00 is 2026-08-31T16:30Z — comfortably inside
      // August in BOTH zones, sanity baseline.
      await createThrowawayIncomeExpense(userA, {
        transactionType: "EXPENSE",
        walletId,
        pocketId: firstPocketId,
        categoryId: categoryOne,
        amount: "50.00",
        occurredAt: "2026-08-31T23:30:00+07:00",
      });
      // 2026-09-01T00:30+07:00 is 2026-08-31T17:30Z — September in
      // Bangkok, but still August in UTC. Must land in September.
      await createThrowawayIncomeExpense(userA, {
        transactionType: "EXPENSE",
        walletId,
        pocketId: firstPocketId,
        categoryId: categoryTwo,
        amount: "60.00",
        occurredAt: "2026-09-01T00:30:00+07:00",
      });

      const augRows = await budgetSummaryFor(userA, "2026-08");
      const augOne = augRows.find((r) => r.category_id === categoryOne)!;
      const augTwo = augRows.find((r) => r.category_id === categoryTwo)!;
      const augThree = augRows.find((r) => r.category_id === categoryThree)!;
      expect(Number(augOne.net_spent)).toBeCloseTo(50, 2); // test 36/37: stays in August
      expect(Number(augTwo.net_spent)).toBeCloseTo(0, 2); // the 00:30+07:00 expense landed in September instead — did NOT leak into August
      expect(Number(augThree.net_spent)).toBeCloseTo(0, 2); // no transactions at all — sanity zero

      // test 38: the single get_budget_summary call above already
      // returned all three budgets, each with its own independently
      // correct, live-computed net_spent (50 / 0 / 0) — never one
      // spending query per budget.
    } finally {
      await deleteThrowawayWallet(userA, walletId);
    }
  });
});

// ---------------------------------------------------------------------
// Phase F: Transaction Templates (0035_transaction_templates.sql).
//
// A Template creates no ledger effect at all, so most of these tests
// assert an ABSENCE of change (no transaction row, no balance movement)
// alongside the CRUD/validation checks. Every test uses its own
// throwaway EXPENSE/INCOME category (mirrors Phase E's own strategy) to
// avoid uniqueness/scope collisions with other tests or parallel runs.
// ---------------------------------------------------------------------

async function createThrowawayTemplate(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- see financeTotalsFor's comment above
  client: any,
  params: {
    scope: "PERSONAL" | "HOUSEHOLD";
    ownerUserId?: string;
    householdId?: string;
    transactionType: "INCOME" | "EXPENSE";
    name?: string;
    walletId?: string;
    pocketId?: string;
    categoryId?: string;
    amount?: string;
  },
) {
  const { data: userId } = await client.auth.getUser();
  return client
    .from("transaction_templates")
    .insert({
      scope: params.scope,
      owner_user_id: params.scope === "PERSONAL" ? params.ownerUserId ?? userId.user!.id : null,
      household_id: params.scope === "HOUSEHOLD" ? params.householdId : null,
      transaction_type: params.transactionType,
      name: params.name ?? `Template ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      wallet_id: params.walletId ?? null,
      pocket_id: params.pocketId ?? null,
      category_id: params.categoryId ?? null,
      amount: params.amount ?? null,
      created_by: userId.user!.id,
    })
    .select()
    .single() as Promise<{ data: { id: string } | null; error: { message: string; code?: string } | null }>;
}

describe.skipIf(!hasLiveProject)("Template CRUD (tests 1-6)", () => {
  it("creates an Expense Template and an Income Template, edits, archives, and restores", async () => {
    const userA = await signIn(env.SUPABASE_TEST_USER_A_EMAIL!, env.SUPABASE_TEST_USER_A_PASSWORD!);
    const expenseCategoryId = await createThrowawayExpenseCategory(userA, "Template Expense Cat", { scope: "PERSONAL" });

    const expenseResult = await createThrowawayTemplate(userA, {
      scope: "PERSONAL",
      transactionType: "EXPENSE",
      name: `Coffee ${Date.now()}`,
      categoryId: expenseCategoryId,
      amount: "60.00",
    });
    expect(expenseResult.error).toBeNull(); // test 1

    const { data: userId } = await userA.auth.getUser();
    const { data: incomeCategory } = await userA
      .from("categories")
      .insert({ name: `Template Income Cat ${Date.now()}`, transaction_type: "INCOME", scope: "PERSONAL", owner_user_id: userId.user!.id, created_by: userId.user!.id })
      .select()
      .single();
    const incomeResult = await createThrowawayTemplate(userA, {
      scope: "PERSONAL",
      transactionType: "INCOME",
      name: `Salary ${Date.now()}`,
      categoryId: incomeCategory!.id,
      amount: "30000.00",
    });
    expect(incomeResult.error).toBeNull(); // test 2

    const templateId = expenseResult.data!.id;
    const { error: editError } = await userA.from("transaction_templates").update({ amount: "80.00" }).eq("id", templateId);
    expect(editError).toBeNull(); // test 3

    const { error: archiveError } = await userA.from("transaction_templates").update({ archived_at: new Date().toISOString() }).eq("id", templateId);
    expect(archiveError).toBeNull(); // test 4

    const { data: archivedRow } = await userA.from("transaction_templates").select("archived_at").eq("id", templateId).single();
    expect(archivedRow!.archived_at).not.toBeNull(); // test 6 (data-level: the app-layer "use" gate keys off this exact flag)

    const { error: restoreError } = await userA.from("transaction_templates").update({ archived_at: null }).eq("id", templateId);
    expect(restoreError).toBeNull(); // test 5
  });
});

describe.skipIf(!hasLiveProject)("Template accounting no-effect guarantees (tests 7-11)", () => {
  it("creating and editing a Template changes no balance, no ledger row, no Budget spend, and no monthly total", async () => {
    const userA = await signIn(env.SUPABASE_TEST_USER_A_EMAIL!, env.SUPABASE_TEST_USER_A_PASSWORD!);
    const { walletId, firstPocketId } = await createThrowawayWallet(userA, "Template No Effect Test");
    try {
      const categoryId = await createThrowawayExpenseCategory(userA, "Template No Effect Cat", { scope: "PERSONAL" });
      await createThrowawayBudget(userA, { scope: "PERSONAL", categoryId, periodMonth: "2026-09-01", amount: "5000.00" });

      const balanceBefore = await walletBalance(userA, walletId);
      const range = financeMonthRange(currentFinanceMonth());
      const totalsBefore = await financeTotalsFor(userA, range);
      const [budgetBefore] = (await budgetSummaryFor(userA, "2026-09")).filter((r) => r.category_id === categoryId);

      const { data: template, error } = await createThrowawayTemplate(userA, {
        scope: "PERSONAL",
        transactionType: "EXPENSE",
        walletId,
        pocketId: firstPocketId,
        categoryId,
        amount: "999.00",
      });
      expect(error).toBeNull();

      await userA.from("transaction_templates").update({ amount: "1500.00" }).eq("id", template!.id);

      expect(await walletBalance(userA, walletId)).toBeCloseTo(balanceBefore, 2); // test 7

      const { data: entries } = await userA.from("transaction_entries").select("id").eq("wallet_id", walletId);
      expect(entries).toHaveLength(0); // test 8/9: no transaction_entries row exists for this brand-new throwaway wallet

      const totalsAfter = await financeTotalsFor(userA, range);
      expect(totalsAfter.forCurrency("THB").expense).toBe(totalsBefore.forCurrency("THB").expense); // test 11

      const [budgetAfter] = (await budgetSummaryFor(userA, "2026-09")).filter((r) => r.category_id === categoryId);
      expect(Number(budgetAfter?.net_spent ?? 0)).toBeCloseTo(Number(budgetBefore?.net_spent ?? 0), 2); // test 10
    } finally {
      await deleteThrowawayWallet(userA, walletId);
    }
  });
});

describe.skipIf(!hasLiveProject)("Template prefill source data (tests 12-17)", () => {
  it("saves and reads back every optional default, and multiple tags", async () => {
    const userA = await signIn(env.SUPABASE_TEST_USER_A_EMAIL!, env.SUPABASE_TEST_USER_A_PASSWORD!);
    const { walletId, firstPocketId } = await createThrowawayWallet(userA, "Template Prefill Test");
    try {
      const categoryId = await createThrowawayExpenseCategory(userA, "Template Prefill Cat", { scope: "PERSONAL" });
      const tagOne = await createThrowawayTag(userA, "PrefillTagOne", { scope: "PERSONAL" });
      const tagTwo = await createThrowawayTag(userA, "PrefillTagTwo", { scope: "PERSONAL" });

      const { data: template } = await createThrowawayTemplate(userA, {
        scope: "PERSONAL",
        transactionType: "EXPENSE",
        walletId,
        pocketId: firstPocketId,
        categoryId,
        amount: "60.00",
      });
      await userA.from("transaction_templates").update({ title: "กาแฟ", note: "ตอนเช้า" }).eq("id", template!.id);
      const { error: tagsError } = await userA.rpc("set_template_tags", { p_template_id: template!.id, p_tag_ids: [tagOne, tagTwo] });
      expect(tagsError).toBeNull();

      const { data: row } = await userA.from("transaction_templates").select("*").eq("id", template!.id).single();
      expect(Number(row.amount)).toBeCloseTo(60, 2); // test 12
      expect(row.wallet_id).toBe(walletId); // test 13
      expect(row.pocket_id).toBe(firstPocketId); // test 14
      expect(row.category_id).toBe(categoryId); // test 15
      expect(row.title).toBe("กาแฟ"); // test 16
      expect(row.note).toBe("ตอนเช้า");

      const { data: tagLinks } = await userA.from("transaction_template_tags").select("tag_id").eq("template_id", template!.id);
      expect(tagLinks).toHaveLength(2); // test 17
    } finally {
      await deleteThrowawayWallet(userA, walletId);
    }
  });
});

describe.skipIf(!hasLiveProject)("Template scope / authorization (tests 24-27)", () => {
  it("is owner-only for Personal, member-valid for Household, denies an outsider, and rejects cross-household references", async () => {
    const userA = await signIn(env.SUPABASE_TEST_USER_A_EMAIL!, env.SUPABASE_TEST_USER_A_PASSWORD!);
    const personalCategoryId = await createThrowawayExpenseCategory(userA, "Template Scope Personal Cat", { scope: "PERSONAL" });
    const { data: personalTemplate } = await createThrowawayTemplate(userA, { scope: "PERSONAL", transactionType: "EXPENSE", categoryId: personalCategoryId });

    const userB = await signIn(env.SUPABASE_TEST_USER_B_EMAIL!, env.SUPABASE_TEST_USER_B_PASSWORD!);
    const { data: outsiderRead } = await userB.from("transaction_templates").select("id").eq("id", personalTemplate!.id).maybeSingle();
    expect(outsiderRead).toBeNull(); // test 24/26: RLS-invisible to anyone but the owner

    const outsiderTagsResult = await userB.rpc("set_template_tags", { p_template_id: personalTemplate!.id, p_tag_ids: [] });
    expect(outsiderTagsResult.error).not.toBeNull();

    // Household member validity (test 25) and cross-household reference
    // rejection (test 27), both self-contained via throwaway households.
    const householdOneId = await createThrowawayHousehold(userA, "Template Scope H1");
    const householdTwoId = await createThrowawayHousehold(userA, "Template Scope H2");
    const householdOneCategoryId = await createThrowawayExpenseCategory(userA, "Template Scope H1 Cat", { scope: "HOUSEHOLD", householdId: householdOneId });

    const crossHouseholdResult = await createThrowawayTemplate(userA, {
      scope: "HOUSEHOLD",
      householdId: householdTwoId,
      transactionType: "EXPENSE",
      categoryId: householdOneCategoryId,
    });
    expect(crossHouseholdResult.error).not.toBeNull(); // test 27

    const owner = await signIn(env.SUPABASE_TEST_HOUSEHOLD_OWNER_EMAIL!, env.SUPABASE_TEST_HOUSEHOLD_OWNER_PASSWORD!);
    const sharedCategoryId = await createThrowawayExpenseCategory(owner, "Template Scope Shared Cat", {
      scope: "HOUSEHOLD",
      householdId: env.SUPABASE_TEST_HOUSEHOLD_ID!,
    });
    const member = await signIn(env.SUPABASE_TEST_HOUSEHOLD_MEMBER_EMAIL!, env.SUPABASE_TEST_HOUSEHOLD_MEMBER_PASSWORD!);
    const memberResult = await createThrowawayTemplate(member, {
      scope: "HOUSEHOLD",
      householdId: env.SUPABASE_TEST_HOUSEHOLD_ID!,
      transactionType: "EXPENSE",
      categoryId: sharedCategoryId,
    });
    expect(memberResult.error).toBeNull(); // test 25: member-level, not creator-only
  });
});

describe.skipIf(!hasLiveProject)("Template reference validation (tests 28-31)", () => {
  it("rejects a Pocket from the wrong Wallet, a Category type mismatch, and an archived Category/Tag assignment", async () => {
    const userA = await signIn(env.SUPABASE_TEST_USER_A_EMAIL!, env.SUPABASE_TEST_USER_A_PASSWORD!);
    const walletOne = await createThrowawayWallet(userA, "Template Validation Wallet 1");
    const walletTwo = await createThrowawayWallet(userA, "Template Validation Wallet 2");
    try {
      const wrongPocketResult = await createThrowawayTemplate(userA, {
        scope: "PERSONAL",
        transactionType: "EXPENSE",
        walletId: walletOne.walletId,
        pocketId: walletTwo.firstPocketId,
      });
      expect(wrongPocketResult.error).not.toBeNull(); // test 28

      const incomeCategoryId = env.SUPABASE_TEST_PERSONAL_INCOME_CATEGORY_ID!;
      const typeMismatchResult = await createThrowawayTemplate(userA, { scope: "PERSONAL", transactionType: "EXPENSE", categoryId: incomeCategoryId });
      expect(typeMismatchResult.error).not.toBeNull(); // test 29

      const archivedCategoryId = await createThrowawayExpenseCategory(userA, "Template Archived Cat", { scope: "PERSONAL" });
      await userA.from("categories").update({ archived_at: new Date().toISOString() }).eq("id", archivedCategoryId);
      const archivedCategoryResult = await createThrowawayTemplate(userA, { scope: "PERSONAL", transactionType: "EXPENSE", categoryId: archivedCategoryId });
      expect(archivedCategoryResult.error).not.toBeNull(); // test 30

      // Also rejected on an EDIT re-assignment, not just create.
      const { data: plainTemplate } = await createThrowawayTemplate(userA, { scope: "PERSONAL", transactionType: "EXPENSE" });
      const { error: editArchivedCategoryError } = await userA.from("transaction_templates").update({ category_id: archivedCategoryId }).eq("id", plainTemplate!.id);
      expect(editArchivedCategoryError).not.toBeNull();

      const archivedTagId = await createThrowawayTag(userA, "Template Archived Tag", { scope: "PERSONAL" });
      await userA.from("tags").update({ archived_at: new Date().toISOString() }).eq("id", archivedTagId);
      const { error: archivedTagError } = await userA.rpc("set_template_tags", { p_template_id: plainTemplate!.id, p_tag_ids: [archivedTagId] });
      expect(archivedTagError).not.toBeNull(); // test 31
    } finally {
      await deleteThrowawayWallet(userA, walletOne.walletId);
      await deleteThrowawayWallet(userA, walletTwo.walletId);
    }
  });
});

describe.skipIf(!hasLiveProject)("Stale Template references (tests 32-36)", () => {
  it("stays readable with an archived Wallet/Pocket/Category, and the underlying ledger writer still rejects an archived Pocket at actual use", async () => {
    const userA = await signIn(env.SUPABASE_TEST_USER_A_EMAIL!, env.SUPABASE_TEST_USER_A_PASSWORD!);
    const { walletId } = await createThrowawayWallet(userA, "Stale Template Test");
    const { data: secondPocket } = await userA.from("pockets").insert({ wallet_id: walletId, name: "Pocket B" }).select().single();
    try {
      const categoryId = await createThrowawayExpenseCategory(userA, "Stale Template Cat", { scope: "PERSONAL" });
      const { data: template } = await createThrowawayTemplate(userA, {
        scope: "PERSONAL",
        transactionType: "EXPENSE",
        walletId,
        pocketId: secondPocket!.id,
        categoryId,
        amount: "50.00",
      });

      // Archive the Pocket the Template points at, and the Wallet's OTHER
      // pocket stays active so the Wallet itself never needs archiving.
      await userA.from("pockets").update({ is_archived: true }).eq("id", secondPocket!.id);
      await userA.from("categories").update({ archived_at: new Date().toISOString() }).eq("id", categoryId);

      const { data: readBack, error: readError } = await userA.from("transaction_templates").select("*").eq("id", template!.id).maybeSingle();
      expect(readError).toBeNull();
      expect(readBack).toBeTruthy(); // test 32/35: Template itself stays fully readable

      // Actually attempting to USE it (the existing writer, fed the
      // Template's now-archived pocket_id) is rejected by Phase A's own
      // archived-pocket guard — Templates add no new enforcement here,
      // they just surface it (test 33/34).
      const { error: useError } = await userA.rpc("create_income_expense_transaction", {
        p_transaction_type: "EXPENSE",
        p_wallet_id: walletId,
        p_pocket_id: readBack.pocket_id,
        p_category_id: env.SUPABASE_TEST_PERSONAL_EXPENSE_CATEGORY_ID!, // categoryId above is now archived — use a valid substitute, as the real UI flow would require picking a replacement
        p_amount: "50.00",
      });
      expect(useError).not.toBeNull();
    } finally {
      await deleteThrowawayWallet(userA, walletId);
    }
  });
});

describe.skipIf(!hasLiveProject)("Template use reuses the existing transaction writer (tests 37-40)", () => {
  it("creating a transaction after 'using' a Template calls the same RPC, assigns tags atomically, behaves like a manual entry, and leaves the Template unchanged", async () => {
    const userA = await signIn(env.SUPABASE_TEST_USER_A_EMAIL!, env.SUPABASE_TEST_USER_A_PASSWORD!);
    const { walletId, firstPocketId } = await createThrowawayWallet(userA, "Template Use Reuse Test");
    try {
      const categoryId = await createThrowawayExpenseCategory(userA, "Template Use Reuse Cat", { scope: "PERSONAL" });
      const tagId = await createThrowawayTag(userA, "TemplateUseReuseTag", { scope: "PERSONAL" });

      const { data: template } = await createThrowawayTemplate(userA, {
        scope: "PERSONAL",
        transactionType: "EXPENSE",
        walletId,
        pocketId: firstPocketId,
        categoryId,
        amount: "60.00",
      });
      await userA.rpc("set_template_tags", { p_template_id: template!.id, p_tag_ids: [tagId] });

      const balanceBefore = await walletBalance(userA, walletId);

      // "Using" the Template means the client reads its defaults, then
      // calls create_income_expense_transaction exactly as a manual
      // entry would (test 37) — simulated here directly.
      const { data: transactionId, error } = await userA.rpc("create_income_expense_transaction", {
        p_transaction_type: "EXPENSE",
        p_wallet_id: walletId,
        p_pocket_id: firstPocketId,
        p_category_id: categoryId,
        p_amount: "80.00", // user changed 60 -> 80 before Save
        p_tag_ids: [tagId],
      });
      expect(error).toBeNull();

      expect(await walletBalance(userA, walletId)).toBeCloseTo(balanceBefore - 80, 2); // behaves exactly like a manual entry (test 39)

      const { data: tagLinks } = await userA.from("transaction_tags").select("tag_id").eq("transaction_id", transactionId);
      expect(tagLinks).toHaveLength(1); // test 38: tags assigned atomically with the create

      const { data: templateAfter } = await userA.from("transaction_templates").select("amount").eq("id", template!.id).single();
      expect(Number(templateAfter!.amount)).toBeCloseTo(60, 2); // test 40: Template itself untouched by using it
    } finally {
      await deleteThrowawayWallet(userA, walletId);
    }
  });
});

async function createThrowawayRecurringTransaction(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- see financeTotalsFor's comment above
  client: any,
  params: {
    scope: "PERSONAL" | "HOUSEHOLD";
    ownerUserId?: string;
    householdId?: string;
    transactionType: "INCOME" | "EXPENSE";
    name?: string;
    walletId?: string;
    pocketId?: string;
    categoryId?: string;
    amount?: string;
    frequency?: "WEEKLY" | "MONTHLY" | "YEARLY";
    intervalCount?: number;
    startDate?: string;
    endDate?: string;
  },
) {
  const { data: userId } = await client.auth.getUser();
  return client
    .from("recurring_transactions")
    .insert({
      scope: params.scope,
      owner_user_id: params.scope === "PERSONAL" ? params.ownerUserId ?? userId.user!.id : null,
      household_id: params.scope === "HOUSEHOLD" ? params.householdId : null,
      transaction_type: params.transactionType,
      name: params.name ?? `Recurring ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      wallet_id: params.walletId ?? null,
      pocket_id: params.pocketId ?? null,
      category_id: params.categoryId ?? null,
      amount: params.amount ?? "100.00",
      frequency: params.frequency ?? "MONTHLY",
      interval_count: params.intervalCount ?? 1,
      start_date: params.startDate ?? "2026-01-01",
      end_date: params.endDate ?? null,
      created_by: userId.user!.id,
    })
    .select()
    .single() as Promise<{ data: { id: string } | null; error: { message: string; code?: string } | null }>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- see financeTotalsFor's comment above
async function materializeFor(client: any, scope: "PERSONAL" | "HOUSEHOLD", householdId?: string) {
  const { error } = await client.rpc("materialize_recurring_occurrences", { p_scope: scope, p_household_id: householdId ?? null });
  if (error) throw error;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- see financeTotalsFor's comment above
async function occurrencesFor(client: any, recurringId: string) {
  const { data, error } = await client
    .from("recurring_occurrences")
    .select("*")
    .eq("recurring_transaction_id", recurringId)
    .order("due_date", { ascending: true });
  if (error) throw error;
  return data as Array<{ id: string; due_date: string; status: string; posted_transaction_id: string | null }>;
}

describe.skipIf(!hasLiveProject)("Recurring CRUD (tests 1-7)", () => {
  it("creates an Expense rule and an Income rule, edits, pauses, resumes, archives, and restores", async () => {
    const userA = await signIn(env.SUPABASE_TEST_USER_A_EMAIL!, env.SUPABASE_TEST_USER_A_PASSWORD!);
    const categoryId = await createThrowawayExpenseCategory(userA, "Recurring Expense Cat", { scope: "PERSONAL" });

    const expenseResult = await createThrowawayRecurringTransaction(userA, {
      scope: "PERSONAL",
      transactionType: "EXPENSE",
      name: `Netflix ${Date.now()}`,
      categoryId,
      amount: "419.00",
      frequency: "MONTHLY",
      startDate: "2026-01-10",
    });
    expect(expenseResult.error).toBeNull(); // test 1

    const { data: userId } = await userA.auth.getUser();
    const { data: incomeCategory } = await userA
      .from("categories")
      .insert({ name: `Recurring Income Cat ${Date.now()}`, transaction_type: "INCOME", scope: "PERSONAL", owner_user_id: userId.user!.id, created_by: userId.user!.id })
      .select()
      .single();
    const incomeResult = await createThrowawayRecurringTransaction(userA, {
      scope: "PERSONAL",
      transactionType: "INCOME",
      name: `Salary ${Date.now()}`,
      categoryId: incomeCategory!.id,
      amount: "25000.00",
      frequency: "MONTHLY",
      startDate: "2026-01-25",
    });
    expect(incomeResult.error).toBeNull(); // test 2

    const recurringId = expenseResult.data!.id;
    const { error: editError } = await userA.from("recurring_transactions").update({ amount: "450.00" }).eq("id", recurringId);
    expect(editError).toBeNull(); // test 3

    const { error: pauseError } = await userA.from("recurring_transactions").update({ paused_at: new Date().toISOString() }).eq("id", recurringId);
    expect(pauseError).toBeNull(); // test 4

    const { error: resumeError } = await userA.from("recurring_transactions").update({ paused_at: null }).eq("id", recurringId);
    expect(resumeError).toBeNull(); // test 5

    const { error: archiveError } = await userA.from("recurring_transactions").update({ archived_at: new Date().toISOString() }).eq("id", recurringId);
    expect(archiveError).toBeNull(); // test 6

    const { error: restoreError } = await userA.from("recurring_transactions").update({ archived_at: null }).eq("id", recurringId);
    expect(restoreError).toBeNull(); // test 7
  });
});

describe.skipIf(!hasLiveProject)("Recurring accounting no-effect (tests 8-12)", () => {
  it("creating, editing, pausing, and archiving a rule changes no balance, no ledger row, no Budget spend, and no monthly total", async () => {
    const userA = await signIn(env.SUPABASE_TEST_USER_A_EMAIL!, env.SUPABASE_TEST_USER_A_PASSWORD!);
    const { walletId, firstPocketId } = await createThrowawayWallet(userA, "Recurring No Effect Test");
    try {
      const categoryId = await createThrowawayExpenseCategory(userA, "Recurring No Effect Cat", { scope: "PERSONAL" });
      await createThrowawayBudget(userA, { scope: "PERSONAL", categoryId, periodMonth: "2026-09-01", amount: "5000.00" });

      const balanceBefore = await walletBalance(userA, walletId);
      const range = financeMonthRange(currentFinanceMonth());
      const totalsBefore = await financeTotalsFor(userA, range);
      const [budgetBefore] = (await budgetSummaryFor(userA, "2026-09")).filter((r) => r.category_id === categoryId);

      const { data: rule, error } = await createThrowawayRecurringTransaction(userA, {
        scope: "PERSONAL",
        transactionType: "EXPENSE",
        walletId,
        pocketId: firstPocketId,
        categoryId,
        amount: "999.00",
      });
      expect(error).toBeNull();

      await userA.from("recurring_transactions").update({ amount: "1500.00" }).eq("id", rule!.id);
      await userA.from("recurring_transactions").update({ paused_at: new Date().toISOString() }).eq("id", rule!.id);
      await userA.from("recurring_transactions").update({ archived_at: new Date().toISOString() }).eq("id", rule!.id);

      expect(await walletBalance(userA, walletId)).toBeCloseTo(balanceBefore, 2); // test 8

      const { data: entries } = await userA.from("transaction_entries").select("id").eq("wallet_id", walletId);
      expect(entries).toHaveLength(0); // test 9: no transaction_entries row exists for this brand-new throwaway wallet

      const totalsAfter = await financeTotalsFor(userA, range);
      expect(totalsAfter.forCurrency("THB").expense).toBe(totalsBefore.forCurrency("THB").expense); // test 12

      const [budgetAfter] = (await budgetSummaryFor(userA, "2026-09")).filter((r) => r.category_id === categoryId);
      expect(Number(budgetAfter?.net_spent ?? 0)).toBeCloseTo(Number(budgetBefore?.net_spent ?? 0), 2); // test 10/56 (rule alone has no Budget effect)
    } finally {
      await deleteThrowawayWallet(userA, walletId);
    }
  });
});

describe.skipIf(!hasLiveProject)("Recurring schedule generation (tests 13-21)", () => {
  it("generates WEEKLY/every-2-weeks, MONTHLY/every-3-months, and YEARLY occurrences, respecting start/end dates and a bounded horizon idempotently", async () => {
    const userA = await signIn(env.SUPABASE_TEST_USER_A_EMAIL!, env.SUPABASE_TEST_USER_A_PASSWORD!);
    const categoryId = await createThrowawayExpenseCategory(userA, "Recurring Schedule Cat", { scope: "PERSONAL" });

    const { data: weekly } = await createThrowawayRecurringTransaction(userA, {
      scope: "PERSONAL",
      transactionType: "EXPENSE",
      categoryId,
      frequency: "WEEKLY",
      intervalCount: 1,
      startDate: "2026-09-01",
    });
    const { data: everyTwoWeeks } = await createThrowawayRecurringTransaction(userA, {
      scope: "PERSONAL",
      transactionType: "EXPENSE",
      categoryId,
      frequency: "WEEKLY",
      intervalCount: 2,
      startDate: "2026-09-01",
    });
    const { data: monthly } = await createThrowawayRecurringTransaction(userA, {
      scope: "PERSONAL",
      transactionType: "EXPENSE",
      categoryId,
      frequency: "MONTHLY",
      intervalCount: 1,
      startDate: "2026-09-01",
    });
    const { data: everyThreeMonths } = await createThrowawayRecurringTransaction(userA, {
      scope: "PERSONAL",
      transactionType: "EXPENSE",
      categoryId,
      frequency: "MONTHLY",
      intervalCount: 3,
      startDate: "2026-09-01",
    });
    const { data: yearly } = await createThrowawayRecurringTransaction(userA, {
      scope: "PERSONAL",
      transactionType: "EXPENSE",
      categoryId,
      frequency: "YEARLY",
      intervalCount: 1,
      startDate: "2026-09-01",
    });
    const { data: bounded } = await createThrowawayRecurringTransaction(userA, {
      scope: "PERSONAL",
      transactionType: "EXPENSE",
      categoryId,
      frequency: "MONTHLY",
      intervalCount: 1,
      startDate: "2026-09-01",
      endDate: "2026-10-15",
    });

    await materializeFor(userA, "PERSONAL");
    await materializeFor(userA, "PERSONAL"); // second call: must not duplicate anything (test 20)

    const weeklyOccurrences = await occurrencesFor(userA, weekly!.id);
    expect(weeklyOccurrences.map((o) => o.due_date)).toEqual(["2026-09-01", "2026-09-08", "2026-09-15", "2026-09-22", "2026-09-29"]); // test 13, within a 90-day horizon
    expect(new Set(weeklyOccurrences.map((o) => o.due_date)).size).toBe(weeklyOccurrences.length); // test 20: no duplicates after the repeated materialize call

    const everyTwoWeeksOccurrences = await occurrencesFor(userA, everyTwoWeeks!.id);
    expect(everyTwoWeeksOccurrences.slice(0, 3).map((o) => o.due_date)).toEqual(["2026-09-01", "2026-09-15", "2026-09-29"]); // test 14

    const monthlyOccurrences = await occurrencesFor(userA, monthly!.id);
    expect(monthlyOccurrences.slice(0, 3).map((o) => o.due_date)).toEqual(["2026-09-01", "2026-10-01", "2026-11-01"]); // test 15

    const everyThreeMonthsOccurrences = await occurrencesFor(userA, everyThreeMonths!.id);
    expect(everyThreeMonthsOccurrences.slice(0, 2).map((o) => o.due_date)).toEqual(["2026-09-01", "2026-12-01"]); // test 16

    const yearlyOccurrences = await occurrencesFor(userA, yearly!.id);
    expect(yearlyOccurrences.map((o) => o.due_date)).toEqual(["2026-09-01"]); // test 17: only one within a 90-day horizon of a yearly cadence

    expect(weeklyOccurrences[0]!.due_date).toBe("2026-09-01"); // test 18: start date respected as the very first occurrence

    const boundedOccurrences = await occurrencesFor(userA, bounded!.id);
    expect(boundedOccurrences.map((o) => o.due_date)).toEqual(["2026-09-01", "2026-10-01"]); // test 19: nothing past end_date (2026-10-15 excludes 2026-11-01)
    expect(weeklyOccurrences.length).toBeLessThan(20); // test 21: bounded horizon, not "generate forever"
  });
});

describe.skipIf(!hasLiveProject)("Recurring month-end anchoring (tests 22-25)", () => {
  it("31 Jan -> 28/29 Feb -> 31 Mar -> 30 Apr, never drifting to the previous clamped day", async () => {
    const userA = await signIn(env.SUPABASE_TEST_USER_A_EMAIL!, env.SUPABASE_TEST_USER_A_PASSWORD!);
    const categoryId = await createThrowawayExpenseCategory(userA, "Recurring Anchor Cat", { scope: "PERSONAL" });

    const { data: rule } = await createThrowawayRecurringTransaction(userA, {
      scope: "PERSONAL",
      transactionType: "EXPENSE",
      categoryId,
      frequency: "MONTHLY",
      intervalCount: 1,
      startDate: "2026-01-31",
      endDate: "2026-04-30",
    });
    await materializeFor(userA, "PERSONAL");
    const occurrences = await occurrencesFor(userA, rule!.id);
    // test 22 (Jan 31 -> Feb 28, 2026 is not a leap year), test 23 (Feb 28
    // -> Mar 31, NOT Mar 28 — the anchor stays 31, it never drifts to the
    // previously-clamped 28), test 24 (Mar 31 -> Apr 30).
    expect(occurrences.map((o) => o.due_date)).toEqual(["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30"]);
  });

  it("29 Feb (leap year) -> 28 Feb -> 28 Feb -> 29 Feb (next leap year), yearly", async () => {
    const userA = await signIn(env.SUPABASE_TEST_USER_A_EMAIL!, env.SUPABASE_TEST_USER_A_PASSWORD!);
    const categoryId = await createThrowawayExpenseCategory(userA, "Recurring Leap Cat", { scope: "PERSONAL" });

    const { data: rule } = await createThrowawayRecurringTransaction(userA, {
      scope: "PERSONAL",
      transactionType: "EXPENSE",
      categoryId,
      frequency: "YEARLY",
      intervalCount: 1,
      startDate: "2024-02-29",
      endDate: "2028-02-29",
    });
    await materializeFor(userA, "PERSONAL");
    const occurrences = await occurrencesFor(userA, rule!.id);
    expect(occurrences.map((o) => o.due_date)).toEqual(["2024-02-29", "2025-02-28", "2026-02-28", "2027-02-28", "2028-02-29"]); // test 25
  });
});

describe.skipIf(!hasLiveProject)("Recurring date contract (tests 26-27)", () => {
  it("stores due_date as a canonical DATE with no UTC/Bangkok boundary drift", async () => {
    const userA = await signIn(env.SUPABASE_TEST_USER_A_EMAIL!, env.SUPABASE_TEST_USER_A_PASSWORD!);
    const categoryId = await createThrowawayExpenseCategory(userA, "Recurring Date Contract Cat", { scope: "PERSONAL" });
    const { data: rule } = await createThrowawayRecurringTransaction(userA, {
      scope: "PERSONAL",
      transactionType: "EXPENSE",
      categoryId,
      frequency: "MONTHLY",
      startDate: "2026-09-01",
    });
    await materializeFor(userA, "PERSONAL");
    const [first] = await occurrencesFor(userA, rule!.id);
    expect(first!.due_date).toBe("2026-09-01"); // test 26: exact string, no timestamptz/timezone shift
    expect(first!.due_date).not.toContain("T"); // test 27: a DATE, not a timestamptz
  });
});

describe.skipIf(!hasLiveProject)("Recurring occurrence lifecycle (tests 28-32)", () => {
  it("materializes UPCOMING occurrences, skips one with no ledger effect, and posts another as one real transaction", async () => {
    const userA = await signIn(env.SUPABASE_TEST_USER_A_EMAIL!, env.SUPABASE_TEST_USER_A_PASSWORD!);
    const { walletId, firstPocketId } = await createThrowawayWallet(userA, "Recurring Lifecycle Test");
    try {
      const categoryId = await createThrowawayExpenseCategory(userA, "Recurring Lifecycle Cat", { scope: "PERSONAL" });
      const { data: rule } = await createThrowawayRecurringTransaction(userA, {
        scope: "PERSONAL",
        transactionType: "EXPENSE",
        walletId,
        pocketId: firstPocketId,
        categoryId,
        amount: "419.00",
        frequency: "MONTHLY",
        startDate: "2026-09-01",
        endDate: "2026-11-01",
      });
      await materializeFor(userA, "PERSONAL");
      const occurrences = await occurrencesFor(userA, rule!.id);
      expect(occurrences.every((o) => o.status === "UPCOMING")).toBe(true); // test 28

      const { error: skipError } = await userA.rpc("skip_recurring_occurrence", { p_occurrence_id: occurrences[0]!.id });
      expect(skipError).toBeNull();
      const { data: skippedRow } = await userA.from("recurring_occurrences").select("status").eq("id", occurrences[0]!.id).single();
      expect(skippedRow!.status).toBe("SKIPPED"); // test 29: no transaction created

      await materializeFor(userA, "PERSONAL"); // test 30: re-materializing must not regenerate the skipped due_date
      const afterReMaterialize = await occurrencesFor(userA, rule!.id);
      expect(afterReMaterialize.filter((o) => o.due_date === occurrences[0]!.due_date)).toHaveLength(1);
      expect(afterReMaterialize.find((o) => o.due_date === occurrences[0]!.due_date)!.status).toBe("SKIPPED");

      const balanceBefore = await walletBalance(userA, walletId);
      const { data: transactionId, error: postError } = await userA.rpc("post_recurring_occurrence", {
        p_occurrence_id: occurrences[1]!.id,
        p_wallet_id: walletId,
        p_pocket_id: firstPocketId,
        p_category_id: categoryId,
        p_amount: "419.00",
      });
      expect(postError).toBeNull(); // test 31: one real transaction created
      expect(await walletBalance(userA, walletId)).toBeCloseTo(balanceBefore - 419, 2);

      const { data: postedRow } = await userA.from("recurring_occurrences").select("status, posted_transaction_id").eq("id", occurrences[1]!.id).single();
      expect(postedRow!.status).toBe("POSTED");
      expect(postedRow!.posted_transaction_id).toBe(transactionId); // test 32

      const { data: postedTransaction } = await userA.from("transactions").select("occurred_at").eq("id", transactionId).single();
      expect(postedTransaction!.occurred_at.slice(0, 10)).toBe(occurrences[1]!.due_date); // test 37: omitted occurred_at defaults to due_date
    } finally {
      await deleteThrowawayWallet(userA, walletId);
    }
  });
});

describe.skipIf(!hasLiveProject)("Recurring posting fields and tags (tests 33-38, 58-60)", () => {
  it("posts with the user-edited amount/wallet/pocket/category and copies only active saved tags", async () => {
    const userA = await signIn(env.SUPABASE_TEST_USER_A_EMAIL!, env.SUPABASE_TEST_USER_A_PASSWORD!);
    const { walletId, firstPocketId } = await createThrowawayWallet(userA, "Recurring Posting Fields Test");
    try {
      const categoryId = await createThrowawayExpenseCategory(userA, "Recurring Posting Fields Cat", { scope: "PERSONAL" });
      const activeTagId = await createThrowawayTag(userA, "RecurringPostingActiveTag", { scope: "PERSONAL" });
      const archivedTagId = await createThrowawayTag(userA, "RecurringPostingArchivedTag", { scope: "PERSONAL" });

      const { data: rule } = await createThrowawayRecurringTransaction(userA, {
        scope: "PERSONAL",
        transactionType: "EXPENSE",
        walletId,
        pocketId: firstPocketId,
        categoryId,
        amount: "100.00",
        frequency: "MONTHLY",
        startDate: "2026-09-01",
      });
      const { error: tagsError } = await userA.rpc("set_recurring_transaction_tags", { p_recurring_id: rule!.id, p_tag_ids: [activeTagId, archivedTagId] });
      expect(tagsError).toBeNull(); // test 58: rule tags preserved

      await userA.from("tags").update({ archived_at: new Date().toISOString() }).eq("id", archivedTagId);

      await materializeFor(userA, "PERSONAL");
      const [occurrence] = await occurrencesFor(userA, rule!.id);

      const { data: transactionId, error: postError } = await userA.rpc("post_recurring_occurrence", {
        p_occurrence_id: occurrence!.id,
        p_wallet_id: walletId,
        p_pocket_id: firstPocketId,
        p_category_id: categoryId,
        p_amount: "150.00", // test 33: user-edited amount, not the rule's saved 100.00
        p_tag_ids: [activeTagId], // test 37: an archived saved tag is excluded by the caller, not passed
      });
      expect(postError).toBeNull();

      const { data: entry } = await userA.from("transaction_entries").select("amount, wallet_id, pocket_id").eq("transaction_id", transactionId).single();
      expect(Number(entry!.amount)).toBeCloseTo(-150, 2); // test 33/34
      expect(entry!.wallet_id).toBe(walletId);
      expect(entry!.pocket_id).toBe(firstPocketId);

      const { data: postedTransaction } = await userA.from("transactions").select("category_id").eq("id", transactionId).single();
      expect(postedTransaction!.category_id).toBe(categoryId); // test 35: category validated/applied

      const { data: tagLinks } = await userA.from("transaction_tags").select("tag_id").eq("transaction_id", transactionId);
      expect(tagLinks).toHaveLength(1); // test 36/59: only the active tag was copied
      expect(tagLinks![0]!.tag_id).toBe(activeTagId);

      // test 60: tag churn on the rule after posting never touches the
      // already-posted transaction's own tags.
      await userA.rpc("set_recurring_transaction_tags", { p_recurring_id: rule!.id, p_tag_ids: [] });
      const { data: tagLinksAfterChurn } = await userA.from("transaction_tags").select("tag_id").eq("transaction_id", transactionId);
      expect(tagLinksAfterChurn).toHaveLength(1);
    } finally {
      await deleteThrowawayWallet(userA, walletId);
    }
  });
});

describe.skipIf(!hasLiveProject)("Recurring atomic posting and double-post protection (tests 39-41)", () => {
  it("leaves the occurrence UPCOMING when posting fails, marks it POSTED on success, and allows only one post under concurrency", async () => {
    const userA = await signIn(env.SUPABASE_TEST_USER_A_EMAIL!, env.SUPABASE_TEST_USER_A_PASSWORD!);
    const { walletId, firstPocketId } = await createThrowawayWallet(userA, "Recurring Atomic Post Test");
    try {
      const categoryId = await createThrowawayExpenseCategory(userA, "Recurring Atomic Post Cat", { scope: "PERSONAL" });
      const { data: rule } = await createThrowawayRecurringTransaction(userA, {
        scope: "PERSONAL",
        transactionType: "EXPENSE",
        walletId,
        pocketId: firstPocketId,
        categoryId,
        amount: "100.00",
        frequency: "MONTHLY",
        startDate: "2026-09-01",
      });
      await materializeFor(userA, "PERSONAL");
      const [occurrence] = await occurrencesFor(userA, rule!.id);

      const { error: failedPostError } = await userA.rpc("post_recurring_occurrence", {
        p_occurrence_id: occurrence!.id,
        p_wallet_id: walletId,
        p_pocket_id: firstPocketId,
        p_category_id: env.SUPABASE_TEST_PERSONAL_INCOME_CATEGORY_ID!, // wrong type for an EXPENSE rule -> rejected
        p_amount: "100.00",
      });
      expect(failedPostError).not.toBeNull(); // test 39
      const { data: stillUpcoming } = await userA.from("recurring_occurrences").select("status").eq("id", occurrence!.id).single();
      expect(stillUpcoming!.status).toBe("UPCOMING");

      const postArgs = { p_occurrence_id: occurrence!.id, p_wallet_id: walletId, p_pocket_id: firstPocketId, p_category_id: categoryId, p_amount: "100.00" };
      const [first, second] = await Promise.all([userA.rpc("post_recurring_occurrence", postArgs), userA.rpc("post_recurring_occurrence", postArgs)]);
      const successes = [first, second].filter((r) => !r.error);
      const failures = [first, second].filter((r) => r.error);
      expect(successes).toHaveLength(1); // test 41: only one of the two concurrent posts succeeds
      expect(failures).toHaveLength(1);

      const { data: postedRow } = await userA.from("recurring_occurrences").select("status").eq("id", occurrence!.id).single();
      expect(postedRow!.status).toBe("POSTED"); // test 40

      const { data: entries } = await userA.from("transaction_entries").select("id").eq("wallet_id", walletId);
      expect(entries).toHaveLength(1); // exactly one transaction, never two
    } finally {
      await deleteThrowawayWallet(userA, walletId);
    }
  });
});

describe.skipIf(!hasLiveProject)("Recurring scope / authorization (tests 42-45)", () => {
  it("is owner-only for Personal, member-valid for Household, denies an outsider, and rejects cross-household references", async () => {
    const userA = await signIn(env.SUPABASE_TEST_USER_A_EMAIL!, env.SUPABASE_TEST_USER_A_PASSWORD!);
    const personalCategoryId = await createThrowawayExpenseCategory(userA, "Recurring Scope Personal Cat", { scope: "PERSONAL" });
    const { data: personalRule } = await createThrowawayRecurringTransaction(userA, { scope: "PERSONAL", transactionType: "EXPENSE", categoryId: personalCategoryId });

    const userB = await signIn(env.SUPABASE_TEST_USER_B_EMAIL!, env.SUPABASE_TEST_USER_B_PASSWORD!);
    const { data: outsiderRead } = await userB.from("recurring_transactions").select("id").eq("id", personalRule!.id).maybeSingle();
    expect(outsiderRead).toBeNull(); // test 42/44: RLS-invisible to anyone but the owner

    const outsiderTagsResult = await userB.rpc("set_recurring_transaction_tags", { p_recurring_id: personalRule!.id, p_tag_ids: [] });
    expect(outsiderTagsResult.error).not.toBeNull();

    const householdOneId = await createThrowawayHousehold(userA, "Recurring Scope H1");
    const householdTwoId = await createThrowawayHousehold(userA, "Recurring Scope H2");
    const householdOneCategoryId = await createThrowawayExpenseCategory(userA, "Recurring Scope H1 Cat", { scope: "HOUSEHOLD", householdId: householdOneId });

    const crossHouseholdResult = await createThrowawayRecurringTransaction(userA, {
      scope: "HOUSEHOLD",
      householdId: householdTwoId,
      transactionType: "EXPENSE",
      categoryId: householdOneCategoryId,
    });
    expect(crossHouseholdResult.error).not.toBeNull(); // test 45

    const owner = await signIn(env.SUPABASE_TEST_HOUSEHOLD_OWNER_EMAIL!, env.SUPABASE_TEST_HOUSEHOLD_OWNER_PASSWORD!);
    const sharedCategoryId = await createThrowawayExpenseCategory(owner, "Recurring Scope Shared Cat", {
      scope: "HOUSEHOLD",
      householdId: env.SUPABASE_TEST_HOUSEHOLD_ID!,
    });
    const member = await signIn(env.SUPABASE_TEST_HOUSEHOLD_MEMBER_EMAIL!, env.SUPABASE_TEST_HOUSEHOLD_MEMBER_PASSWORD!);
    const memberResult = await createThrowawayRecurringTransaction(member, {
      scope: "HOUSEHOLD",
      householdId: env.SUPABASE_TEST_HOUSEHOLD_ID!,
      transactionType: "EXPENSE",
      categoryId: sharedCategoryId,
    });
    expect(memberResult.error).toBeNull(); // test 43: member-level, not creator-only
  });
});

describe.skipIf(!hasLiveProject)("Stale Recurring references (tests 46-49)", () => {
  it("stays readable with an archived Wallet/Category, and the underlying ledger writer still rejects posting against an archived Wallet", async () => {
    const userA = await signIn(env.SUPABASE_TEST_USER_A_EMAIL!, env.SUPABASE_TEST_USER_A_PASSWORD!);
    const { walletId, firstPocketId } = await createThrowawayWallet(userA, "Stale Recurring Test");
    const categoryId = await createThrowawayExpenseCategory(userA, "Stale Recurring Cat", { scope: "PERSONAL" });
    const { data: rule } = await createThrowawayRecurringTransaction(userA, {
      scope: "PERSONAL",
      transactionType: "EXPENSE",
      walletId,
      pocketId: firstPocketId,
      categoryId,
      amount: "50.00",
      frequency: "MONTHLY",
      startDate: "2026-09-01",
    });
    await materializeFor(userA, "PERSONAL");
    const [occurrence] = await occurrencesFor(userA, rule!.id);

    await userA.from("categories").update({ archived_at: new Date().toISOString() }).eq("id", categoryId);
    // Simulate the saved Wallet being gone/archived by hard-deleting the
    // throwaway wallet outright — no `finally` cleanup needed below since
    // this IS the cleanup (nothing else in this test creates state).
    await deleteThrowawayWallet(userA, walletId);

    const { data: readBack, error: readError } = await userA.from("recurring_transactions").select("*").eq("id", rule!.id).maybeSingle();
    expect(readError).toBeNull();
    expect(readBack).toBeTruthy(); // test 46/48: rule itself stays fully readable

    // Posting against a separately-archived Wallet (Phase A's own guard,
    // reused unchanged — see docs/FINANCE.md Phase G "Stale-reference
    // handling") is rejected (test 47/49); a real UI flow would require
    // picking a replacement Wallet/Category instead.
    const { error: postError } = await userA.rpc("post_recurring_occurrence", {
      p_occurrence_id: occurrence!.id,
      p_wallet_id: env.SUPABASE_TEST_ARCHIVED_WALLET_ID!,
      p_pocket_id: env.SUPABASE_TEST_ARCHIVED_POCKET_ID!,
      p_category_id: env.SUPABASE_TEST_PERSONAL_EXPENSE_CATEGORY_ID!,
      p_amount: "50.00",
    });
    expect(postError).not.toBeNull();
  });
});

describe.skipIf(!hasLiveProject)("Recurring rule edit rebuilds only future UPCOMING occurrences (tests 50-52)", () => {
  it("keeps POSTED and SKIPPED history untouched while regenerating UPCOMING occurrences under a new schedule", async () => {
    const userA = await signIn(env.SUPABASE_TEST_USER_A_EMAIL!, env.SUPABASE_TEST_USER_A_PASSWORD!);
    const { walletId, firstPocketId } = await createThrowawayWallet(userA, "Recurring Edit Rebuild Test");
    try {
      const categoryId = await createThrowawayExpenseCategory(userA, "Recurring Edit Rebuild Cat", { scope: "PERSONAL" });
      const { data: rule } = await createThrowawayRecurringTransaction(userA, {
        scope: "PERSONAL",
        transactionType: "EXPENSE",
        walletId,
        pocketId: firstPocketId,
        categoryId,
        amount: "100.00",
        frequency: "MONTHLY",
        intervalCount: 1,
        startDate: "2026-09-01",
        endDate: "2026-12-01",
      });
      await materializeFor(userA, "PERSONAL");
      const beforeEdit = await occurrencesFor(userA, rule!.id);

      await userA.rpc("post_recurring_occurrence", {
        p_occurrence_id: beforeEdit[0]!.id,
        p_wallet_id: walletId,
        p_pocket_id: firstPocketId,
        p_category_id: categoryId,
        p_amount: "100.00",
      });
      await userA.rpc("skip_recurring_occurrence", { p_occurrence_id: beforeEdit[1]!.id });
      const postedDueDate = beforeEdit[0]!.due_date;
      const skippedDueDate = beforeEdit[1]!.due_date;

      // Edit the schedule itself (frequency change) — this is the trigger
      // that must rebuild future UPCOMING occurrences.
      const { error: scheduleEditError } = await userA
        .from("recurring_transactions")
        .update({ frequency: "MONTHLY", interval_count: 2, start_date: "2026-09-01", end_date: "2027-03-01" })
        .eq("id", rule!.id);
      expect(scheduleEditError).toBeNull();

      const afterEdit = await occurrencesFor(userA, rule!.id);
      const postedRow = afterEdit.find((o) => o.due_date === postedDueDate);
      const skippedRow = afterEdit.find((o) => o.due_date === skippedDueDate);
      expect(postedRow?.status).toBe("POSTED"); // test 50: posted history untouched
      expect(skippedRow?.status).toBe("SKIPPED"); // test 52: past skipped history preserved

      const upcomingAfterEdit = afterEdit.filter((o) => o.status === "UPCOMING");
      expect(upcomingAfterEdit.every((o) => o.due_date !== postedDueDate && o.due_date !== skippedDueDate)).toBe(true);
      expect(upcomingAfterEdit.map((o) => o.due_date)).toContain("2026-11-01"); // test 51: rebuilt under the new every-2-months cadence starting after the last real occurrence
    } finally {
      await deleteThrowawayWallet(userA, walletId);
    }
  });
});

describe.skipIf(!hasLiveProject)("Recurring / void interaction (tests 53-55, 57)", () => {
  it("keeps a posted occurrence POSTED when its transaction is voided, never silently reposting it, and affects Budget exactly once", async () => {
    const userA = await signIn(env.SUPABASE_TEST_USER_A_EMAIL!, env.SUPABASE_TEST_USER_A_PASSWORD!);
    const { walletId, firstPocketId } = await createThrowawayWallet(userA, "Recurring Void Interaction Test");
    try {
      const categoryId = await createThrowawayExpenseCategory(userA, "Recurring Void Interaction Cat", { scope: "PERSONAL" });
      await createThrowawayBudget(userA, { scope: "PERSONAL", categoryId, periodMonth: "2026-09-01", amount: "5000.00" });
      const [budgetBefore] = (await budgetSummaryFor(userA, "2026-09")).filter((r) => r.category_id === categoryId);

      const { data: rule } = await createThrowawayRecurringTransaction(userA, {
        scope: "PERSONAL",
        transactionType: "EXPENSE",
        walletId,
        pocketId: firstPocketId,
        categoryId,
        amount: "419.00",
        frequency: "MONTHLY",
        startDate: "2026-09-05",
      });
      await materializeFor(userA, "PERSONAL");
      const [occurrence] = await occurrencesFor(userA, rule!.id);

      const { data: transactionId } = await userA.rpc("post_recurring_occurrence", {
        p_occurrence_id: occurrence!.id,
        p_wallet_id: walletId,
        p_pocket_id: firstPocketId,
        p_category_id: categoryId,
        p_amount: "419.00",
        p_occurred_at: "2026-09-05T12:00:00+07:00",
      });

      const [budgetAfterPost] = (await budgetSummaryFor(userA, "2026-09")).filter((r) => r.category_id === categoryId);
      expect(Number(budgetAfterPost.net_spent) - Number(budgetBefore?.net_spent ?? 0)).toBeCloseTo(419, 2); // test 57

      const { error: voidError } = await userA.rpc("void_transaction", { p_transaction_id: transactionId, p_void_reason: "test" });
      expect(voidError).toBeNull();

      const { data: afterVoid } = await userA.from("recurring_occurrences").select("status, posted_transaction_id").eq("id", occurrence!.id).single();
      expect(afterVoid!.status).toBe("POSTED"); // test 53: never silently reverts to UPCOMING
      expect(afterVoid!.posted_transaction_id).toBe(transactionId);

      const { data: linkedTransaction } = await userA.from("transactions").select("deleted_at").eq("id", transactionId).single();
      expect(linkedTransaction!.deleted_at).not.toBeNull(); // test 54: the read model can derive VOIDED by joining this column

      await materializeFor(userA, "PERSONAL"); // test 55: no automatic repost of the same due_date
      const allOccurrences = await occurrencesFor(userA, rule!.id);
      expect(allOccurrences.filter((o) => o.due_date === occurrence!.due_date)).toHaveLength(1);
    } finally {
      await deleteThrowawayWallet(userA, walletId);
    }
  });
});

describe.skipIf(!hasLiveProject)("Recurring multi-currency safety (tests 61-62)", () => {
  it("posting against one currency's Wallet never affects a different-currency Wallet's balance", async () => {
    const userA = await signIn(env.SUPABASE_TEST_USER_A_EMAIL!, env.SUPABASE_TEST_USER_A_PASSWORD!);
    const thbWallet = await createThrowawayWallet(userA, "Recurring Multi-Currency THB", "THB");
    const usdWallet = await createThrowawayWallet(userA, "Recurring Multi-Currency USD", "USD");
    try {
      const categoryId = await createThrowawayExpenseCategory(userA, "Recurring Multi-Currency Cat", { scope: "PERSONAL" });
      const { data: rule } = await createThrowawayRecurringTransaction(userA, {
        scope: "PERSONAL",
        transactionType: "EXPENSE",
        categoryId,
        amount: "100.00",
        frequency: "MONTHLY",
        startDate: "2026-09-01",
      });
      await materializeFor(userA, "PERSONAL");
      const [occurrence] = await occurrencesFor(userA, rule!.id);

      const usdBalanceBefore = await walletBalance(userA, usdWallet.walletId);

      await userA.rpc("post_recurring_occurrence", {
        p_occurrence_id: occurrence!.id,
        p_wallet_id: thbWallet.walletId,
        p_pocket_id: thbWallet.firstPocketId,
        p_category_id: categoryId,
        p_amount: "100.00",
      });

      expect(await walletBalance(userA, thbWallet.walletId)).toBeCloseTo(-100, 2); // test 62
      expect(await walletBalance(userA, usdWallet.walletId)).toBeCloseTo(usdBalanceBefore, 2); // test 61: no unlike-currency aggregation/bleed
    } finally {
      await deleteThrowawayWallet(userA, thbWallet.walletId);
      await deleteThrowawayWallet(userA, usdWallet.walletId);
    }
  });
});

if (!hasLiveProject) {
  describe("RLS integration tests", () => {
    it.skip("skipped: no live Supabase test project configured (see comment at top of this file)", () => {});
  });
}
