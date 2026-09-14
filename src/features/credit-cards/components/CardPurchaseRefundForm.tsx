"use client";

import { useActionState } from "react";

import { Field, Input } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { TagPicker } from "@/features/tags/components/TagPicker";
import type { TagOption } from "@/features/tags/types";
import type { RefundableSummary } from "@/features/refunds/types";
import { initialActionState } from "@/lib/types/action-state";
import { formatCurrency } from "@/lib/utils/money";

import { createCardPurchaseRefundAction } from "../actions";

export function CardPurchaseRefundForm({
  transactionId,
  walletId,
  refundable,
  currency,
  tags,
}: {
  transactionId: string;
  walletId: string;
  refundable: RefundableSummary;
  currency: string;
  tags: TagOption[] | null;
}) {
  const [state, action] = useActionState(createCardPurchaseRefundAction, initialActionState);
  const today = new Date().toLocaleDateString("en-CA");
  return (
    <form action={action} className="flex flex-col gap-4 rounded-card bg-finance-surface-strong p-4 shadow-card">
      <input type="hidden" name="originalPurchaseTransactionId" value={transactionId} />
      <div className="rounded-control bg-finance-primary-soft p-3 text-sm">
        <div className="flex justify-between gap-3"><span>ยอดเดิม</span><span>{formatCurrency(refundable.originalAmount, currency)}</span></div>
        <div className="mt-1 flex justify-between gap-3 font-medium"><span>คืนได้อีก</span><span>{formatCurrency(refundable.remainingAdjustableAmount, currency)}</span></div>
        <p className="mt-2 text-xs text-finance-muted">เงินคืนจะกลับเข้าบัตรเดิมและลดยอดหนี้ ไม่ใช่รายรับ</p>
      </div>
      <Field label="จำนวนเงินคืน" htmlFor="amount">
        <Input id="amount" name="amount" inputMode="decimal" placeholder="0.00" required autoFocus />
      </Field>
      <Field label="วันที่คืนเงิน" htmlFor="occurredAt">
        <Input id="occurredAt" name="occurredAt" type="date" defaultValue={today} required />
      </Field>
      <Field label="ชื่อรายการ" htmlFor="title"><Input id="title" name="title" /></Field>
      <Field label="โน้ต" htmlFor="note"><Input id="note" name="note" /></Field>
      {tags ? <Field label="แท็ก" htmlFor="tagIds"><TagPicker name="tagIds" tags={tags} walletId={walletId} /></Field> : null}
      {state.error ? <p role="alert" className="text-sm text-danger">{state.error}</p> : null}
      <SubmitButton size="lg">บันทึกคืนเงินเข้าบัตร</SubmitButton>
    </form>
  );
}
