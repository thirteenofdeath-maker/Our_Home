import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The page itself is an async Server Component (RSC) that Next.js
 * renders, not something react-dom/server's renderToStaticMarkup can
 * render directly (no RSC runtime in Vitest) — see the established
 * convention across this codebase's page-level files, none of which are
 * rendered directly in tests. The actual branching LOGIC (empty vs error
 * vs success) is unit-tested against real inputs in
 * features/household/activity-api.test.ts; this is a source-level check
 * that the page actually wires that result into three visibly different
 * states, not just two.
 */
const source = readFileSync(resolve(process.cwd(), "src/app/(app)/household/activity/page.tsx"), "utf8");

describe("HouseholdActivityPage — Section 4 corrective patch (loading/empty/success/error)", () => {
  it("branches on result.status === \"error\" BEFORE checking item count — a failure can never fall through to the empty-state branch", () => {
    const errorBranchIndex = source.indexOf('result.status === "error"');
    const emptyBranchIndex = source.indexOf("result.items.length === 0");
    expect(errorBranchIndex).toBeGreaterThan(-1);
    expect(emptyBranchIndex).toBeGreaterThan(-1);
    expect(errorBranchIndex).toBeLessThan(emptyBranchIndex);
  });

  it("renders ErrorState (not EmptyState) for the error branch, with a retry link and no raw error text", () => {
    const errorBlock = source.slice(source.indexOf('result.status === "error"'), source.indexOf("result.items.length === 0"));
    expect(errorBlock).toContain("<ErrorState");
    expect(errorBlock).toContain('href="/household/activity"');
    expect(errorBlock).toContain("ลองอีกครั้ง");
    // Safe, generic copy only — never a raw message/code/identifier.
    expect(errorBlock).not.toMatch(/error\.message|error\.code|err\.message/);
  });

  it("uses the discriminated loadHouseholdExpenseActivity result, not the old swallow-to-empty-array helper", () => {
    expect(source).toContain("loadHouseholdExpenseActivity");
    expect(source).not.toContain("listHouseholdExpenseActivitySafe");
  });
});
