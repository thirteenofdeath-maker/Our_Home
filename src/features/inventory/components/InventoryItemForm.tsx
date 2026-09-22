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
import {
  createInventoryItemAction,
  updateInventoryItemAction,
} from "../actions";
import type { InventoryItem } from "../types";

export function InventoryItemForm({
  householdId,
  item,
}: {
  householdId: string;
  item?: InventoryItem;
}) {
  const [state, action] = useActionState(
    item ? updateInventoryItemAction : createInventoryItemAction,
    initialActionState,
  );
  const suffix = item?.id ?? "new";
  useCloseFormSheetOnSuccess(state.success);
  return (
    <form action={action} className="flex min-w-0 flex-col gap-4">
      <input type="hidden" name="householdId" value={householdId} />
      {item ? <input type="hidden" name="itemId" value={item.id} /> : null}
      <Field label="ชื่อของ" htmlFor={`inventory-name-${suffix}`}>
        <Input
          id={`inventory-name-${suffix}`}
          name="name"
          required
          maxLength={120}
          autoFocus
          placeholder="เช่น อาหารแมว ยาประจำบ้าน"
          defaultValue={item?.name}
        />
      </Field>
      <Field label="หมวด" htmlFor={`inventory-category-${suffix}`}>
        <Select
          id={`inventory-category-${suffix}`}
          name="category"
          defaultValue={item?.category ?? "HOUSEHOLD"}
        >
          <option value="MEDICINE">ยา</option>
          <option value="PET_SUPPLY">ของสัตว์เลี้ยง</option>
          <option value="HOUSEHOLD">ของใช้ในบ้าน</option>
          <option value="FOOD">อาหาร</option>
          <option value="WARRANTY">สินค้าและประกัน</option>
          <option value="OTHER">อื่นๆ</option>
        </Select>
      </Field>
      <TwoColumnFieldGrid>
        <Field label="จำนวนคงเหลือ" htmlFor={`inventory-quantity-${suffix}`}>
          <Input
            id={`inventory-quantity-${suffix}`}
            name="quantity"
            type="number"
            min="0"
            step="0.001"
            defaultValue={item ? String(item.quantity) : "1"}
            required
          />
        </Field>
        <Field label="หน่วย" htmlFor={`inventory-unit-${suffix}`}>
          <Input
            id={`inventory-unit-${suffix}`}
            name="unit"
            maxLength={40}
            placeholder="ชิ้น / ถุง / กล่อง"
            defaultValue={item?.unit ?? ""}
          />
        </Field>
      </TwoColumnFieldGrid>
      <Field
        label="เตือนให้ซื้อเมื่อเหลือ"
        htmlFor={`inventory-threshold-${suffix}`}
      >
        <Input
          id={`inventory-threshold-${suffix}`}
          name="restockThreshold"
          type="number"
          min="0"
          step="0.001"
          placeholder="เว้นว่างหากไม่ต้องเตือน"
          defaultValue={
            item?.restock_threshold === null ||
            item?.restock_threshold === undefined
              ? ""
              : String(item.restock_threshold)
          }
        />
      </Field>
      <TwoColumnFieldGrid>
        <Field label="วันหมดอายุ" htmlFor={`inventory-expiry-${suffix}`}>
          <Input
            id={`inventory-expiry-${suffix}`}
            name="expiryDate"
            type="date"
            defaultValue={item?.expiry_date ?? ""}
          />
        </Field>
        <Field label="ประกันถึงวันที่" htmlFor={`inventory-warranty-${suffix}`}>
          <Input
            id={`inventory-warranty-${suffix}`}
            name="warrantyExpiresOn"
            type="date"
            defaultValue={item?.warranty_expires_on ?? ""}
          />
        </Field>
      </TwoColumnFieldGrid>
      <TwoColumnFieldGrid>
        <Field label="วันที่ซื้อ" htmlFor={`inventory-purchase-${suffix}`}>
          <Input
            id={`inventory-purchase-${suffix}`}
            name="purchaseDate"
            type="date"
            defaultValue={item?.purchase_date ?? ""}
          />
        </Field>
        <Field label="เก็บไว้ที่" htmlFor={`inventory-location-${suffix}`}>
          <Input
            id={`inventory-location-${suffix}`}
            name="location"
            maxLength={120}
            placeholder="เช่น ตู้ครัว"
            defaultValue={item?.location ?? ""}
          />
        </Field>
      </TwoColumnFieldGrid>
      <TwoColumnFieldGrid>
        <Field label="งบเติมของ" htmlFor={`inventory-amount-${suffix}`}>
          <Input
            id={`inventory-amount-${suffix}`}
            name="estimatedRestockAmount"
            inputMode="decimal"
            placeholder="0.00"
            defaultValue={
              item?.estimated_restock_amount
                ? String(item.estimated_restock_amount)
                : ""
            }
          />
        </Field>
        <Field label="สกุลเงิน" htmlFor={`inventory-currency-${suffix}`}>
          <Select
            id={`inventory-currency-${suffix}`}
            name="currency"
            defaultValue={item?.currency ?? "THB"}
          >
            <option>THB</option>
            <option>USD</option>
            <option>EUR</option>
            <option>JPY</option>
            <option>CNY</option>
          </Select>
        </Field>
      </TwoColumnFieldGrid>
      <Field label="หมายเหตุ" htmlFor={`inventory-note-${suffix}`}>
        <Textarea
          id={`inventory-note-${suffix}`}
          name="note"
          maxLength={1000}
          placeholder="ยี่ห้อ รุ่น วิธีใช้ หรือรายละเอียดอื่น"
          defaultValue={item?.note ?? ""}
        />
      </Field>
      {state.error ? (
        <p aria-live="polite" className="text-sm text-danger">
          {state.error}
        </p>
      ) : null}
      <SubmitButton size="lg">
        {item ? "บันทึกการแก้ไข" : "เพิ่มเข้าคลัง"}
      </SubmitButton>
    </form>
  );
}
