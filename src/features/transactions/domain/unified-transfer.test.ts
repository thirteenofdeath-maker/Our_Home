import { describe, expect, it } from "vitest";

import { determineTransferKind, isValidTransferAmount, isValidTransferDestination, reconcileTransferDestination, type TransferEndpoint } from "./unified-transfer";

const endpoint = (walletId: string, pocketId: string, currency = "THB"): TransferEndpoint => ({
  walletId, pocketId, currency, walletName: walletId, pocketName: pocketId, balance: "100.00",
});

describe("unified transfer endpoint rules", () => {
  it("uses the pocket writer for two pockets in one wallet", () => {
    expect(determineTransferKind(endpoint("w1", "p1"), endpoint("w1", "p2"))).toBe("POCKET");
  });

  it("uses the wallet writer for pockets in different wallets", () => {
    expect(determineTransferKind(endpoint("w1", "p1"), endpoint("w2", "p2"))).toBe("WALLET");
  });

  it("blocks the same pocket and cross-currency destinations", () => {
    const from = endpoint("w1", "p1");
    expect(isValidTransferDestination(from, endpoint("w1", "p1"))).toBe(false);
    expect(isValidTransferDestination(from, endpoint("w2", "p2", "USD"))).toBe(false);
  });

  it("preserves an explicitly selected destination while it remains valid", () => {
    const destination = endpoint("w2", "p2");
    expect(reconcileTransferDestination(endpoint("w1", "p1"), destination, [destination])).toBe(destination);
  });

  it("clears a destination that becomes the same pocket and never falls back", () => {
    const destination = endpoint("w1", "p2");
    expect(reconcileTransferDestination(destination, destination, [endpoint("w1", "p1"), destination])).toBeNull();
  });

  it("clears a destination after a source currency change and never falls back", () => {
    const destination = endpoint("w2", "p2", "THB");
    expect(reconcileTransferDestination(endpoint("w3", "p3", "USD"), destination, [destination, endpoint("w4", "p4", "USD")])).toBeNull();
  });

  it("clears a destination that is no longer present in the eligible endpoint set", () => {
    expect(reconcileTransferDestination(endpoint("w1", "p1"), endpoint("w2", "p2"), [endpoint("w3", "p3")])).toBeNull();
  });

  it("validates positive decimal-string amounts without floating point", () => {
    expect(isValidTransferAmount("0")).toBe(false);
    expect(isValidTransferAmount("0.00")).toBe(false);
    expect(isValidTransferAmount("12.34")).toBe(true);
    expect(isValidTransferAmount("12.345")).toBe(false);
  });
});
