"use client";

import { useState, useTransition } from "react";

import { AppIcon } from "@/components/ui/AppIcon";
import { TransactionForm } from "@/features/transactions/components/TransactionForm";
import { UnifiedTransferForm } from "@/features/transactions/components/UnifiedTransferForm";
import { FINANCE_RETURN_TO } from "@/features/finance/domain/finance";
import { cn } from "@/lib/utils/cn";

import { getIncomeExpenseSheetData, getUnifiedTransferSheetData } from "../quick-add-data";

type Stage = "expense" | "income" | "transfer";
type IncomeExpenseData = Awaited<ReturnType<typeof getIncomeExpenseSheetData>>;
type TransferData = Awaited<ReturnType<typeof getUnifiedTransferSheetData>>;

export function FinanceCreatePageFlow({ walletId, initialData }: { walletId: string; initialData: IncomeExpenseData }) {
  const [stage, setStage] = useState<Stage>("expense");
  const [incomeExpenseData, setIncomeExpenseData] = useState<IncomeExpenseData>(initialData);
  const [transferData, setTransferData] = useState<TransferData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function selectStage(next: Stage) {
    if (next === stage) return;
    setError(null);
    startTransition(async () => {
      try {
        if (next === "transfer") {
          setTransferData(await getUnifiedTransferSheetData(walletId));
        } else {
          setIncomeExpenseData(await getIncomeExpenseSheetData(walletId, next === "income" ? "INCOME" : "EXPENSE"));
        }
        setStage(next);
      } catch {
        setError("โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่");
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 rounded-[1.35rem] border border-white/80 bg-finance-surface-strong p-1.5 shadow-card" role="tablist" aria-label="ประเภทของรายการ">
        <StageTab active={stage === "expense"} label="รายจ่าย" icon="expense" onClick={() => selectStage("expense")} disabled={pending} />
        <StageTab active={stage === "income"} label="รายรับ" icon="income" onClick={() => selectStage("income")} disabled={pending} />
        <StageTab active={stage === "transfer"} label="โอนเงิน" icon="transfer" onClick={() => selectStage("transfer")} disabled={pending} />
      </div>

      {pending ? <p className="rounded-[1.25rem] bg-finance-primary-soft p-4 text-sm text-finance-muted">กำลังเตรียมฟอร์ม...</p> : null}
      {error ? <p role="alert" className="rounded-[1.25rem] bg-danger/10 p-4 text-sm text-danger">{error}</p> : null}

      {!pending && stage !== "transfer" ? (
        <TransactionForm
          key={stage}
          walletId={walletId}
          wallets={incomeExpenseData.wallets}
          transactionType={stage === "income" ? "INCOME" : "EXPENSE"}
          pockets={incomeExpenseData.pockets}
          categories={incomeExpenseData.categories}
          tags={incomeExpenseData.tags}
          returnTo={FINANCE_RETURN_TO}
          householdExpenseContext={stage === "expense" ? incomeExpenseData.householdExpenseContext : undefined}
        />
      ) : null}
      {!pending && stage === "transfer" && transferData ? <UnifiedTransferForm key="transfer" {...transferData} /> : null}
    </div>
  );
}

function StageTab({ active, label, icon, onClick, disabled }: { active: boolean; label: string; icon: "expense" | "income" | "transfer"; onClick: () => void; disabled: boolean }) {
  return (
    <button type="button" role="tab" aria-selected={active} disabled={disabled} onClick={onClick} className={cn("flex min-h-14 items-center justify-center gap-1.5 rounded-[1rem] text-sm font-semibold transition-colors", active ? "bg-finance-primary-soft text-finance-primary-strong" : "text-finance-muted")}>
      <AppIcon name={icon} className="size-5" />{label}
    </button>
  );
}
