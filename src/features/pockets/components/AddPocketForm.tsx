"use client";

import { useActionState, useState } from "react";

import {
  Field,
  Input,
  Select,
  TwoColumnFieldGrid,
} from "@/components/ui/Field";
import { useCloseFormSheetOnSuccess } from "@/components/ui/FormSheetButton";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { initialActionState } from "@/lib/types/action-state";
import { cn } from "@/lib/utils/cn";

import { createPocketAction } from "../actions";

export function AddPocketForm({
  walletId,
  variant = "page",
}: {
  walletId: string;
  variant?: "page" | "sheet";
}) {
  const [state, formAction] = useActionState(
    createPocketAction,
    initialActionState,
  );
  useCloseFormSheetOnSuccess(state.success);
  const [pocketType, setPocketType] = useState("CASH");

  return (
    <form
      action={formAction}
      className={cn(
        "finance-ui-tone",
        variant === "sheet"
          ? "flex flex-col gap-4"
          : "flex flex-col gap-4 rounded-card bg-surface p-4 shadow-card",
      )}
    >
      <input type="hidden" name="walletId" value={walletId} />
      {variant === "sheet" ? <input type="hidden" name="formMode" value="sheet" /> : null}
      <Field label="ชื่อ Pocket" htmlFor="name">
        <Input
          id="name"
          name="name"
          placeholder="เช่น เงินสด, USD, KTC"
          required
          autoFocus
        />
      </Field>
      <Field label="ประเภท" htmlFor="pocketType">
        <Select
          id="pocketType"
          name="pocketType"
          value={pocketType}
          onChange={(event) => setPocketType(event.target.value)}
        >
          <option value="BANK">บัญชีธนาคาร</option>
          <option value="CASH">เงินสด</option>
          <option value="E_WALLET">e-Wallet</option>
          <option value="CREDIT_CARD">บัตรเครดิต</option>
          <option value="OTHER">อื่น ๆ</option>
        </Select>
      </Field>
      <Field label="สกุลเงิน" htmlFor="currency">
        <Input
          id="currency"
          name="currency"
          defaultValue="THB"
          maxLength={3}
          required
        />
      </Field>
      {pocketType === "CREDIT_CARD" ? (
        <div className="flex flex-col gap-3 rounded-[1.15rem] bg-finance-primary-soft/60 p-3">
          <TwoColumnFieldGrid>
            <Field label="วงเงินทั้งหมด" htmlFor="creditLimit">
              <Input
                id="creditLimit"
                name="creditLimit"
                inputMode="decimal"
                placeholder="0.00"
                required
              />
            </Field>
            <Field label="วงเงินคงเหลือ" htmlFor="availableCredit">
              <Input
                id="availableCredit"
                name="availableCredit"
                inputMode="decimal"
                placeholder="0.00"
                required
              />
            </Field>
          </TwoColumnFieldGrid>
          <TwoColumnFieldGrid>
            <Field label="วันตัดรอบ" htmlFor="statementClosingDay">
              <Input
                id="statementClosingDay"
                name="statementClosingDay"
                type="number"
                min={1}
                max={31}
                defaultValue={25}
                required
              />
            </Field>
            <Field label="วันครบกำหนด" htmlFor="paymentDueDay">
              <Input
                id="paymentDueDay"
                name="paymentDueDay"
                type="number"
                min={1}
                max={31}
                defaultValue={10}
                required
              />
            </Field>
          </TwoColumnFieldGrid>
        </div>
      ) : (
        <Field label="ยอดเงินเริ่มต้น (ถ้ามี)" htmlFor="initialBalance">
          <Input
            id="initialBalance"
            name="initialBalance"
            inputMode="decimal"
            defaultValue="0"
            required
          />
        </Field>
      )}
      {state.error ? (
        <p className="text-sm text-danger">{state.error}</p>
      ) : null}
      <SubmitButton size="lg">เพิ่ม Pocket</SubmitButton>
    </form>
  );
}
