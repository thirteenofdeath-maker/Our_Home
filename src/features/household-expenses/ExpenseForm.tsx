"use client";

import { useActionState, useRef } from "react";

import { useCloseFormSheetOnSuccess } from "@/components/ui/FormSheetButton";
import { initialActionState, type ActionState } from "@/lib/types/action-state";
import {
  markReceiptPurchasedAction,
  saveHouseholdExpenseAction,
} from "./actions";
import { expenseCategories, type HouseholdExpense } from "./domain";

const inputClass =
  "min-h-11 w-full min-w-0 rounded-xl border border-border bg-surface px-3";

export function ExpenseForm({
  householdId,
  members,
  defaultPayer,
  defaultDate,
  expense,
  items = [],
}: {
  householdId: string;
  members: { id: string; label: string }[];
  defaultPayer: string;
  defaultDate: string;
  expense?: HouseholdExpense;
  items?: { id: string; name: string }[];
}) {
  const requestId = useRef(expense?.id);
  const [state, action, pending] = useActionState(
    async (previous: ActionState, form: FormData) => {
      requestId.current ??= globalThis.crypto.randomUUID();
      form.set("id", requestId.current);
      return saveHouseholdExpenseAction(previous, form);
    },
    initialActionState,
  );
  useCloseFormSheetOnSuccess(state.success);

  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="householdId" value={householdId} />
      <input type="hidden" name="edit" value={String(Boolean(expense))} />
      {items.map((item) => (
        <input key={item.id} type="hidden" name="itemId" value={item.id} />
      ))}
      <label className="grid gap-1 text-sm">
        ชื่อรายการ
        <input
          className={inputClass}
          name="title"
          required
          maxLength={120}
          defaultValue={
            expense?.title ??
            items
              .map((item) => item.name)
              .join(", ")
              .slice(0, 120)
          }
        />
      </label>
      <label className="grid gap-1 text-sm">
        ยอดจ่ายจริง (บาท)
        <input
          className={inputClass}
          name="amount"
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0.01"
          max="999999999999.99"
          required
          defaultValue={expense?.amount}
        />
      </label>
      <label className="grid gap-1 text-sm">
        หมวด
        <select
          className={inputClass}
          name="category"
          defaultValue={
            expense?.category ?? (items.length ? "shopping" : "other")
          }
        >
          {Object.entries(expenseCategories).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-sm">
        วันที่จ่าย
        <input
          className={inputClass}
          name="paidOn"
          type="date"
          required
          defaultValue={expense?.paid_on ?? defaultDate}
        />
      </label>
      <label className="grid gap-1 text-sm">
        คนจ่าย
        <select
          className={inputClass}
          name="payerId"
          required
          defaultValue={expense?.payer_id ?? defaultPayer}
        >
          {members.map((member) => (
            <option key={member.id} value={member.id}>
              {member.label}
            </option>
          ))}
          {expense &&
          !members.some((member) => member.id === expense.payer_id) ? (
            <option value={expense.payer_id}>อดีตสมาชิก</option>
          ) : null}
        </select>
      </label>
      {state.error ? (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      ) : null}
      <button
        disabled={pending}
        className="min-h-11 rounded-xl bg-finance-primary px-4 font-medium text-finance-primary-foreground disabled:opacity-60"
      >
        {pending ? "กำลังบันทึก…" : "บันทึกค่าใช้จ่าย"}
      </button>
    </form>
  );
}

export function MarkReceiptPurchasedForm({ itemIds }: { itemIds: string[] }) {
  const [state, action, pending] = useActionState(
    markReceiptPurchasedAction,
    initialActionState,
  );
  return (
    <form action={action} className="grid gap-2">
      {itemIds.map((id) => (
        <input key={id} type="hidden" name="itemId" value={id} />
      ))}
      {state.error ? (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      ) : null}
      <button
        disabled={pending}
        className="min-h-11 rounded-xl border border-border px-4 text-sm font-medium disabled:opacity-60"
      >
        {pending ? "กำลังบันทึก…" : "ซื้อแล้ว ไว้ลงยอดทีหลัง"}
      </button>
    </form>
  );
}
