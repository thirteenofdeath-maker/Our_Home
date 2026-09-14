"use client";

import { useActionState } from "react";

import { Field, Input, Select } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { CategoryPicker } from "@/features/categories/components/CategoryPicker";
import type { CategoryNode } from "@/features/categories/types";
import type { Pocket } from "@/features/pockets/types";
import { initialActionState } from "@/lib/types/action-state";

import { updateAttributedHouseholdExpenseAction } from "../actions";
import type { TransactionDetail } from "../api";

/**
 * The ONLY edit path for a personal-funded household expense (Phase U /
 * 0051) — mirrors EditTransactionForm (wallet/scope stay frozen, same as
 * the plain edit form's wallet/transaction-type freeze), but submits to
 * update_attributed_household_expense instead: the generic
 * update_income_expense_transaction RPC rejects these transactions
 * outright, and this route is how the detail page routes a user away
 * from that rejection rather than surfacing it. No tag field — V1 hides
 * personal tags for the whole attributed-expense path (see
 * TransactionForm's create-side equivalent).
 */
export function EditAttributedHouseholdExpenseForm({
  transaction,
  walletId,
  pockets,
  householdCategories,
  householdName,
  householdCategoryId,
  householdCategoryLabel,
}: {
  transaction: TransactionDetail;
  walletId: string;
  pockets: Pocket[];
  householdCategories: CategoryNode[];
  householdName: string;
  householdCategoryId: string;
  householdCategoryLabel: string;
}) {
  const [state, formAction] = useActionState(updateAttributedHouseholdExpenseAction, initialActionState);
  const occurredAtDefault = transaction.occurredAt.slice(0, 10);
  const amountDefault = (transaction.amount ?? "0.00").replace(/^-/, "");

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="transactionId" value={transaction.transactionId} />
      <input type="hidden" name="walletId" value={walletId} />

      <p className="rounded-card border border-primary/30 bg-primary-soft/40 p-3 text-sm text-foreground">
        จ่ายจากกระเป๋าส่วนตัวแทนครอบครัว — รายการนี้จะถูกบันทึกเป็นรายจ่ายของครอบครัว: {householdName}
      </p>

      <Field label="จำนวนเงิน" htmlFor="amount">
        <Input id="amount" name="amount" type="text" inputMode="decimal" defaultValue={amountDefault} required autoFocus />
      </Field>

      <Field label="ช่อง (Pocket)" htmlFor="pocketId">
        <Select id="pocketId" name="pocketId" defaultValue={transaction.pocketId ?? undefined} required>
          {pockets.map((pocket) => (
            <option key={pocket.id} value={pocket.id}>
              {pocket.name}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="หมวดหมู่ (ครอบครัว)" htmlFor="householdCategoryId">
        <CategoryPicker
          name="householdCategoryId"
          categories={householdCategories}
          transactionType="EXPENSE"
          categoryScope="HOUSEHOLD"
          defaultSelected={{ id: householdCategoryId, label: householdCategoryLabel }}
        />
      </Field>

      <Field label="ชื่อรายการ (ถ้ามี)" htmlFor="title">
        <Input id="title" name="title" type="text" defaultValue={transaction.title ?? ""} placeholder="เช่น ค่าไฟบ้าน" />
      </Field>

      <Field label="โน้ต (ถ้ามี)" htmlFor="note">
        <Input id="note" name="note" type="text" defaultValue={transaction.note ?? ""} />
      </Field>

      <Field label="วันที่" htmlFor="occurredAt">
        <Input id="occurredAt" name="occurredAt" type="date" defaultValue={occurredAtDefault} required />
      </Field>

      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
      <SubmitButton size="lg">บันทึกการแก้ไข</SubmitButton>
    </form>
  );
}
