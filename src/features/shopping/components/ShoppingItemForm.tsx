"use client";

import { useActionState } from "react";

import {
  Field,
  Input,
  Select,
  Textarea,
  TwoColumnFieldGrid,
} from "@/components/ui/Field";
import { useCloseFormSheetOnSuccess } from "@/components/ui/FormSheetButton";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { initialActionState } from "@/lib/types/action-state";
import { createShoppingItemAction, updateShoppingItemAction } from "../actions";
import type { ShoppingItem } from "../types";

export function ShoppingItemForm({
  householdId,
  members,
  item,
}: {
  householdId: string;
  members: Array<{ id: string; label: string }>;
  item?: ShoppingItem;
}) {
  const [state, action] = useActionState(
    item ? updateShoppingItemAction : createShoppingItemAction,
    initialActionState,
  );
  const suffix = item?.id ?? "new";
  useCloseFormSheetOnSuccess(state.success);

  return (
    <form action={action} className="flex min-w-0 flex-col gap-4">
      <input type="hidden" name="householdId" value={householdId} />
      {item ? <input type="hidden" name="itemId" value={item.id} /> : null}
      <Field label="ของที่ต้องซื้อ" htmlFor={`shopping-name-${suffix}`}>
        <Input
          id={`shopping-name-${suffix}`}
          name="name"
          maxLength={120}
          required
          autoFocus
          placeholder="เช่น อาหารแมว"
          defaultValue={item?.name}
        />
      </Field>
      <TwoColumnFieldGrid>
        <Field label="จำนวน" htmlFor={`shopping-quantity-${suffix}`}>
          <Input
            id={`shopping-quantity-${suffix}`}
            name="quantity"
            type="number"
            inputMode="decimal"
            min="0.001"
            step="0.001"
            defaultValue={item ? String(item.quantity) : "1"}
            required
          />
        </Field>
        <Field label="หน่วย" htmlFor={`shopping-unit-${suffix}`}>
          <Input
            id={`shopping-unit-${suffix}`}
            name="unit"
            maxLength={40}
            placeholder="ถุง / ชิ้น / กก."
            defaultValue={item?.unit ?? ""}
          />
        </Field>
      </TwoColumnFieldGrid>
      <Field label="ร้าน" htmlFor={`shopping-store-${suffix}`}>
        <Input
          id={`shopping-store-${suffix}`}
          name="store"
          maxLength={120}
          placeholder="ระบุร้านหรือสถานที่ (ถ้ามี)"
          defaultValue={item?.store ?? ""}
        />
      </Field>
      <Field label="ผู้รับผิดชอบ" htmlFor={`shopping-assignee-${suffix}`}>
        <Select
          id={`shopping-assignee-${suffix}`}
          name="assignedMemberId"
          defaultValue={item?.assigned_member_id ?? ""}
        >
          <option value="">ยังไม่มอบหมาย</option>
          {members.map((member) => (
            <option key={member.id} value={member.id}>
              {member.label}
            </option>
          ))}
        </Select>
      </Field>
      <TwoColumnFieldGrid>
        <Field label="งบประมาณ" htmlFor={`shopping-budget-${suffix}`}>
          <Input
            id={`shopping-budget-${suffix}`}
            name="estimatedAmount"
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            defaultValue={
              item?.estimated_amount ? String(item.estimated_amount) : ""
            }
          />
        </Field>
        <Field label="สกุลเงิน" htmlFor={`shopping-currency-${suffix}`}>
          <Select
            id={`shopping-currency-${suffix}`}
            name="currency"
            defaultValue={item?.currency ?? "THB"}
          >
            <option value="THB">THB</option>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
            <option value="JPY">JPY</option>
            <option value="CNY">CNY</option>
          </Select>
        </Field>
      </TwoColumnFieldGrid>
      <Field label="หมายเหตุ" htmlFor={`shopping-note-${suffix}`}>
        <Textarea
          id={`shopping-note-${suffix}`}
          name="note"
          maxLength={500}
          placeholder="ยี่ห้อ ขนาด หรือรายละเอียดเพิ่มเติม"
          defaultValue={item?.note ?? ""}
        />
      </Field>
      {state.error ? (
        <p aria-live="polite" className="text-sm text-danger">
          {state.error}
        </p>
      ) : null}
      <SubmitButton size="lg">
        {item ? "บันทึกการแก้ไข" : "เพิ่มในรายการ"}
      </SubmitButton>
    </form>
  );
}
