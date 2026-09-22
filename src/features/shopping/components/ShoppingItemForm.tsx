"use client";

import { useActionState } from "react";

import { Field, Input, Select, Textarea, TwoColumnFieldGrid } from "@/components/ui/Field";
import { useCloseFormSheetOnSuccess } from "@/components/ui/FormSheetButton";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { initialActionState } from "@/lib/types/action-state";
import { createShoppingItemAction } from "../actions";

export function ShoppingItemForm({
  householdId,
  members,
}: {
  householdId: string;
  members: Array<{ id: string; label: string }>;
}) {
  const [state, action] = useActionState(
    createShoppingItemAction,
    initialActionState,
  );
  useCloseFormSheetOnSuccess(state.success);

  return (
    <form action={action} className="flex min-w-0 flex-col gap-4">
      <input type="hidden" name="householdId" value={householdId} />
      <Field label="ของที่ต้องซื้อ" htmlFor="shopping-name">
        <Input
          id="shopping-name"
          name="name"
          maxLength={120}
          required
          autoFocus
          placeholder="เช่น อาหารแมว"
        />
      </Field>
      <TwoColumnFieldGrid>
        <Field label="จำนวน" htmlFor="shopping-quantity">
          <Input
            id="shopping-quantity"
            name="quantity"
            type="number"
            inputMode="decimal"
            min="0.001"
            step="0.001"
            defaultValue="1"
            required
          />
        </Field>
        <Field label="หน่วย" htmlFor="shopping-unit">
          <Input
            id="shopping-unit"
            name="unit"
            maxLength={40}
            placeholder="ถุง / ชิ้น / กก."
          />
        </Field>
      </TwoColumnFieldGrid>
      <Field label="ร้าน" htmlFor="shopping-store">
        <Input
          id="shopping-store"
          name="store"
          maxLength={120}
          placeholder="ระบุร้านหรือสถานที่ (ถ้ามี)"
        />
      </Field>
      <Field label="ผู้รับผิดชอบ" htmlFor="shopping-assignee">
        <Select id="shopping-assignee" name="assignedMemberId" defaultValue="">
          <option value="">ยังไม่มอบหมาย</option>
          {members.map((member) => (
            <option key={member.id} value={member.id}>
              {member.label}
            </option>
          ))}
        </Select>
      </Field>
      <TwoColumnFieldGrid>
        <Field label="งบประมาณ" htmlFor="shopping-budget">
          <Input
            id="shopping-budget"
            name="estimatedAmount"
            type="text"
            inputMode="decimal"
            placeholder="0.00"
          />
        </Field>
        <Field label="สกุลเงิน" htmlFor="shopping-currency">
          <Select id="shopping-currency" name="currency" defaultValue="THB">
            <option value="THB">THB</option>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
            <option value="JPY">JPY</option>
            <option value="CNY">CNY</option>
          </Select>
        </Field>
      </TwoColumnFieldGrid>
      <Field label="หมายเหตุ" htmlFor="shopping-note">
        <Textarea
          id="shopping-note"
          name="note"
          maxLength={500}
          placeholder="ยี่ห้อ ขนาด หรือรายละเอียดเพิ่มเติม"
        />
      </Field>
      {state.error ? (
        <p aria-live="polite" className="text-sm text-danger">
          {state.error}
        </p>
      ) : null}
      <SubmitButton size="lg">เพิ่มในรายการ</SubmitButton>
    </form>
  );
}
