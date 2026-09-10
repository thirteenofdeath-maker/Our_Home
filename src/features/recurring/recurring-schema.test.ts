import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(resolve(process.cwd(), "supabase/migrations/0036_recurring_transactions.sql"), "utf8");

describe("recurring schedule SQL contract", () => {
  it("rebuilds an edited schedule from its own start-date anchor", () => {
    expect(sql).toMatch(/if p_fast_forward then\s+v_candidate := p_rule\.start_date;/);
    expect(sql).toMatch(/recurring_transactions_rebuild_occurrences[\s\S]*generate_recurring_occurrences_for_rule\(new, v_today, v_horizon, true\)/);
  });

  it("defaults a posted transaction timestamp from the occurrence due date in Bangkok", () => {
    expect(sql).toMatch(/p_occurred_at timestamptz default null/);
    expect(sql).toMatch(/v_occurrence\.due_date::timestamp at time zone 'Asia\/Bangkok'/);
  });
});
