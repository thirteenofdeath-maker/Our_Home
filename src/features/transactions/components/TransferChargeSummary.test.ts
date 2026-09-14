import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { TransferChargeSummary } from "./TransferChargeSummary";

describe("TransferChargeSummary (Phase V / 0052)", () => {
  it("shows transfer/fee/interest/total-from-source/received-at-destination for the worked example (2000 + 25 + 10)", () => {
    const html = renderToStaticMarkup(createElement(TransferChargeSummary, { amount: "2000", feeAmount: "25", interestAmount: "10", currency: "THB" }));
    expect(html).toContain("฿2,000.00"); // principal / destination receives
    expect(html).toContain("฿25.00"); // fee
    expect(html).toContain("฿10.00"); // interest
    expect(html).toContain("฿2,035.00"); // total deducted from source
    expect(html).toContain("เงินต้นไม่ใช่รายรับหรือรายจ่าย");
  });

  it("omits the fee/interest lines entirely when both are zero/empty", () => {
    const html = renderToStaticMarkup(createElement(TransferChargeSummary, { amount: "2000", feeAmount: "", interestAmount: "", currency: "THB" }));
    expect(html).not.toContain("ค่าธรรมเนียม (รายจ่าย)");
    expect(html).not.toContain("ดอกเบี้ย (รายจ่าย)");
  });
});
