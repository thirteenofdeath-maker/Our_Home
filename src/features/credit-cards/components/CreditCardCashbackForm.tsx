"use client";

import { useActionState } from "react";

import { Field, Input } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { initialActionState } from "@/lib/types/action-state";

import { createCreditCardCashbackAction } from "../actions";
import type { CreditCardAccount } from "../types";

export function CreditCardCashbackForm({ card }: { card: CreditCardAccount }) {
  const [state, action] = useActionState(createCreditCardCashbackAction, initialActionState);
  const today = new Date().toLocaleDateString("en-CA");

  return (
    <form action={action} className="flex flex-col gap-4 rounded-card bg-finance-surface-strong p-4 shadow-card">
      <input type="hidden" name="cardAccountId" value={card.accountId} />
      <div className="rounded-control bg-finance-primary-soft p-3 text-sm text-finance-muted">
        Cashback ลดหนี้บัตรก่อน หากเกินยอดค้าง ระบบเก็บส่วนเกินเป็นเครดิตในบัตร ไม่บันทึกเป็นรายรับ
      </div>
      <Field label={`จำนวน Cashback (${card.currency})`} htmlFor="amount">
        <Input id="amount" name="amount" inputMode="decimal" placeholder="0.00" required autoFocus />
      </Field>
      <Field label="วันที่ได้รับ" htmlFor="occurredAt">
        <Input id="occurredAt" name="occurredAt" type="date" defaultValue={today} required />
      </Field>
      <Field label="ชื่อรายการ" htmlFor="title">
        <Input id="title" name="title" placeholder="เช่น Cashback รอบเดือนนี้" />
      </Field>
      <Field label="โน้ต" htmlFor="note">
        <Input id="note" name="note" />
      </Field>
      {state.error ? <p role="alert" className="text-sm text-danger">{state.error}</p> : null}
      <div className="sticky bottom-3 z-10">
        <SubmitButton size="lg" variant="financeIncome">บันทึก Cashback</SubmitButton>
      </div>
    </form>
  );
}
