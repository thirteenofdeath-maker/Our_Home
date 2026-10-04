"use client";

import { useActionState, useMemo, useState } from "react";

import { Field, Input } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { CategoryPicker } from "@/features/categories/components/CategoryPicker";
import type { CategoryNode } from "@/features/categories/types";
import { FinanceOccurredAtField } from "@/features/finance/components/FinanceOccurredAtField";
import { FinancePocketField } from "@/features/finance/components/FinancePocketPicker";
import type { TransferEndpoint } from "@/features/transactions/domain/unified-transfer";
import { initialActionState } from "@/lib/types/action-state";
import { createShoppingExpenseAction } from "../actions";

export function ShoppingExpenseForm({
  shoppingItemId,
  endpoints,
  categories,
  itemCurrency,
  defaultAmount,
  defaultTitle,
  defaultNote,
}: {
  shoppingItemId: string;
  endpoints: TransferEndpoint[];
  categories: CategoryNode[];
  itemCurrency: string;
  defaultAmount?: string | null;
  defaultTitle: string;
  defaultNote?: string | null;
}) {
  const initial =
    endpoints.find((endpoint) => endpoint.currency === itemCurrency) ??
    endpoints[0] ??
    null;
  const [selectedPocketId, setSelectedPocketId] = useState(
    initial?.pocketId ?? "",
  );
  const [state, formAction] = useActionState(
    createShoppingExpenseAction,
    initialActionState,
  );
  const selected = useMemo(
    () =>
      endpoints.find((endpoint) => endpoint.pocketId === selectedPocketId) ??
      null,
    [endpoints, selectedPocketId],
  );
  const currency = selected?.currency ?? itemCurrency;

  return (
    <form
      action={formAction}
      className="finance-ui-tone flex flex-col gap-4 rounded-card bg-surface p-4 shadow-card"
    >
      <input type="hidden" name="shoppingItemId" value={shoppingItemId} />

      <div className="rounded-[1rem] bg-finance-primary-soft px-3 py-2.5">
        <p className="text-sm font-semibold text-finance-primary-strong">
          รายจ่ายครอบครัว
        </p>
        <p className="mt-0.5 text-xs text-finance-muted">
          สมาชิกในบ้านทุกคนจะเห็นรายการนี้ในหน้าการเงินครอบครัว
        </p>
      </div>

      <Field label="จำนวนเงิน" htmlFor="amount">
        <div className="flex h-14 items-center rounded-[1rem] border border-border/70 bg-surface px-3 shadow-sm focus-within:border-primary focus-within:ring-3 focus-within:ring-primary-soft">
          <span className="text-2xl font-semibold text-foreground">
            {currency === "THB" ? "฿" : currency}
          </span>
          <input
            id="amount"
            name="amount"
            type="text"
            inputMode="decimal"
            defaultValue={defaultAmount ?? ""}
            placeholder="0.00"
            required
            autoFocus
            className="h-12 min-w-0 flex-1 border-0 bg-transparent px-3 text-3xl font-semibold text-foreground outline-none placeholder:text-foreground-muted"
          />
        </div>
      </Field>

      <FinancePocketField
        label="จ่ายจากกระเป๋า"
        title="เลือกกระเป๋าหรือบัตร"
        options={endpoints}
        selectedPocketId={selectedPocketId}
        onSelect={(endpoint) => setSelectedPocketId(endpoint.pocketId)}
      />

      {selected?.creditCard ? (
        <p className="rounded-[1rem] bg-finance-warning/10 px-3 py-2.5 text-xs text-finance-muted">
          รายการนี้จะเพิ่มยอดค้างชำระบัตร และไม่นับซ้ำตอนชำระค่าบัตร
        </p>
      ) : null}

      {selected && selected.currency !== itemCurrency && defaultAmount ? (
        <p className="rounded-[1rem] bg-finance-warning/10 px-3 py-2.5 text-xs text-finance-muted">
          งบเดิมเป็น {itemCurrency} แต่กระเป๋านี้เป็น {selected.currency}
          กรุณาแก้จำนวนเงินให้ถูกต้อง
        </p>
      ) : null}

      <Field label="หมวดหมู่ครอบครัว" htmlFor="categoryId">
        <CategoryPicker
          name="categoryId"
          categories={categories}
          transactionType="EXPENSE"
          allowCreate={false}
          placeholder="เลือกหมวดหมู่ครอบครัว"
        />
      </Field>

      <Field label="ชื่อรายการ (ถ้ามี)" htmlFor="title">
        <Input id="title" name="title" defaultValue={defaultTitle} />
      </Field>

      <Field label="โน้ต (ถ้ามี)" htmlFor="note">
        <Input id="note" name="note" defaultValue={defaultNote ?? ""} />
      </Field>

      <FinanceOccurredAtField />

      {state.error ? (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      ) : null}
      <SubmitButton size="lg" variant="financeExpense">
        บันทึกรายจ่ายครอบครัว
      </SubmitButton>
    </form>
  );
}
