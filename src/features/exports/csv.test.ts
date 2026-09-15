import { describe, expect, it } from "vitest";

import { csvCell, rowsToCsv } from "./csv";

describe("CSV export", () => {
  it("escapes commas, quotes, and newlines", () => {
    expect(csvCell('a,"b"')).toBe('"a,""b"""');
  });

  it("neutralizes spreadsheet formulas while preserving numeric amounts", () => {
    expect(csvCell("=HYPERLINK(\"https://example.com\")")).toBe(
      '"\'=HYPERLINK(""https://example.com"")"',
    );
    expect(csvCell("  +SUM(1,2)")).toBe('"\'  +SUM(1,2)"');
    expect(csvCell("-12.50")).toBe("-12.50");
  });

  it("writes BOM, headers, and logical rows", () => {
    expect(rowsToCsv([{ id: "1", amount: "12.50" }], ["id", "amount"])).toBe(
      "\uFEFFid,amount\r\n1,12.50",
    );
  });
});
