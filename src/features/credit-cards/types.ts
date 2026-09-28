export type CreditCardMode = "PAYMENT" | "CASHBACK" | "CASH_ADVANCE";

export interface CreditCardAccountOption {
  accountId: string;
  walletId: string;
  pocketId: string;
  name: string;
  issuer: string | null;
  network: string | null;
  lastFour: string | null;
  scope: "PERSONAL" | "HOUSEHOLD";
  householdId: string | null;
  currency: string;
  creditLimit: string;
  walletBalance: string;
  liability: string;
  cardCredit: string;
  availableCredit: string;
  statementClosingDay: number;
  paymentDueDay: number;
  apr: string | null;
  archived: boolean;
}

export interface CreditCardEndpoint {
  walletId: string;
  walletName: string;
  pocketId: string;
  pocketName: string;
  currency: string;
  balance: string;
}

export interface CreditCardSheetData {
  cards: CreditCardAccountOption[];
  endpoints: CreditCardEndpoint[];
}
