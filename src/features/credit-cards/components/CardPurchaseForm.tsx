"use client";

import { useActionState, useState } from "react";

import { Field, Input } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { CategoryPicker } from "@/features/categories/components/CategoryPicker";
import type { CategoryNode } from "@/features/categories/types";
import { TagPicker } from "@/features/tags/components/TagPicker";
import type { TagOption } from "@/features/tags/types";
import { initialActionState } from "@/lib/types/action-state";
import { formatCurrency } from "@/lib/utils/money";

import { createCardPurchaseAction } from "../actions";
import type { CreditCardAccount } from "../types";

type ExpenseScope = "PERSONAL" | "HOUSEHOLD";

export function CardPurchaseForm({
  card,
  personalCategories,
  householdCategories,
  personalTags,
  householdTags,
  hasHousehold,
}: {
  card: CreditCardAccount;
  personalCategories: CategoryNode[];
  householdCategories: CategoryNode[];
  personalTags: TagOption[];
  householdTags: TagOption[];
  hasHousehold: boolean;
}) {
  const [state, action] = useActionState(createCardPurchaseAction, initialActionState);
  const fixedScope = card.scope === "HOUSEHOLD" ? "HOUSEHOLD" : null;
  const [scope, setScope] = useState<ExpenseScope | null>(fixedScope);
  const today = new Date().toLocaleDateString("en-CA");
  const categories = scope === "HOUSEHOLD" ? householdCategories : personalCategories;
  const tags = scope === "HOUSEHOLD" ? householdTags : personalTags;
  const isAttributed = card.scope === "PERSONAL" && scope === "HOUSEHOLD";

  return (
    <form action={action} className="flex flex-col gap-4 rounded-card bg-finance-surface-strong p-4 shadow-card">
      <input type="hidden" name="cardAccountId" value={card.accountId} />
      {fixedScope ? <input type="hidden" name="expenseScope" value={fixedScope} /> : null}

      <div className="rounded-control bg-finance-primary-soft p-3 text-sm">
        <p className="font-medium text-finance-text">{card.name}</p>
        <p className="text-finance-muted">
          วงเงินใช้ได้ {formatCurrency(card.availableCredit, card.currency)}
        </p>
      </div>

      <Field label="จำนวนเงิน" htmlFor="amount">
        <Input id="amount" name="amount" inputMode="decimal" placeholder="0.00" required autoFocus />
      </Field>

      {!fixedScope ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium text-finance-muted">รายการนี้เป็นของใคร</legend>
          <div className="grid grid-cols-2 gap-2">
            {(["PERSONAL", "HOUSEHOLD"] as const).map((value) => (
              <label key={value} className={`rounded-control border p-3 text-center text-sm ${scope === value ? "border-finance-primary bg-finance-primary-soft" : "border-border"}`}>
                <input
                  className="sr-only"
                  type="radio"
                  name="expenseScope"
                  value={value}
                  checked={scope === value}
                  disabled={value === "HOUSEHOLD" && !hasHousehold}
                  onChange={() => setScope(value)}
                />
                {value === "PERSONAL" ? "ส่วนตัว" : `ครอบครัว${!hasHousehold ? " (ยังไม่มีครอบครัว)" : ""}`}
              </label>
            ))}
          </div>
          {!scope ? <p className="text-xs text-finance-muted">กรุณาเลือกเอง ระบบจะไม่เลือกแทนนาย</p> : null}
        </fieldset>
      ) : (
        <p className="text-sm text-finance-muted">รายการนี้เป็นรายจ่ายครอบครัวตามประเภทของบัตร</p>
      )}

      {scope ? (
        <Field label="หมวดหมู่" htmlFor="categoryId">
          <CategoryPicker
            key={scope}
            name="categoryId"
            categories={categories}
            transactionType="EXPENSE"
            {...(isAttributed ? { categoryScope: "HOUSEHOLD" as const } : { walletId: card.walletId })}
          />
        </Field>
      ) : null}

      {isAttributed ? (
        <p className="rounded-control border border-finance-primary/30 bg-finance-primary-soft p-3 text-sm text-finance-muted">
          ใช้บัตรส่วนตัวจ่ายแทนครอบครัว รายการจะนับในรายจ่ายครอบครัว แต่ยอดหนี้อยู่ที่บัตรส่วนตัวของนาย
        </p>
      ) : null}

      <Field label="ชื่อรายการ" htmlFor="title">
        <Input id="title" name="title" placeholder="เช่น ค่าอาหาร" />
      </Field>
      <Field label="โน้ต" htmlFor="note">
        <Input id="note" name="note" />
      </Field>
      <Field label="วันที่ซื้อ" htmlFor="occurredAt">
        <Input id="occurredAt" name="occurredAt" type="date" defaultValue={today} required />
      </Field>

      {scope && !isAttributed ? (
        <Field label="แท็ก" htmlFor="tagIds">
          <TagPicker name="tagIds" tags={tags} walletId={card.walletId} />
        </Field>
      ) : null}

      {state.error ? <p role="alert" className="text-sm text-danger">{state.error}</p> : null}
      <div className="sticky bottom-3 z-10">
        <SubmitButton size="lg" variant="financeExpense" disabled={!scope}>
          บันทึกรายการซื้อ
        </SubmitButton>
      </div>
    </form>
  );
}
