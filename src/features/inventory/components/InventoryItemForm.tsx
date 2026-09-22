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
import { createInventoryItemAction } from "../actions";

export function InventoryItemForm({ householdId }: { householdId: string }) {
  const [state, action] = useActionState(
    createInventoryItemAction,
    initialActionState,
  );
  useCloseFormSheetOnSuccess(state.success);
  return (
    <form action={action} className="flex min-w-0 flex-col gap-4">
      <input type="hidden" name="householdId" value={householdId} />
      <Field label="ชื่อของ" htmlFor="inventory-name">
        <Input
          id="inventory-name"
          name="name"
          required
          maxLength={120}
          autoFocus
          placeholder="เช่น อาหารแมว ยาประจำบ้าน"
        />
      </Field>
      <Field label="หมวด" htmlFor="inventory-category">
        <Select
          id="inventory-category"
          name="category"
          defaultValue="HOUSEHOLD"
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
        <Field label="จำนวนคงเหลือ" htmlFor="inventory-quantity">
          <Input
            id="inventory-quantity"
            name="quantity"
            type="number"
            min="0"
            step="0.001"
            defaultValue="1"
            required
          />
        </Field>
        <Field label="หน่วย" htmlFor="inventory-unit">
          <Input
            id="inventory-unit"
            name="unit"
            maxLength={40}
            placeholder="ชิ้น / ถุง / กล่อง"
          />
        </Field>
      </TwoColumnFieldGrid>
      <Field label="เตือนให้ซื้อเมื่อเหลือ" htmlFor="inventory-threshold">
        <Input
          id="inventory-threshold"
          name="restockThreshold"
          type="number"
          min="0"
          step="0.001"
          placeholder="เว้นว่างหากไม่ต้องเตือน"
        />
      </Field>
      <TwoColumnFieldGrid>
        <Field label="วันหมดอายุ" htmlFor="inventory-expiry">
          <Input id="inventory-expiry" name="expiryDate" type="date" />
        </Field>
        <Field label="ประกันถึงวันที่" htmlFor="inventory-warranty">
          <Input id="inventory-warranty" name="warrantyExpiresOn" type="date" />
        </Field>
      </TwoColumnFieldGrid>
      <TwoColumnFieldGrid>
        <Field label="วันที่ซื้อ" htmlFor="inventory-purchase">
          <Input id="inventory-purchase" name="purchaseDate" type="date" />
        </Field>
        <Field label="เก็บไว้ที่" htmlFor="inventory-location">
          <Input
            id="inventory-location"
            name="location"
            maxLength={120}
            placeholder="เช่น ตู้ครัว"
          />
        </Field>
      </TwoColumnFieldGrid>
      <TwoColumnFieldGrid>
        <Field label="งบเติมของ" htmlFor="inventory-amount">
          <Input
            id="inventory-amount"
            name="estimatedRestockAmount"
            inputMode="decimal"
            placeholder="0.00"
          />
        </Field>
        <Field label="สกุลเงิน" htmlFor="inventory-currency">
          <Select id="inventory-currency" name="currency" defaultValue="THB">
            <option>THB</option>
            <option>USD</option>
            <option>EUR</option>
            <option>JPY</option>
            <option>CNY</option>
          </Select>
        </Field>
      </TwoColumnFieldGrid>
      <Field label="หมายเหตุ" htmlFor="inventory-note">
        <Textarea
          id="inventory-note"
          name="note"
          maxLength={1000}
          placeholder="ยี่ห้อ รุ่น วิธีใช้ หรือรายละเอียดอื่น"
        />
      </Field>
      {state.error ? (
        <p aria-live="polite" className="text-sm text-danger">
          {state.error}
        </p>
      ) : null}
      <SubmitButton size="lg">เพิ่มเข้าคลัง</SubmitButton>
    </form>
  );
}
