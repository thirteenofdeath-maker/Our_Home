import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

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
 *   SUPABASE_TEST_HOUSEHOLD_OWNER_EMAIL / _PASSWORD
 *   SUPABASE_TEST_HOUSEHOLD_ADMIN_EMAIL / _PASSWORD   (role = admin, not owner)
 *   SUPABASE_TEST_HOUSEHOLD_MEMBER_EMAIL / _PASSWORD  (role = member)
 *
 * A registered user who is NOT yet a member of that household (for the
 * "invite a not-yet-member" test):
 *   SUPABASE_TEST_UNINVITED_EMAIL / _PASSWORD
 *
 * Required ONLY for the two describe blocks that say so explicitly below
 * (defense-in-depth trigger tests, and the household-invite success case)
 * — never used anywhere a browser could reach it:
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
      p_to_pocket_id: env.SUPABASE_TEST_HOUSEHOLD_WALLET_POCKET_ID!, // wrong wallet's pocket is fine here: currency check fires first
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

if (!hasLiveProject) {
  describe("RLS integration tests", () => {
    it.skip("skipped: no live Supabase test project configured (see comment at top of this file)", () => {});
  });
}
