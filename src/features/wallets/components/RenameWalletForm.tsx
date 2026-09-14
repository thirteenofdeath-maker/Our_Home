"use client";

import { useActionState } from "react";

import { Field, Input, Select } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { initialActionState } from "@/lib/types/action-state";

import { updateWalletAction } from "../actions";
import type { Wallet } from "../types";

const WALLET_TYPES = [
  { value: "BANK", label: "บัญชีธนาคาร" },
  { value: "CASH", label: "เงินสด" },
  { value: "CREDIT_CARD", label: "บัตรเครดิต" },
  { value: "E_WALLET", label: "e-Wallet" },
  { value: "OTHER", label: "อื่น ๆ" },
] as const;

/**
 * Currency is always shown editable here — the database
 * (`wallets_before_update_currency_history_guard`, 0030) is the single
 * source of truth for whether it may actually change (only while this
 * wallet has zero transaction history), and its rejection surfaces as
 * `state.error` rather than being guessed at client-side.
 */
export function RenameWalletForm({ wallet }: { wallet: Wallet }) {
  const [state, formAction] = useActionState(updateWalletAction, initialActionState);

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4">
      <input type="hidden" name="walletId" value={wallet.id} />

      <Field label="ชื่อกระเป๋าเงิน" htmlFor="wallet-name">
        <Input id="wallet-name" name="name" type="text" defaultValue={wallet.name} required />
      </Field>

      <Field label="ประเภท" htmlFor="wallet-type">
        <Select id="wallet-type" name="walletType" defaultValue={wallet.wallet_type}>
          {WALLET_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="สกุลเงิน" htmlFor="wallet-currency">
        <Input id="wallet-currency" name="currency" type="text" defaultValue={wallet.currency} maxLength={3} required />
      </Field>

      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
      <SubmitButton size="md">บันทึกการแก้ไข</SubmitButton>
    </form>
  );
}
