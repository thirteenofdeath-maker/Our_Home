import { describe, expect, it } from "vitest";

import { appSectionForPath } from "./app-section";

describe("appSectionForPath", () => {
  it("classifies the wallet family as Finance and the remaining Finance-owned routes as Finance", () => {
    expect(appSectionForPath("/")).toBe("home");
    expect(appSectionForPath("/wallets")).toBe("finance");
    expect(appSectionForPath("/wallets/abc/manage")).toBe("finance");
    expect(appSectionForPath("/finance")).toBe("finance");
    expect(appSectionForPath("/finance/transactions/abc")).toBe("finance");
    expect(appSectionForPath("/categories")).toBe("finance");
  });

  it("classifies Pets/Calendar/Household by prefix, including deep routes", () => {
    expect(appSectionForPath("/pets")).toBe("pets");
    expect(appSectionForPath("/pets/abc")).toBe("pets");
    expect(appSectionForPath("/calendar")).toBe("calendar");
    expect(appSectionForPath("/calendar/abc")).toBe("calendar");
    expect(appSectionForPath("/household")).toBe("household");
    expect(appSectionForPath("/household/members")).toBe("household");
  });

  it("classifies Profile as neutral (no BottomNav tab, no Finance tone)", () => {
    expect(appSectionForPath("/profile/edit")).toBe("neutral");
  });

  it("classifies Onboarding distinctly from every other section", () => {
    expect(appSectionForPath("/onboarding")).toBe("onboarding");
  });

  it("falls back to neutral for anything unrecognized, never throwing", () => {
    expect(appSectionForPath("/something-unknown")).toBe("neutral");
  });

  it("never matches a route by substring — /walletsx is not /wallets", () => {
    expect(appSectionForPath("/walletsx")).toBe("neutral");
    expect(appSectionForPath("/petsx")).toBe("neutral");
  });
});
