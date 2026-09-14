"use client";

import { Field, Input } from "@/components/ui/Field";
import { CategoryPicker } from "@/features/categories/components/CategoryPicker";
import type { CategoryNode } from "@/features/categories/types";

/**
 * Phase V (0052): the optional "ค่าธรรมเนียม"/"ดอกเบี้ย" section on a
 * transfer form. Collapsed by default (a native <details>, no extra JS
 * needed for that) — both sections are visually secondary until the user
 * opens them. A positive amount here becomes a genuinely separate EXPENSE
 * transaction on save (never part of the transfer principal); the
 * category picker is scoped to the SAME source wallet the transfer
 * principal leaves from, matching exactly where the charge is funded
 * from (see create_wallet_transfer/create_pocket_transfer).
 */
export function TransferChargeSection({
  title,
  amountFieldName,
  categoryFieldName,
  categories,
  walletId,
  amount,
  onAmountChange,
}: {
  title: string;
  amountFieldName: string;
  categoryFieldName: string;
  categories: CategoryNode[];
  walletId: string;
  amount: string;
  onAmountChange: (value: string) => void;
}) {
  return (
    <details className="rounded-card border border-border/70 bg-surface-muted p-3">
      <summary className="cursor-pointer select-none text-sm font-medium text-foreground-muted">{title} (ถ้ามี)</summary>
      <div className="mt-3 flex flex-col gap-3">
        <Field label="จำนวนเงิน" htmlFor={amountFieldName}>
          <Input
            id={amountFieldName}
            name={amountFieldName}
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            value={amount}
            onChange={(event) => onAmountChange(event.target.value)}
          />
        </Field>
        <Field label="หมวดหมู่" htmlFor={categoryFieldName}>
          <CategoryPicker name={categoryFieldName} categories={categories} transactionType="EXPENSE" walletId={walletId} />
        </Field>
        {Number(amount) > 0 ? <p className="text-xs text-foreground-muted">ต้องเลือกหมวดหมู่เมื่อระบุจำนวนเงิน — {title}เป็นรายจ่าย ไม่ใช่ส่วนหนึ่งของเงินต้นที่โอน</p> : null}
      </div>
    </details>
  );
}
