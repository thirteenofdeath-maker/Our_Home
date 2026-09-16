import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260916014828_finance_daily_report.sql",
  ),
  "utf8",
);

describe("daily finance report", () => {
  it("groups daily totals in the Bangkok calendar without changing report scope", () => {
    expect(sql).toContain("days as (");
    expect(sql).toContain("occurred_at at time zone 'Asia/Bangkok'");
    expect(sql).toMatch(/days as[\s\S]*group by 1, currency/);
    expect(sql).toContain("'days', coalesce(");
    expect(sql).toContain("security invoker");
    expect(sql).toContain("t.scope = p_scope");
  });
});
