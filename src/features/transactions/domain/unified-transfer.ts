export interface TransferEndpoint {
  walletId: string;
  walletName: string;
  pocketId: string;
  pocketName: string;
  currency: string;
  balance: string;
}

export function determineTransferKind(from: TransferEndpoint, to: TransferEndpoint): "POCKET" | "WALLET" {
  return from.walletId === to.walletId ? "POCKET" : "WALLET";
}

export function isValidTransferDestination(from: TransferEndpoint, to: TransferEndpoint): boolean {
  return from.pocketId !== to.pocketId && from.currency === to.currency;
}

export function reconcileTransferDestination(
  from: TransferEndpoint,
  currentDestination: TransferEndpoint | null,
  eligibleEndpoints: TransferEndpoint[],
): TransferEndpoint | null {
  if (!currentDestination) return null;
  const stillEligible = eligibleEndpoints.some(
    (endpoint) =>
      endpoint.pocketId === currentDestination.pocketId &&
      endpoint.walletId === currentDestination.walletId,
  );
  return stillEligible && isValidTransferDestination(from, currentDestination)
    ? currentDestination
    : null;
}

export function isValidTransferAmount(amount: string): boolean {
  if (!/^\d{1,12}(?:\.\d{1,2})?$/.test(amount.trim())) return false;
  return !/^0(?:\.0{1,2})?$/.test(amount.trim());
}
