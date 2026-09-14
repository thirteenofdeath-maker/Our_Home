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

export type CreditCardActivityItem = {
  eventId: string;
  eventKind: "PURCHASE" | "PURCHASE_REFUND" | "INTEREST_CHARGE" | "FEE_CHARGE" | "LATE_FEE_CHARGE" | "PAYMENT_PRINCIPAL" | "PAYMENT_INTEREST" | "PAYMENT_FEE" | "PAYMENT_LATE_FEE" | "CASHBACK" | "CASH_ADVANCE" | "BALANCE_ADJUSTMENT";
  amount: string;
  transactionId: string;
  occurredAt: string;
  title: string | null;
  categoryName: string | null;
  isVoided: boolean;
};
