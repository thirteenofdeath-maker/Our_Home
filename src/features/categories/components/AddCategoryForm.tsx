"use client";

import { useActionState, useState } from "react";

import { Field, Input } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { FinanceOptionField } from "@/features/finance/components/FinanceOptionField";
import { initialActionState } from "@/lib/types/action-state";

import { createCategoryAction } from "../actions";
import type { CategoryNode } from "../types";

export function AddCategoryForm({
  transactionType,
  scope,
  topLevelCategories,
}: {
  transactionType: "INCOME" | "EXPENSE";
  scope: "PERSONAL" | "HOUSEHOLD";
  topLevelCategories: CategoryNode[];
}) {
  const [state, formAction] = useActionState(createCategoryAction, initialActionState);
  const [parentId, setParentId] = useState("");

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4">
      <input type="hidden" name="transactionType" value={transactionType} />
      <input type="hidden" name="scope" value={scope} />

      <Field label="ชื่อหมวดหมู่" htmlFor="name">
        <Input id="name" name="name" type="text" required />
      </Field>

      <FinanceOptionField
        label="หมวดหมู่หลัก (ถ้าเป็นหมวดหมู่ย่อย)"
        title="เลือกหมวดหมู่หลัก"
        name="parentId"
        options={topLevelCategories.map((category) => ({
          id: category.id,
          label: category.name,
        }))}
        value={parentId}
        onChange={setParentId}
        emptyChoice={{
          label: "ไม่มี",
          description: "สร้างเป็นหมวดหมู่หลัก",
        }}
      />

      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
      <SubmitButton size="md">เพิ่มหมวดหมู่</SubmitButton>
    </form>
  );
}
