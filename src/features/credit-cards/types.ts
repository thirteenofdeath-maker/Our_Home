import type { MoneyScope } from "@/types/database";

export type CreditCardAccount = {
  accountId: string;
  walletId: string;
  systemPocketId: string;
  name: string;
  issuer: string | null;
  network: string | null;
  lastFour: string | null;
  scope: MoneyScope;
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
  isArchived: boolean;
};
