"use client";

import { useActionState } from "react";

import { Field, Input, Select } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { CategoryPicker } from "@/features/categories/components/CategoryPicker";
import type { CategoryNode } from "@/features/categories/types";
import type { Pocket } from "@/features/pockets/types";
import { initialActionState } from "@/lib/types/action-state";

import { createIncomeExpenseAction } from "../actions";

export function TransactionForm({
  walletId,
  transactionType,
  pockets,
  categories,
}: {
  walletId: string;
  transactionType: "INCOME" | "EXPENSE";
  pockets: Pocket[];
  categories: CategoryNode[];
}) {
  const [state, formAction] = useActionState(createIncomeExpenseAction, initialActionState);
  const defaultPocketId = pockets.find((p) => p.is_default)?.id ?? pockets[0]?.id;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="walletId" value={walletId} />
      <input type="hidden" name="transactionType" value={transactionType} />

      <Field label="จำนวนเงิน" htmlFor="amount">
        <Input id="amount" name="amount" type="text" inputMode="decimal" placeholder="0.00" required autoFocus />
      </Field>

      <Field label="ช่อง (Pocket)" htmlFor="pocketId">
        <Select id="pocketId" name="pocketId" defaultValue={defaultPocketId} required>
          {pockets.map((pocket) => (
            <option key={pocket.id} value={pocket.id}>
              {pocket.name}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="หมวดหมู่" htmlFor="categoryId">
        <CategoryPicker name="categoryId" categories={categories} transactionType={transactionType} walletId={walletId} />
      </Field>

      <Field label="ชื่อรายการ (ถ้ามี)" htmlFor="title">
        <Input id="title" name="title" type="text" placeholder="เช่น กาแฟ" />
      </Field>

      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
      <SubmitButton size="lg" variant={transactionType === "INCOME" ? "primary" : "danger"}>
        {transactionType === "INCOME" ? "บันทึกรายรับ" : "บันทึกรายจ่าย"}
      </SubmitButton>
    </form>
  );
}
