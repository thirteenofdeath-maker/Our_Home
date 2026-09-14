import { describe, expect, it } from "vitest";

import { validateOptionalCharge } from "./transfer-charge-validation";

describe("validateOptionalCharge — Phase V (0052) client-side mirror of validate_optional_charge_amount", () => {
  it("null amount + null category = no charge (valid)", () => {
    expect(validateOptionalCharge(null, null, "ค่าธรรมเนียม")).toBeNull();
  });

  it("both present = valid (positivity/format is checked separately by the zod schema)", () => {
    expect(validateOptionalCharge("5.00", "cat-1", "ค่าธรรมเนียม")).toBeNull();
  });

  it("amount without category is rejected", () => {
    expect(validateOptionalCharge("5.00", null, "ค่าธรรมเนียม")).toBe("กรุณาเลือกหมวดหมู่สำหรับค่าธรรมเนียม");
  });

  it("category without amount is rejected", () => {
    expect(validateOptionalCharge(null, "cat-1", "ดอกเบี้ย")).toBe("กรุณาระบุจำนวนเงินดอกเบี้ย");
  });
});
