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
  const [state, formAction] = useActionState(createWalletAction, initialActionState);
  const [scope, setScope] = useState(defaultScope);

  return (
    <form
      action={formAction}
      className={cn("finance-ui-tone", variant === "sheet" ? "flex flex-col gap-4" : "flex flex-col gap-4 rounded-card bg-surface p-4 shadow-card")}
    >
      <Field label="ชื่อกระเป๋าเงิน" htmlFor="name">
        <Input id="name" name="name" type="text" placeholder="เช่น KBank, เงินสด" required />
      </Field>

      <Field label="ประเภท" htmlFor="walletType">
        <Select id="walletType" name="walletType" defaultValue="BANK">
          {WALLET_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="สกุลเงิน" htmlFor="currency">
        <Input id="currency" name="currency" type="text" defaultValue="THB" maxLength={3} required />
      </Field>

      <Field label="ช่องแรก (Pocket)" htmlFor="firstPocketName">
        <Input id="firstPocketName" name="firstPocketName" type="text" placeholder="เช่น ใช้จ่าย, เงินเก็บ" required />
      </Field>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium text-foreground-muted">ประเภทกระเป๋าเงิน</legend>
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
          ครอบครัว — สมาชิกครอบครัวเห็นร่วมกัน{!hasHousehold ? " (สร้างครอบครัวก่อน)" : ""}
        </label>
      </fieldset>

      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
      <SubmitButton size="lg">สร้างกระเป๋าเงิน</SubmitButton>
    </form>
  );
}
