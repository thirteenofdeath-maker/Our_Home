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

export type CreditCardStatementStatus = "OPEN" | "PARTIALLY_PAID" | "PAID" | "OVERDUE" | "RESOLVED";
export type CreditCardStatement = {
  statementId:string; periodStart:string; periodEnd:string; dueDate:string;
  statementBalance:string; minimumAmountDue:string; paidToDate:string; creditsToDate:string;
  effectiveAmountDue:string; status:CreditCardStatementStatus; minimumPaymentMet:boolean;resolutionReason:string|null;resolvedAt:string|null;
};
export type CreditCardDueItem={source:"CARD_STATEMENT"|"CARD_INSTALLMENT";sourceId:string;cardAccountId:string;planId:string|null;title:string;dueDate:string;amount:string;currency:string;scope:MoneyScope;status:"OVERDUE"|"DUE"|"UPCOMING"};
