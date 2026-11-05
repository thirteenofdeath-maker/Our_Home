import { describe, it, expect } from "vitest";
import { positiveAmountSchema } from "./money";
describe("positive monetary values", () => {
  it.each(["0", "00", "00.00", "0000.0", "0.00"])(
    "rejects zero encoded as %s",
    (value) =>
      expect(positiveAmountSchema.safeParse(value).success).toBe(false),
  );
  it.each(["0.01", "00.01", "10.00"])("accepts a positive amount %s", (value) =>
    expect(positiveAmountSchema.safeParse(value).success).toBe(true),
  );
});
