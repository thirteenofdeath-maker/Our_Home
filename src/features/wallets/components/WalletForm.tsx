"use client";

import { useActionState, useState } from "react";

import { Field, Input, Select } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { initialActionState } from "@/lib/types/action-state";
import { cn } from "@/lib/utils/cn";

import { createWalletAction } from "../actions";

const WALLET_TYPES = [
  { value: "BANK", label: "บัญชีธนาคาร" },
  { value: "CASH", label: "เงินสด" },
  { value: "CREDIT_CARD", label: "บัตรเครดิต" },
  { value: "E_WALLET", label: "e-Wallet" },
  { value: "OTHER", label: "อื่น ๆ" },
] as const;

export function WalletForm({
  defaultScope,
  hasHousehold,
  variant = "page",
}: {
  defaultScope: "PERSONAL" | "HOUSEHOLD";
  hasHousehold: boolean;
  /** Presentation only — see TransactionForm.tsx's own `variant` doc. */
  variant?: "page" | "sheet";
}) {
  const [state, formAction] = useActionState(
    createWalletAction,
    initialActionState,
  );
  const [scope, setScope] = useState(defaultScope);
  const [walletType, setWalletType] =
    useState<(typeof WALLET_TYPES)[number]["value"]>("BANK");

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
      <Field label="ชื่อกระเป๋าเงิน" htmlFor="name">
        <Input
          id="name"
          name="name"
          type="text"
          placeholder="เช่น KBank, เงินสด"
          required
        />
      </Field>

      <Field label="ชื่อ Pocket แรก" htmlFor="firstPocketName">
        <Input
          id="firstPocketName"
          name="firstPocketName"
          type="text"
          placeholder="เช่น เงินใช้จ่าย, KTC, เงินเก็บ"
          required
        />
      </Field>

      <Field label="ประเภท Pocket แรก" htmlFor="walletType">
        <Select
          id="walletType"
          name="walletType"
          value={walletType}
          onChange={(event) =>
            setWalletType(
              event.target.value as (typeof WALLET_TYPES)[number]["value"],
            )
          }
        >
          {WALLET_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="สกุลเงินของ Pocket" htmlFor="currency">
        <Input
          id="currency"
          name="currency"
          type="text"
          defaultValue="THB"
          maxLength={3}
          required
        />
      </Field>

      {walletType === "CREDIT_CARD" ? (
        <div className="flex flex-col gap-3 rounded-[1.15rem] bg-finance-primary-soft/60 p-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="วงเงินทั้งหมด" htmlFor="creditLimit">
              <Input
                id="creditLimit"
                name="creditLimit"
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                required
              />
            </Field>
            <Field label="วงเงินคงเหลือ" htmlFor="availableCredit">
              <Input
                id="availableCredit"
                name="availableCredit"
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                required
              />
            </Field>
          </div>
          <p className="text-xs text-finance-muted">
            ระบบจะคำนวณยอดใช้ไปเริ่มต้นจากวงเงินทั้งหมดลบวงเงินคงเหลือ
          </p>
          <div className="grid grid-cols-2 gap-3">
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
            <Field label="วันครบกำหนดชำระ" htmlFor="paymentDueDay">
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
          </div>
        </div>
      ) : (
        <Field label="ยอดเงินเริ่มต้น (ถ้ามี)" htmlFor="initialBalance">
          <Input
            id="initialBalance"
            name="initialBalance"
            type="text"
            inputMode="decimal"
            defaultValue="0"
            placeholder="0.00"
            required
          />
        </Field>
      )}

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium text-foreground-muted">
          ประเภทกระเป๋าเงิน
        </legend>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="scope"
            value="PERSONAL"
            checked={scope === "PERSONAL"}
            onChange={() => setScope("PERSONAL")}
          />
          ส่วนตัว — เห็นเฉพาะคุณ
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
          ครอบครัว — สมาชิกครอบครัวเห็นร่วมกัน
          {!hasHousehold ? " (สร้างครอบครัวก่อน)" : ""}
        </label>
      </fieldset>

      {state.error ? (
        <p className="text-sm text-danger">{state.error}</p>
      ) : null}
      <SubmitButton size="lg">สร้างกระเป๋าเงิน</SubmitButton>
    </form>
  );
}
