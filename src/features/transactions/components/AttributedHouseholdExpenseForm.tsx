"use client";

import { useActionState, useState } from "react";

import { Field, Input } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { CategoryPicker } from "@/features/categories/components/CategoryPicker";
import type { CategoryNode } from "@/features/categories/types";
import { FinanceOccurredAtField } from "@/features/finance/components/FinanceOccurredAtField";
import { FinancePocketField } from "@/features/finance/components/FinancePocketPicker";
import { initialActionState } from "@/lib/types/action-state";
import type { TransferEndpoint } from "../domain/unified-transfer";

import { createAttributedHouseholdExpenseAction } from "../actions";

export function AttributedHouseholdExpenseForm({
  householdId,
  endpoints,
  categories,
}: {
  householdId: string;
  endpoints: TransferEndpoint[];
  categories: CategoryNode[];
}) {
  const [state, formAction] = useActionState(
    createAttributedHouseholdExpenseAction,
    initialActionState,
  );
  const [selectedPocketId, setSelectedPocketId] = useState(
    endpoints[0]?.pocketId ?? "",
  );
  const selected =
    endpoints.find((endpoint) => endpoint.pocketId === selectedPocketId) ??
    null;
  const currency = selected?.currency ?? "THB";

  if (!endpoints.length) {
    return (
      <div className="rounded-[1rem] bg-finance-surface-strong p-4 text-sm text-finance-muted">
        ยังไม่มีกระเป๋าส่วนตัวที่ใช้จ่ายได้ กรุณาสร้างกระเป๋าส่วนตัวก่อน
      </div>
    );
  }

  return (
    <form action={formAction} className="finance-ui-tone flex flex-col gap-3.5">
      <input type="hidden" name="householdId" value={householdId} />

      <div className="rounded-[1rem] bg-finance-primary-soft px-3 py-2.5">
        <p className="text-sm font-medium text-finance-primary-strong">
          ออกเงินส่วนตัวให้ครอบครัว
        </p>
        <p className="mt-0.5 text-xs text-finance-muted">
          ใช้กระเป๋าหรือบัตรของคุณ แต่นับรายการนี้ในรายจ่ายครอบครัว
        </p>
      </div>

      {selected?.creditCard ? (
        <div className="rounded-[1rem] bg-finance-warning/10 px-3 py-2.5 text-xs text-finance-muted">
          รายการนี้จะเพิ่มยอดค้างชำระบัตร โดยยังไม่หักเงินสด
          และการจ่ายค่าบัตรภายหลังจะไม่ถูกนับเป็นรายจ่ายซ้ำ
        </div>
      ) : null}

      <Field label="จำนวนเงิน" htmlFor="attributed-household-amount">
        <div className="flex h-14 items-center rounded-[1rem] border border-border/70 bg-surface px-3 shadow-sm focus-within:border-primary focus-within:ring-3 focus-within:ring-primary-soft">
          <span className="text-2xl font-semibold text-foreground">
            {currency === "THB" ? "฿" : currency}
          </span>
          <input
            id="attributed-household-amount"
            name="amount"
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            required
            autoFocus
            className="h-12 min-w-0 flex-1 border-0 bg-transparent px-3 text-3xl font-semibold text-foreground outline-none placeholder:text-foreground-muted"
          />
        </div>
      </Field>

      <FinancePocketField
        label="จ่ายจากกระเป๋าส่วนตัว"
        title="เลือกกระเป๋าส่วนตัว"
        options={endpoints}
        selectedPocketId={selectedPocketId}
        onSelect={(endpoint) => setSelectedPocketId(endpoint.pocketId)}
      />

      <Field label="หมวดหมู่ครอบครัว" htmlFor="categoryId">
        <CategoryPicker
          name="categoryId"
          categories={categories}
          transactionType="EXPENSE"
          allowCreate={false}
          placeholder="เลือกหมวดหมู่ครอบครัว"
        />
      </Field>

      <Field label="ชื่อรายการ (ถ้ามี)" htmlFor="attributed-household-title">
        <Input
          id="attributed-household-title"
          name="title"
          type="text"
          placeholder="เช่น ค่าอาหารแมว"
        />
      </Field>

      <Field label="โน้ต (ถ้ามี)" htmlFor="attributed-household-note">
        <Input id="attributed-household-note" name="note" type="text" />
      </Field>

      <FinanceOccurredAtField />

      {state.error ? (
        <p className="text-sm text-danger">{state.error}</p>
      ) : null}
      <SubmitButton size="lg" variant="financeExpense">
        บันทึกรายจ่ายครอบครัว
      </SubmitButton>
    </form>
  );
}
