import Link from "next/link";
import { notFound } from "next/navigation";

import { ActionButton } from "@/components/ui/ActionButton";
import { buttonClassName } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { getAdjustmentOrigin, getRefundableSummary, listAdjustmentsForOriginal } from "@/features/refunds/api";
import { restoreTransactionAction } from "@/features/transactions/actions";
import { getTransactionDetail } from "@/features/transactions/api";
import { VoidTransactionForm } from "@/features/transactions/components/VoidTransactionForm";
import { CreateTemplateTrigger } from "@/features/templates/components/CreateTemplateTrigger";
import { listTagsForTransaction } from "@/features/tags/api";
import { requireUser } from "@/lib/auth/require-user";
import { formatCurrency } from "@/lib/utils/money";
import { listTransactionAttachments } from "@/features/attachments/api";
import { AttachmentForm } from "@/features/attachments/AttachmentForm";

const TYPE_LABEL: Record<string, string> = {
  INCOME: "รายรับ",
  EXPENSE: "รายจ่าย",
  TRANSFER: "โอนเงิน",
};

const ADJUSTMENT_LABEL: Record<"REFUND" | "REIMBURSEMENT", string> = {
  REFUND: "คืนเงิน",
  REIMBURSEMENT: "เบิกคืน",
};

export default async function TransactionDetailPage({
  params,
}: {
  params: Promise<{ transactionId: string }>;
}) {
  const { transactionId } = await params;
  const { supabase } = await requireUser();

  const transaction = await getTransactionDetail(supabase, transactionId);
  if (!transaction) notFound();

  const [tags, adjustmentOrigin, attachments] = await Promise.all([
    listTagsForTransaction(supabase, transactionId),
    getAdjustmentOrigin(supabase, transactionId),
    listTransactionAttachments(supabase, transactionId),
  ]);

  const isTransfer = transaction.transactionType === "TRANSFER";
  const isVoided = transaction.voidedAt !== null;
  const occurredDate = new Date(transaction.occurredAt).toLocaleDateString("th-TH", { dateStyle: "long" });

  // Only a genuine, still-active, non-adjustment EXPENSE can itself be
  // refunded/reimbursed — a refund is immutable and can never be a new
  // "original" (0033: create_expense_adjustment_transaction rejects it).
  const isOriginalExpense = transaction.transactionType === "EXPENSE" && !adjustmentOrigin;
  const [refundable, adjustments] = isOriginalExpense
    ? await Promise.all([getRefundableSummary(supabase, transactionId), listAdjustmentsForOriginal(supabase, transactionId)])
    : [null, []];
  const hasActiveAdjustments = adjustments.some((a) => !a.voidedAt);

  // Every action below is a real, pre-existing route/flow, gated by the
  // exact same conditions the previous consolidated sheet used — never a
  // route invented here, never an action shown when its underlying rule
  // would reject it. None of these are Create/Add (edit/refund/
  // reimbursement), so they're direct, always-visible links — no bottom
  // slide-up menu. "สร้าง Template จากรายการนี้" IS a Create action, so
  // it alone opens the real create-form sheet (CreateTemplateTrigger).
  const canEdit = !adjustmentOrigin;
  const canAdjust = isOriginalExpense && refundable && Number(refundable.remainingAdjustableAmount) > 0;

  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="text-sm text-foreground-muted">
          {adjustmentOrigin ? ADJUSTMENT_LABEL[adjustmentOrigin.kind] : TYPE_LABEL[transaction.transactionType]}
        </p>
        <h1 className="text-xl font-semibold">
          {transaction.pocketTransfer
            ? `${transaction.pocketTransfer.fromPocketName} → ${transaction.pocketTransfer.toPocketName}`
            : transaction.walletTransfer
              ? `${transaction.walletTransfer.fromWalletName} → ${transaction.walletTransfer.toWalletName}`
              : transaction.title || transaction.categoryName || TYPE_LABEL[transaction.transactionType]}
        </h1>
        {adjustmentOrigin ? (
          <p className="mt-1 text-sm text-foreground-muted">
            จากรายการ: {adjustmentOrigin.originalTitle || adjustmentOrigin.originalCategoryName || "รายจ่าย"}
          </p>
        ) : null}
      </header>

      {isVoided ? (
        <Card className="border-danger bg-danger/10">
          <p className="font-medium text-danger">รายการถูกยกเลิก</p>
          {transaction.voidReason ? <p className="mt-1 text-sm text-foreground-muted">เหตุผล: {transaction.voidReason}</p> : null}
          {transaction.voidedByName ? (
            <p className="mt-1 text-xs text-foreground-muted">ยกเลิกโดย {transaction.voidedByName}</p>
          ) : null}
        </Card>
      ) : null}

      <Card className="flex flex-col gap-3">
        {transaction.pocketTransfer ? (
          <>
            <Row label="จำนวนเงิน" value={formatCurrency(transaction.pocketTransfer.amount, "THB")} />
            <Row label="จาก" value={transaction.pocketTransfer.fromPocketName} />
            <Row label="ไปยัง" value={transaction.pocketTransfer.toPocketName} />
          </>
        ) : transaction.walletTransfer ? (
          <>
            <Row label="จำนวนเงิน" value={formatCurrency(transaction.walletTransfer.amount, transaction.walletTransfer.currency)} />
            <Row label="จาก" value={`${transaction.walletTransfer.fromWalletName} / ${transaction.walletTransfer.fromPocketName}`} />
            <Row label="ไปยัง" value={`${transaction.walletTransfer.toWalletName} / ${transaction.walletTransfer.toPocketName}`} />
          </>
        ) : (
          <>
            <Row
              label="จำนวนเงิน"
              value={formatCurrency(transaction.amount ?? "0.00", transaction.currency ?? "THB")}
              valueClassName={adjustmentOrigin ? "text-income" : transaction.transactionType === "EXPENSE" ? "text-expense" : "text-income"}
            />
            <Row label="กระเป๋าเงิน" value={transaction.walletName ?? "?"} />
            <Row label="ช่อง (Pocket)" value={transaction.pocketName ?? "?"} />
            {!adjustmentOrigin ? <Row label="หมวดหมู่" value={transaction.categoryName ?? "-"} /> : null}
          </>
        )}
        <Row label="ชื่อรายการ" value={transaction.title || "-"} />
        <Row label="โน้ต" value={transaction.note || "-"} />
        <Row label="วันที่" value={occurredDate} />
        <Row label="สถานะ" value={isVoided ? "ยกเลิกแล้ว" : "ปกติ"} />
      </Card>

      {tags.length > 0 ? (
        <Card className="flex flex-col gap-2">
          <p className="text-sm text-foreground-muted">แท็ก</p>
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <span key={tag.id} className="rounded-full bg-surface-muted px-3 py-1 text-sm">
                #{tag.name}
              </span>
            ))}
          </div>
        </Card>
      ) : null}

      <Card className="flex flex-col gap-3"><h2 className="font-semibold">หลักฐาน</h2>{attachments.map(file=><a key={file.id} href={file.url} target="_blank" rel="noreferrer" className="text-primary">{file.fileName}</a>)}<AttachmentForm transactionId={transactionId}/></Card>

      {isOriginalExpense && refundable ? (
        <Card className="flex flex-col gap-3">
          <p className="text-sm font-medium text-foreground-muted">รายการเดิม</p>
          <Row label={transaction.title || transaction.categoryName || "สินค้า"} value={formatCurrency(refundable.originalAmount, transaction.currency ?? "THB")} />
          {adjustments.length > 0 ? (
            <>
              <p className="mt-2 text-sm font-medium text-foreground-muted">คืนแล้ว</p>
              {adjustments.map((a) => (
                <Row
                  key={a.transactionId}
                  label={`${ADJUSTMENT_LABEL[a.kind]}${a.voidedAt ? " (ยกเลิกแล้ว)" : ""}`}
                  value={formatCurrency(a.amount, transaction.currency ?? "THB")}
                  valueClassName={a.voidedAt ? "text-foreground-muted line-through" : "text-income"}
                />
              ))}
            </>
          ) : null}
          <div className="mt-2 border-t border-border pt-2">
            <Row
              label="คืน/เบิกคืนรวม"
              value={formatCurrency(
                (Number(refundable.activeRefundTotal) + Number(refundable.activeReimbursementTotal)).toFixed(2),
                transaction.currency ?? "THB",
              )}
            />
            <Row label="เหลือคืนได้" value={formatCurrency(refundable.remainingAdjustableAmount, transaction.currency ?? "THB")} />
          </div>
          {/* คืนเงิน/เบิกคืน are direct action links below, not a separate
              grid here — this card stays purely informational. */}
        </Card>
      ) : null}

      {!isTransfer ? (
        <section className="flex flex-col gap-3">
          {!isVoided ? (
            <>
              {/* Direct, always-visible action links — no collapsing
                  "จัดการรายการ" bottom sheet. Edit/refund/reimbursement
                  are ordinary navigation (never Create/Add), gated by the
                  EXACT same conditions the previous consolidated sheet
                  used (never expose an invalid action: no edit for an
                  adjustment transaction, no refund/reimbursement once
                  nothing remains adjustable). "สร้าง Template จากรายการนี้"
                  IS a Create action, so it alone opens the real
                  create-form sheet. Void is NOT here — it stays its own
                  visually-danger, centered ConfirmDialog below, never
                  mixed into this list and never using the bottom-sheet
                  slide motion. */}
              <div className="flex flex-col gap-2">
                {canEdit ? (
                  <Link href={`/finance/transactions/${transaction.transactionId}/edit`} className={buttonClassName("secondary", "lg")}>
                    แก้ไข
                  </Link>
                ) : null}
                {canAdjust ? (
                  <>
                    <Link href={`/finance/transactions/${transaction.transactionId}/refund`} className={buttonClassName("secondary", "lg")}>
                      คืนเงิน
                    </Link>
                    <Link href={`/finance/transactions/${transaction.transactionId}/reimbursement`} className={buttonClassName("secondary", "lg")}>
                      เบิกคืน
                    </Link>
                  </>
                ) : null}
                <CreateTemplateTrigger fromTransactionId={transaction.transactionId} triggerClassName={buttonClassName("secondary", "lg")}>
                  สร้าง Template จากรายการนี้
                </CreateTemplateTrigger>
              </div>
              {isOriginalExpense && hasActiveAdjustments ? (
                <p className="text-center text-xs text-foreground-muted">
                  ยกเลิกรายการนี้ไม่ได้ เนื่องจากมีรายการคืนเงิน/เบิกคืนที่ยังใช้งานอยู่
                </p>
              ) : (
                <VoidTransactionForm transactionId={transaction.transactionId} walletId={transaction.walletId ?? ""} />
              )}
            </>
          ) : (
            <ActionButton
              action={restoreTransactionAction}
              hiddenFields={{ transactionId: transaction.transactionId, walletId: transaction.walletId ?? "" }}
              label="กู้คืนรายการ"
              variant="primary"
              className="w-full"
            />
          )}
        </section>
      ) : (
        <p className="text-center text-xs text-foreground-muted">รายการโอนเงินยังไม่สามารถแก้ไขหรือยกเลิกได้ในเวอร์ชันนี้</p>
      )}
    </div>
  );
}

function Row({ label, value, valueClassName }: { label: string; value: string; valueClassName?: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-foreground-muted">{label}</span>
      <span className={`text-right text-sm font-medium tabular-nums ${valueClassName ?? ""}`}>{value}</span>
    </div>
  );
}
