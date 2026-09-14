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

export type CreditCardEventKind = "PURCHASE" | "PURCHASE_REFUND" | "INTEREST_CHARGE" | "FEE_CHARGE" | "LATE_FEE_CHARGE" | "PAYMENT_PRINCIPAL" | "PAYMENT_INTEREST" | "PAYMENT_FEE" | "PAYMENT_LATE_FEE" | "CASHBACK" | "CASH_ADVANCE" | "BALANCE_ADJUSTMENT";

export type CreditCardOutstandingComponents = {
  principal: string;
  interest: string;
  fee: string;
  lateFee: string;
  unallocatedCredit: string;
  total: string;
};

export type CreditCardActivityItem = {
  eventId: string;
  eventKinds: CreditCardEventKind[];
  amount: string;
  transactionId: string;
  occurredAt: string;
  title: string | null;
  categoryName: string | null;
  isVoided: boolean;
};

export type CreditCardStatementStatus = "OPEN" | "PARTIALLY_PAID" | "PAID" | "OVERDUE";
export type CreditCardStatement = {
  statementId:string; periodStart:string; periodEnd:string; dueDate:string;
  statementBalance:string; minimumAmountDue:string; paidToDate:string; creditsToDate:string;
  effectiveAmountDue:string; status:CreditCardStatementStatus; minimumPaymentMet:boolean;
};
