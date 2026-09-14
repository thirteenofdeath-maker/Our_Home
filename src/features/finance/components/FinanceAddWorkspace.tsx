"use client";

import { useState } from "react";

import { AppIcon, type AppIconName } from "@/components/ui/AppIcon";
import type { CategoryNode } from "@/features/categories/types";
import { CreditCardTransactionForm } from "@/features/credit-cards/components/CreditCardTransactionForm";
import type { CreditCardSheetData } from "@/features/credit-cards/types";
import { CreateInstallmentForm } from "@/features/installments/components/CreateInstallmentForm";
import type { Pocket } from "@/features/pockets/types";
import type { TagOption } from "@/features/tags/types";
import { TransactionForm } from "@/features/transactions/components/TransactionForm";
import type { TransactionWalletOption } from "@/features/transactions/components/TransactionWalletSelect";
import { UnifiedTransferForm } from "@/features/transactions/components/UnifiedTransferForm";
import type { TransferEndpoint } from "@/features/transactions/domain/unified-transfer";
import { FINANCE_RETURN_TO } from "@/features/finance/domain/finance";
import { cn } from "@/lib/utils/cn";

type EntryType = "expense" | "income" | "card" | "transfer" | "installment";
type TransactionData = {
  wallets: TransactionWalletOption[];
  pockets: Pocket[];
  categories: CategoryNode[];
  tags: TagOption[];
};
type TransferData = {
  initialWalletId: string;
  endpoints: TransferEndpoint[];
  tags: TagOption[];
};
type InstallmentData = {
  personal: CategoryNode[];
  household: CategoryNode[];
  hasHousehold: boolean;
};

const TABS: Array<{ value: EntryType; label: string; icon: AppIconName }> = [
  { value: "expense", label: "รายจ่าย", icon: "expense" },
  { value: "income", label: "รายรับ", icon: "income" },
  { value: "transfer", label: "โอนเงิน", icon: "transfer" },
  { value: "card", label: "บัตรเครดิต", icon: "wallet" },
  { value: "installment", label: "ผ่อนชำระ", icon: "calendar" },
];

export function FinanceAddWorkspace({
  walletId,
  expense,
  income,
  transfer,
  cardData,
  installment,
}: {
  walletId: string;
  expense: TransactionData;
  income: TransactionData;
  transfer: TransferData;
  cardData: CreditCardSheetData;
  installment: InstallmentData;
}) {
  const [entryType, setEntryType] = useState<EntryType>("expense");

  return (
    <div className="finance-add-workspace flex flex-col gap-3">
      <nav
        aria-label="ประเภทการเพิ่มรายการ"
        className="rounded-[1.25rem] bg-finance-surface-strong p-1.5 shadow-sm"
      >
        <div className="grid grid-cols-6 gap-1.5">
          {TABS.map((tab, index) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setEntryType(tab.value)}
              className={cn(
                "flex h-12 items-center justify-center gap-1.5 rounded-[0.9rem] px-2 text-[13px] font-medium transition-colors",
                index < 3 ? "col-span-2" : "col-span-3",
                entryType === tab.value
                  ? "bg-finance-primary-soft text-finance-primary-strong"
                  : "text-finance-muted",
              )}
            >
              <AppIcon name={tab.icon} className="size-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      <div className="rounded-[1.35rem] bg-finance-surface-strong p-3.5 shadow-card sm:p-4">
        {entryType === "expense" ? (
          <EntryIntro
            title="เพิ่มรายจ่าย"
            detail="เงินออกจากกระเป๋าที่เลือก"
            tone="expense"
          />
        ) : null}
        {entryType === "income" ? (
          <EntryIntro
            title="เพิ่มรายรับ"
            detail="เงินเข้ากระเป๋าที่เลือก"
            tone="income"
          />
        ) : null}
        {entryType === "transfer" ? (
          <EntryIntro
            title="โอนเงิน"
            detail="ย้ายเงินระหว่างกระเป๋าหรือช่องเงิน"
            tone="transfer"
          />
        ) : null}
        {entryType === "installment" ? (
          <EntryIntro
            title="สร้างแผนผ่อนชำระ"
            detail="กำหนดยอดรวม จำนวนงวด และวันเริ่มต้น"
            tone="warning"
          />
        ) : null}

        {entryType === "expense" ? (
          <TransactionForm
            walletId={walletId}
            wallets={expense.wallets}
            transactionType="EXPENSE"
            pockets={expense.pockets}
            categories={expense.categories}
            tags={expense.tags}
            returnTo={FINANCE_RETURN_TO}
            variant="sheet"
          />
        ) : null}
        {entryType === "income" ? (
          <TransactionForm
            walletId={walletId}
            wallets={income.wallets}
            transactionType="INCOME"
            pockets={income.pockets}
            categories={income.categories}
            tags={income.tags}
            returnTo={FINANCE_RETURN_TO}
            variant="sheet"
          />
        ) : null}
        {entryType === "transfer" ? (
          <UnifiedTransferForm {...transfer} />
        ) : null}
        {entryType === "installment" ? (
          <CreateInstallmentForm
            personal={installment.personal}
            household={installment.household}
            hasHousehold={installment.hasHousehold}
            variant="sheet"
          />
        ) : null}

        {entryType === "card" ? (
          <CreditCardTransactionForm {...cardData} />
        ) : null}
      </div>
    </div>
  );
}

function EntryIntro({
  title,
  detail,
  tone,
}: {
  title: string;
  detail: string;
  tone: "income" | "expense" | "transfer" | "warning";
}) {
  const color =
    tone === "income"
      ? "bg-finance-income/15 text-finance-income"
      : tone === "expense"
        ? "bg-finance-expense/15 text-finance-expense"
        : tone === "warning"
          ? "bg-finance-warning/15 text-finance-warning"
          : "bg-finance-transfer/15 text-finance-transfer";
  const icon: AppIconName =
    tone === "income"
      ? "income"
      : tone === "expense"
        ? "expense"
        : tone === "warning"
          ? "calendar"
          : "transfer";
  return (
    <div className="mb-4 flex items-center gap-2.5">
      <span
        className={`flex size-10 items-center justify-center rounded-full ${color}`}
      >
        <AppIcon name={icon} className="size-5" />
      </span>
      <div>
        <h2 className="text-base font-semibold text-finance-text">{title}</h2>
        <p className="text-xs text-finance-muted">{detail}</p>
      </div>
    </div>
  );
}
