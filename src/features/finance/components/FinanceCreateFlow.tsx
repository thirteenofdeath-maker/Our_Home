"use client";

import { useState } from "react";

import { AppIcon, type AppIconName } from "@/components/ui/AppIcon";
import { BottomSheet, CLOSE_TRANSITION_MS } from "@/components/ui/BottomSheet";
import type { CategoryNode } from "@/features/categories/types";
import { CreditCardTransactionForm } from "@/features/credit-cards/components/CreditCardTransactionForm";
import type { CreditCardSheetData } from "@/features/credit-cards/types";
import type { Pocket } from "@/features/pockets/types";
import type { TagOption } from "@/features/tags/types";
import { CreateInstallmentForm } from "@/features/installments/components/CreateInstallmentForm";
import { getInstallmentSheetData } from "@/features/installments/quick-add-data";
import { TransactionForm } from "@/features/transactions/components/TransactionForm";
import { UnifiedTransferForm } from "@/features/transactions/components/UnifiedTransferForm";
import type { TransferEndpoint } from "@/features/transactions/domain/unified-transfer";
import type { TransactionWalletOption } from "@/features/transactions/components/TransactionWalletSelect";
import { FINANCE_RETURN_TO } from "@/features/finance/domain/finance";
import { cn } from "@/lib/utils/cn";

import {
  getCreditCardSheetData,
  getIncomeExpenseSheetData,
  getUnifiedTransferSheetData,
} from "../quick-add-data";

type Stage =
  | "closed"
  | "choosing"
  | "income"
  | "expense"
  | "transfer"
  | "card"
  | "installment";

interface IncomeExpenseData {
  wallets: TransactionWalletOption[];
  pockets: Pocket[];
  endpoints: TransferEndpoint[];
  categories: CategoryNode[];
  tags: TagOption[];
}
interface UnifiedTransferData {
  initialWalletId: string;
  endpoints: TransferEndpoint[];
  tags: TagOption[];
}
interface InstallmentData {
  personal: CategoryNode[];
  household: CategoryNode[];
  hasHousehold: boolean;
}

/**
 * The authoritative Finance quick-add UX: tap + → a compact CHOICE sheet
 * slides up (รายรับ/รายจ่าย/โอนเงิน) → picking one slides the choice
 * sheet away and slides the real FORM up as the next stage, in the SAME
 * sheet position — never a full-page redirect for entry, never a second
 * confirmation sheet after Save.
 *
 * One BottomSheet element is reused for every stage (never a second,
 * parallel modal/motion implementation) — advancing a stage closes it
 * (playing BottomSheet's own exit motion), waits the exact same
 * `CLOSE_TRANSITION_MS` BottomSheet itself already defines for this
 * (imported, never redeclared), then swaps content and reopens it.
 *
 * Income/Expense reuse TransactionForm. Transfer uses a unified client
 * orchestrator which dispatches to the existing pocket/wallet writers.
 */
export function FinanceCreateFlow({ walletId }: { walletId: string }) {
  const [stage, setStage] = useState<Stage>("closed");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [ieData, setIeData] = useState<IncomeExpenseData | null>(null);
  const [transferData, setTransferData] = useState<UnifiedTransferData | null>(
    null,
  );
  const [installmentData, setInstallmentData] =
    useState<InstallmentData | null>(null);
  const [cardData, setCardData] = useState<CreditCardSheetData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  function transitionTo(next: () => void) {
    setSheetOpen(false);
    setTimeout(next, CLOSE_TRANSITION_MS);
  }

  function openChoice() {
    setLoadError(null);
    setStage("choosing");
    setSheetOpen(true);
  }

  function closeFlow() {
    transitionTo(() => setStage("closed"));
  }

  function goBack() {
    transitionTo(() => {
      setLoadError(null);
      setStage("choosing");
      setSheetOpen(true);
    });
  }

  function selectIncomeExpense(type: "INCOME" | "EXPENSE") {
    transitionTo(async () => {
      try {
        const data = await getIncomeExpenseSheetData(walletId, type);
        setIeData(data);
        setStage(type === "INCOME" ? "income" : "expense");
        setSheetOpen(true);
      } catch {
        setLoadError("โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่");
        setStage("choosing");
        setSheetOpen(true);
      }
    });
  }

  function selectTransfer() {
    transitionTo(async () => {
      try {
        const data = await getUnifiedTransferSheetData(walletId);
        setTransferData(data);
        setStage("transfer");
        setSheetOpen(true);
      } catch {
        setLoadError("โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่");
        setStage("choosing");
        setSheetOpen(true);
      }
    });
  }

  function selectCard() {
    transitionTo(async () => {
      try {
        setCardData(await getCreditCardSheetData(walletId));
        setStage("card");
        setSheetOpen(true);
      } catch {
        setLoadError("โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่");
        setStage("choosing");
        setSheetOpen(true);
      }
    });
  }

  function selectInstallment() {
    transitionTo(async () => {
      try {
        setInstallmentData(await getInstallmentSheetData());
        setStage("installment");
        setSheetOpen(true);
      } catch {
        setLoadError("โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่");
        setStage("choosing");
        setSheetOpen(true);
      }
    });
  }

  const title =
    stage === "income"
      ? "รายรับ"
      : stage === "expense"
        ? "รายจ่าย"
        : stage === "transfer"
          ? "โอนเงิน"
          : stage === "card"
            ? "บัตรเครดิต"
            : stage === "installment"
              ? "ผ่อนชำระ"
              : "เพิ่มรายการ";

  const showBack = !["closed", "choosing"].includes(stage);

  return (
    <div className="finance-scope contents">
      <button
        type="button"
        aria-label="เพิ่มรายการการเงิน"
        onClick={openChoice}
        className="fixed z-20 flex size-14 items-center justify-center rounded-full bg-finance-primary text-white shadow-[0_8px_24px_rgb(79_112_88_/_0.3)] transition-transform active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-finance-primary right-[max(1.25rem,env(safe-area-inset-right))] bottom-[calc(env(safe-area-inset-bottom)+5.5rem)]"
      >
        <AppIcon name="plus" />
      </button>

      <BottomSheet
        open={sheetOpen}
        onClose={showBack ? goBack : closeFlow}
        title={title}
        size={stage === "choosing" ? "content" : "large"}
        tone="finance"
        closeLabel="ย้อนกลับ"
      >
        <>
          {loadError ? (
            <p className="mb-2 text-sm text-finance-expense">{loadError}</p>
          ) : null}

          {stage === "choosing" ? (
            <div className="flex flex-col gap-1">
              <p className="mb-1 text-sm text-finance-muted">
                เลือกประเภทที่ต้องการ
              </p>
              <ChoiceRow
                icon="income"
                label="รายรับ"
                description="เงินเข้ากระเป๋า"
                accent="income"
                onClick={() => selectIncomeExpense("INCOME")}
              />
              <ChoiceRow
                icon="expense"
                label="รายจ่าย"
                description="บันทึกค่าใช้จ่าย"
                accent="expense"
                onClick={() => selectIncomeExpense("EXPENSE")}
              />
              <ChoiceRow
                icon="transfer"
                label="โอนเงิน"
                description="ย้ายเงินระหว่างกระเป๋า"
                accent="transfer"
                onClick={selectTransfer}
              />
              <ChoiceRow
                icon="wallet"
                label="บัตรเครดิต"
                description="ดูและจัดการบัตรใน Wallet"
                accent="card"
                onClick={selectCard}
              />
              <ChoiceRow
                icon="calendar"
                label="ผ่อนชำระ"
                description="สร้างแผนผ่อนชำระใหม่"
                accent="installment"
                onClick={selectInstallment}
              />
            </div>
          ) : null}

          {(stage === "income" || stage === "expense") && ieData ? (
            <TransactionForm
              walletId={walletId}
              wallets={ieData.wallets}
              transactionType={stage === "income" ? "INCOME" : "EXPENSE"}
              pockets={ieData.pockets}
              endpoints={ieData.endpoints}
              categories={ieData.categories}
              tags={ieData.tags}
              returnTo={FINANCE_RETURN_TO}
              variant="sheet"
            />
          ) : null}

          {stage === "transfer" && transferData ? (
            <UnifiedTransferForm {...transferData} />
          ) : null}

          {stage === "card" && cardData ? (
            <CreditCardTransactionForm {...cardData} />
          ) : null}

          {stage === "installment" && installmentData ? (
            <CreateInstallmentForm {...installmentData} variant="sheet" />
          ) : null}
        </>
      </BottomSheet>
    </div>
  );
}

function ChoiceRow({
  icon,
  label,
  description,
  accent,
  onClick,
}: {
  icon: AppIconName;
  label: string;
  description: string;
  accent: "income" | "expense" | "transfer" | "card" | "installment";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-14 w-full items-center gap-3 rounded-2xl px-2 py-2 text-left transition-colors hover:bg-finance-primary-soft active:bg-finance-primary-soft"
    >
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-full",
          accent === "income"
            ? "bg-finance-income/15 text-finance-income"
            : accent === "expense"
              ? "bg-finance-expense/15 text-finance-expense"
              : accent === "installment"
                ? "bg-finance-warning/15 text-finance-warning"
                : "bg-finance-transfer/15 text-finance-transfer",
        )}
      >
        <AppIcon name={icon} />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="truncate font-medium text-finance-text">{label}</span>
        <span className="truncate text-xs text-finance-muted">
          {description}
        </span>
      </span>
    </button>
  );
}
