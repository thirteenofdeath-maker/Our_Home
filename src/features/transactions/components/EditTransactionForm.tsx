"use client";

import { useActionState } from "react";

import { Field, Input, Select } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { CategoryPicker } from "@/features/categories/components/CategoryPicker";
import type { CategoryNode } from "@/features/categories/types";
import type { Pocket } from "@/features/pockets/types";
import { TagPicker } from "@/features/tags/components/TagPicker";
import type { TagOption } from "@/features/tags/types";
import { initialActionState } from "@/lib/types/action-state";

import { updateIncomeExpenseAction } from "../actions";
import type { TransactionDetail } from "../api";
import { ExpenseCategorySelect } from "./ExpenseCategorySelect";

/**
 * Mirrors TransactionForm (create), pre-filled from an existing
 * transaction. Wallet and transaction type are never shown as editable
 * fields at all — see docs/FINANCE.md Phase B "Edit" for why (moving a
 * transaction between wallets has broader currency/account semantics that
 * are explicitly out of scope for this phase).
 */
export function EditTransactionForm({
  transaction,
  walletId,
  pockets,
  categories,
  tags,
  currentTags,
}: {
  transaction: TransactionDetail & { transactionType: "INCOME" | "EXPENSE" };
  walletId: string;
  pockets: Pocket[];
  categories: CategoryNode[];
  tags: TagOption[];
  currentTags: TagOption[];
}) {
  const [state, formAction] = useActionState(updateIncomeExpenseAction, initialActionState);
  const occurredAtDefault = transaction.occurredAt.slice(0, 10);
  const amountDefault = (transaction.amount ?? "0.00").replace(/^-/, "");

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="transactionId" value={transaction.transactionId} />
      <input type="hidden" name="walletId" value={walletId} />

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

      <Field label="หมวดหมู่" htmlFor="categoryId">
        {transaction.transactionType === "EXPENSE" ? (
          <ExpenseCategorySelect categories={categories} defaultValue={transaction.categoryId ?? ""} />
        ) : (
          <CategoryPicker
            name="categoryId"
            categories={categories}
            transactionType={transaction.transactionType}
            walletId={walletId}
            defaultSelected={transaction.categoryId ? { id: transaction.categoryId, label: transaction.categoryName ?? "" } : null}
          />
        )}
      </Field>

      <Field label="ชื่อรายการ (ถ้ามี)" htmlFor="title">
        <Input id="title" name="title" type="text" defaultValue={transaction.title ?? ""} placeholder="เช่น กาแฟ" />
      </Field>

      <Field label="โน้ต (ถ้ามี)" htmlFor="note">
        <Input id="note" name="note" type="text" defaultValue={transaction.note ?? ""} />
      </Field>

      <Field label="วันที่" htmlFor="occurredAt">
        <Input id="occurredAt" name="occurredAt" type="date" defaultValue={occurredAtDefault} required />
      </Field>

      <Field label="แท็ก (ถ้ามี)" htmlFor="tagIds">
        <TagPicker name="tagIds" tags={tags} walletId={walletId} defaultSelected={currentTags} />
      </Field>

      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
      <SubmitButton size="lg">บันทึกการแก้ไข</SubmitButton>
    </form>
  );
}
