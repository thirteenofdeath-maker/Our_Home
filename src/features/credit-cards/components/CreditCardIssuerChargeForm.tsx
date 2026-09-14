"use client";

import { useActionState } from "react";

import { Field, Input, Select } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { initialActionState } from "@/lib/types/action-state";

import { createCreditCardIssuerChargeAction } from "../actions";
import type { CreditCardAccount } from "../types";

export function CreditCardIssuerChargeForm({ card }: { card: CreditCardAccount }) {
  const [state, action] = useActionState(createCreditCardIssuerChargeAction, initialActionState);
  const today = new Date().toLocaleDateString("en-CA");
  return (
    <form action={action} className="flex flex-col gap-4 rounded-card bg-finance-surface-strong p-4 shadow-card">
      <input type="hidden" name="cardAccountId" value={card.accountId} />
      <div className="rounded-control bg-finance-primary-soft p-3 text-sm text-finance-muted">
        บันทึกเฉพาะยอดที่ผู้ออกบัตรเรียกเก็บจริง ระบบจะไม่คำนวณดอกเบี้ยจาก APR
      </div>
      <Field label="ประเภทยอดเรียกเก็บ" htmlFor="chargeKind">
        <Select id="chargeKind" name="chargeKind" defaultValue="INTEREST">
          <option value="INTEREST">ดอกเบี้ย</option>
          <option value="FEE">ค่าธรรมเนียม</option>
          <option value="LATE_FEE">ค่าปรับชำระล่าช้า</option>
        </Select>
      </Field>
      <Field label={`จำนวนเงิน (${card.currency})`} htmlFor="amount">
        <Input id="amount" name="amount" inputMode="decimal" placeholder="0.00" required autoFocus />
      </Field>
      <Field label="วันที่เรียกเก็บ" htmlFor="occurredAt">
        <Input id="occurredAt" name="occurredAt" type="date" defaultValue={today} required />
      </Field>
      <Field label="ชื่อรายการ" htmlFor="title"><Input id="title" name="title" placeholder="เช่น ดอกเบี้ยรอบเดือนนี้" /></Field>
      <Field label="โน้ต" htmlFor="note"><Input id="note" name="note" /></Field>
      {state.error ? <p role="alert" className="text-sm text-danger">{state.error}</p> : null}
      <div className="sticky bottom-3 z-10">
        <SubmitButton size="lg" variant="financeExpense">บันทึกยอดเรียกเก็บ</SubmitButton>
      </div>
    </form>
  );
}
