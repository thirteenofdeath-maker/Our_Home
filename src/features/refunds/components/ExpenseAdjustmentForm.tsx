"use client";

import { useActionState, useMemo, useState } from "react";

import { Field, Input, Select } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import type { Pocket } from "@/features/pockets/types";
import { TagPicker } from "@/features/tags/components/TagPicker";
import type { TagOption } from "@/features/tags/types";
import type { Wallet } from "@/features/wallets/types";
import { initialActionState } from "@/lib/types/action-state";
import { formatCurrency } from "@/lib/utils/money";

import { createExpenseAdjustmentAction } from "../actions";
import type { RefundableSummary } from "../types";

const KIND_LABEL: Record<"REFUND" | "REIMBURSEMENT", string> = {
  REFUND: "คืนเงิน",
  REIMBURSEMENT: "เบิกคืน",
};

export function ExpenseAdjustmentForm({
  originalExpenseId,
  adjustmentKind,
  refundable,
  currency,
  wallets,
  pocketsByWallet,
  tags,
}: {
  originalExpenseId: string;
  adjustmentKind: "REFUND" | "REIMBURSEMENT";
  refundable: RefundableSummary;
  currency: string;
  wallets: Wallet[];
  pocketsByWallet: Record<string, Pocket[]>;
  tags: TagOption[];
}) {
  const [state, formAction] = useActionState(createExpenseAdjustmentAction, initialActionState);
  const [walletId, setWalletId] = useState(wallets[0]?.id ?? "");
  const pockets = useMemo(() => pocketsByWallet[walletId] ?? [], [pocketsByWallet, walletId]);
  const today = new Date().toLocaleDateString("en-CA");

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="originalExpenseId" value={originalExpenseId} />
      <input type="hidden" name="adjustmentKind" value={adjustmentKind} />

      <div className="rounded-card border border-border bg-surface-muted p-4 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-foreground-muted">ยอดเดิม</span>
          <span className="tabular-nums">{formatCurrency(refundable.originalAmount, currency)}</span>
        </div>
        <div className="mt-1 flex items-center justify-between">
          <span className="text-foreground-muted">คืน/เบิกแล้ว</span>
          <span className="tabular-nums">
            {formatCurrency((Number(refundable.activeRefundTotal) + Number(refundable.activeReimbursementTotal)).toFixed(2), currency)}
          </span>
        </div>
        <div className="mt-1 flex items-center justify-between font-medium">
          <span>คืนได้อีก</span>
          <span className="tabular-nums text-income">{formatCurrency(refundable.remainingAdjustableAmount, currency)}</span>
        </div>
      </div>

      <Field label="จำนวน" htmlFor="amount">
        <Input id="amount" name="amount" type="text" inputMode="decimal" placeholder="0.00" required autoFocus />
      </Field>

      <Field label="เข้ากระเป๋าเงิน" htmlFor="walletId">
        <Select id="walletId" name="walletId" required value={walletId} onChange={(e) => setWalletId(e.target.value)}>
          {wallets.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="ช่อง (Pocket)" htmlFor="pocketId">
        <Select key={walletId} id="pocketId" name="pocketId" required>
          {pockets.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="วันที่" htmlFor="occurredAt">
        <Input id="occurredAt" name="occurredAt" type="date" defaultValue={today} required />
      </Field>

      <Field label="ชื่อรายการ (ถ้ามี)" htmlFor="title">
        <Input id="title" name="title" type="text" />
      </Field>

      <Field label="โน้ต (ถ้ามี)" htmlFor="note">
        <Input id="note" name="note" type="text" />
      </Field>

      <Field label="แท็ก (ถ้ามี)" htmlFor="tagIds">
        <TagPicker name="tagIds" tags={tags} walletId={walletId} />
      </Field>

      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
      <SubmitButton size="lg" variant="primary">
        บันทึก{KIND_LABEL[adjustmentKind]}
      </SubmitButton>
    </form>
  );
}
