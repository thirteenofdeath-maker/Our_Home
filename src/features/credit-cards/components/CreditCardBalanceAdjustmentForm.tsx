"use client";

import { useActionState, useState } from "react";
import { Field, Input, Select } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { initialActionState } from "@/lib/types/action-state";
import { formatCurrency } from "@/lib/utils/money";
import { createCreditCardBalanceAdjustmentAction } from "../actions";
import type { CreditCardAccount } from "../types";

export function CreditCardBalanceAdjustmentForm({ card }: { card: CreditCardAccount }) {
  const [state, action] = useActionState(createCreditCardBalanceAdjustmentAction, initialActionState);
  const [balanceKind, setBalanceKind] = useState("LIABILITY");
  const today = new Date().toLocaleDateString("en-CA");
  return <form action={action} className="flex flex-col gap-4 rounded-card bg-finance-surface-strong p-4 shadow-card">
    <input type="hidden" name="cardAccountId" value={card.accountId} />
    <div className="rounded-control bg-finance-primary-soft p-3 text-sm text-finance-muted">
      ยอดปัจจุบัน {formatCurrency(card.walletBalance, card.currency)} · ใช้เมื่อยอดในแอปไม่ตรงกับผู้ออกบัตร ระบบจะสร้างรายการปรับยอดจริง ไม่ใช่รายรับหรือรายจ่าย
    </div>
    <Field label="สถานะยอดตามผู้ออกบัตร" htmlFor="balanceKind">
      <Select id="balanceKind" name="balanceKind" value={balanceKind} onChange={(event) => setBalanceKind(event.currentTarget.value)}>
        <option value="LIABILITY">มียอดค้างชำระ</option><option value="CREDIT">มีเครดิตคงเหลือ</option><option value="ZERO">ยอดเป็นศูนย์</option>
      </Select>
    </Field>
    {balanceKind !== "ZERO" ? <Field label={`จำนวน (${card.currency})`} htmlFor="amount">
      <Input id="amount" name="amount" inputMode="decimal" min="0.01" step="0.01" placeholder="0.00" required autoFocus />
    </Field> : <input type="hidden" name="amount" value="0" />}
    <Field label="วันที่ตรวจยอด" htmlFor="occurredAt"><Input id="occurredAt" name="occurredAt" type="date" defaultValue={today} required /></Field>
    <Field label="เหตุผล/โน้ต" htmlFor="note"><Input id="note" name="note" placeholder="เช่น ปรับให้ตรงใบแจ้งยอด" /></Field>
    {state.error ? <p role="alert" className="text-sm text-danger">{state.error}</p> : null}
    <div className="sticky bottom-3 z-10"><SubmitButton size="lg" variant="financeTransfer">บันทึกการปรับยอด</SubmitButton></div>
  </form>;
}
