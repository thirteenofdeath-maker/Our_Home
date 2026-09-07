"use client";

import { useActionState } from "react";

import { Field, Input, Select } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
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

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4">
      <input type="hidden" name="transactionType" value={transactionType} />
      <input type="hidden" name="scope" value={scope} />

      <Field label="ชื่อหมวดหมู่" htmlFor="name">
        <Input id="name" name="name" type="text" required />
      </Field>

      <Field label="หมวดหมู่หลัก (ถ้าเป็นหมวดหมู่ย่อย)" htmlFor="parentId">
        <Select id="parentId" name="parentId" defaultValue="">
          <option value="">ไม่มี — เป็นหมวดหมู่หลัก</option>
          {topLevelCategories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </Field>

      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
      <SubmitButton size="md">เพิ่มหมวดหมู่</SubmitButton>
    </form>
  );
}
