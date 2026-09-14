import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const rls = readFileSync(
  resolve(process.cwd(), "supabase/migrations/0009_rls_money.sql"),
  "utf8",
);
const immutable = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/0014_immutable_identity_fields.sql",
  ),
  "utf8",
);
const api = readFileSync(
  resolve(process.cwd(), "src/features/pockets/api.ts"),
  "utf8",
);

describe("Pocket rename security and accounting boundary", () => {
  it("keeps PERSONAL-owner and HOUSEHOLD-member RLS authorization", () => {
    const policy =
      rls.match(
        /create policy pockets_update[\s\S]*?with check \([\s\S]*?\n  \);/,
      )?.[0] ?? "";
    expect(policy).toContain("w.owner_user_id = auth.uid()");
    expect(policy).toContain("public.is_household_member(w.household_id)");
  });

  it("keeps wallet_id immutable", () => {
    expect(immutable).toContain("pockets_prevent_wallet_reassignment");
    expect(immutable).toContain(
      "prevent_immutable_column_changes('wallet_id')",
    );
  });

  it("delegates the authorized metadata and balance update to one RPC", () => {
    const update =
      api.match(/export async function updatePocket[\s\S]*?\n}/)?.[0] ?? "";
    expect(update).toContain('rpc("update_pocket_details"');
    expect(update).toContain("p_pocket_id: pocketId");
    expect(update).toContain("p_wallet_id: walletId");
  });
});
