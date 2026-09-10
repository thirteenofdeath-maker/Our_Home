"use client";

import { useActionState, useState } from "react";

import { Field, Input, Select } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import type { CategoryNode } from "@/features/categories/types";
import { initialActionState } from "@/lib/types/action-state";

import { createBudgetAction } from "../actions";

function CategoryOptions({ categories }: { categories: CategoryNode[] }) {
  return (
    <>
      <option value="" disabled>
        เลือกหมวดหมู่
      </option>
      {categories.flatMap((category) => [
        <option key={category.id} value={category.id}>
          {category.name}
        </option>,
        ...category.children.map((child) => (
          <option key={child.id} value={child.id}>
            {category.name} &gt; {child.name}
          </option>
        )),
      ])}
    </>
  );
}

export function CreateBudgetForm({
  periodMonth,
  hasHousehold,
  personalCategories,
  householdCategories,
}: {
  /** Canonical "YYYY-MM-01", the month this budget is being created for. */
  periodMonth: string;
  hasHousehold: boolean;
  personalCategories: CategoryNode[];
  householdCategories: CategoryNode[];
}) {
  const [state, formAction] = useActionState(createBudgetAction, initialActionState);
  const [scope, setScope] = useState<"PERSONAL" | "HOUSEHOLD">("PERSONAL");

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="periodMonth" value={periodMonth} />

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium text-foreground-muted">ประเภทงบประมาณ</legend>
        <label className="flex items-center gap-2 text-sm">
          <input type="radio" name="scope" value="PERSONAL" checked={scope === "PERSONAL"} onChange={() => setScope("PERSONAL")} />
          ส่วนตัว
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="scope"
            value="HOUSEHOLD"
            checked={scope === "HOUSEHOLD"}
            onChange={() => setScope("HOUSEHOLD")}
            disabled={!hasHousehold}
          />
          ครอบครัว{!hasHousehold ? " (สร้างครอบครัวก่อน)" : ""}
        </label>
      </fieldset>

      <Field label="หมวดหมู่ (รายจ่ายเท่านั้น)" htmlFor="categoryId">
        <Select id="categoryId" name="categoryId" defaultValue="" required>
          <CategoryOptions categories={scope === "PERSONAL" ? personalCategories : householdCategories} />
        </Select>
      </Field>

      <Field label="สกุลเงิน" htmlFor="currency">
        <Input id="currency" name="currency" type="text" defaultValue="THB" maxLength={3} required />
      </Field>

      <Field label="งบประมาณ" htmlFor="amount">
        <Input id="amount" name="amount" type="text" inputMode="decimal" placeholder="0.00" required autoFocus />
      </Field>

      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
      <SubmitButton size="lg">สร้างงบประมาณ</SubmitButton>
    </form>
  );
}
