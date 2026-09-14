"use client";
import {useActionState} from "react";
import {Field,Input} from "@/components/ui/Field";
import {SubmitButton} from "@/components/ui/SubmitButton";
import {initialActionState} from "@/lib/types/action-state";
import {issueCreditCardStatementAction} from "../actions";
import type {CreditCardAccount} from "../types";
export function CreditCardStatementForm({card,defaults}:{card:CreditCardAccount;defaults:{periodStart:string;periodEnd:string;dueDate:string}}){
 const [state,action]=useActionState(issueCreditCardStatementAction,initialActionState);
 return <form action={action} className="finance-ui-tone flex flex-col gap-4 rounded-card bg-finance-surface-strong p-4 shadow-card">
  <input type="hidden" name="cardAccountId" value={card.accountId}/>
  <p className="rounded-control bg-finance-primary-soft p-3 text-sm text-finance-muted">ยอดรอบบิลคำนวณจาก ledger โดยเซิร์ฟเวอร์ แก้ย้อนหลังไม่ได้ และไม่ให้กรอกยอดรวมเอง</p>
  <Field label="เริ่มรอบ" htmlFor="periodStart"><Input id="periodStart" name="periodStart" type="date" defaultValue={defaults.periodStart} required/></Field>
  <Field label="วันตัดรอบ" htmlFor="periodEnd"><Input id="periodEnd" name="periodEnd" type="date" defaultValue={defaults.periodEnd} required/></Field>
  <Field label="วันครบกำหนด" htmlFor="dueDate"><Input id="dueDate" name="dueDate" type="date" defaultValue={defaults.dueDate} required/></Field>
  <Field label={`ยอดชำระขั้นต่ำ (${card.currency})`} htmlFor="minimumAmountDue"><Input id="minimumAmountDue" name="minimumAmountDue" inputMode="decimal" min="0" step="0.01" defaultValue="0" required/></Field>
  {state.error?<p role="alert" className="text-sm text-danger">{state.error}</p>:null}
  <div className="sticky bottom-3 z-10"><SubmitButton size="lg">ออกใบแจ้งยอด</SubmitButton></div>
 </form>;
}
