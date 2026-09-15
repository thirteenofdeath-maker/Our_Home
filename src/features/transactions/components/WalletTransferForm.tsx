"use client";

import { useActionState, useMemo, useState } from "react";

import { Field, Input } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { FinanceOptionField } from "@/features/finance/components/FinanceOptionField";
import type { Pocket } from "@/features/pockets/types";
import { TagPicker } from "@/features/tags/components/TagPicker";
import type { TagOption } from "@/features/tags/types";
import type { Wallet } from "@/features/wallets/types";
import { initialActionState } from "@/lib/types/action-state";
import { cn } from "@/lib/utils/cn";

import { createWalletTransferAction } from "../actions";

export function WalletTransferForm({
  fromWallet,
  fromPockets,
  otherWallets,
  pocketsByWallet,
  tags,
  variant = "page",
}: {
  fromWallet: Wallet;
  fromPockets: Pocket[];
  otherWallets: Wallet[];
  pocketsByWallet: Record<string, Pocket[]>;
  tags: TagOption[];
  /** Presentation only — see TransactionForm.tsx's own `variant` doc. */
  variant?: "page" | "sheet";
}) {
  const [state, formAction] = useActionState(createWalletTransferAction, initialActionState);
  const [toWalletId, setToWalletId] = useState(otherWallets[0]?.id ?? "");
  const [fromPocketId, setFromPocketId] = useState(fromPockets[0]?.id ?? "");
  const [toPocketId, setToPocketId] = useState(
    pocketsByWallet[otherWallets[0]?.id ?? ""]?.[0]?.id ?? "",
  );
  const toPockets = useMemo(() => pocketsByWallet[toWalletId] ?? [], [pocketsByWallet, toWalletId]);
  const today = new Date().toLocaleDateString("en-CA");

  return (
    <form
      action={formAction}
      className={cn("finance-ui-tone", variant === "sheet" ? "flex flex-col gap-4" : "flex flex-col gap-4 rounded-card bg-surface p-4 shadow-card")}
    >
      <input type="hidden" name="fromWalletId" value={fromWallet.id} />

      <FinanceOptionField
        label="Pocket ต้นทาง"
        title="เลือก Pocket ต้นทาง"
        name="fromPocketId"
        options={fromPockets.map((pocket) => ({
          id: pocket.id,
          label: pocket.name,
          description: `${fromWallet.name} · ${pocket.currency}`,
        }))}
        value={fromPocketId}
        onChange={setFromPocketId}
      />

      <FinanceOptionField
        label="Wallet ปลายทาง"
        title="เลือก Wallet ปลายทาง"
        name="toWalletId"
        options={otherWallets.map((wallet) => ({ id: wallet.id, label: wallet.name }))}
        value={toWalletId}
        onChange={(nextWalletId) => {
          setToWalletId(nextWalletId);
          setToPocketId(pocketsByWallet[nextWalletId]?.[0]?.id ?? "");
        }}
      />

      <FinanceOptionField
        label="Pocket ปลายทาง"
        title="เลือก Pocket ปลายทาง"
        name="toPocketId"
        options={toPockets.map((pocket) => ({
          id: pocket.id,
          label: pocket.name,
          description: pocket.currency,
        }))}
        value={toPocketId}
        onChange={setToPocketId}
        disabled={!toWalletId}
      />

      <Field label="จำนวนเงิน" htmlFor="amount">
        <Input id="amount" name="amount" type="text" inputMode="decimal" placeholder="0.00" required />
      </Field>

      <Field label="ชื่อรายการ (ถ้ามี)" htmlFor="title"><Input id="title" name="title" type="text" /></Field>
      <Field label="โน้ต (ถ้ามี)" htmlFor="note"><Input id="note" name="note" type="text" /></Field>
      <Field label="วันที่" htmlFor="occurredAt"><Input id="occurredAt" name="occurredAt" type="date" defaultValue={today} required /></Field>

      <Field label="แท็ก (ถ้ามี)" htmlFor="tagIds">
        <TagPicker name="tagIds" tags={tags} walletId={fromWallet.id} />
      </Field>

      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
      <SubmitButton size="lg" variant="financeTransfer">โอนเงิน</SubmitButton>
    </form>
  );
}
