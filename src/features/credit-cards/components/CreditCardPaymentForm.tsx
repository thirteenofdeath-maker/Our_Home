"use client";

import { useActionState, useMemo, useState } from "react";

import { Field, Input, Select } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import type { Pocket } from "@/features/pockets/types";
import type { Wallet } from "@/features/wallets/types";
import { initialActionState } from "@/lib/types/action-state";
import { formatCurrency } from "@/lib/utils/money";

import { createCreditCardPaymentAction } from "../actions";
import type { CreditCardAccount } from "../types";

export function CreditCardPaymentForm({
  card,
  wallets,
  pocketsByWallet,
}: {
  card: CreditCardAccount;
  wallets: Wallet[];
  pocketsByWallet: Record<string, Pocket[]>;
}) {
  const [state, action] = useActionState(createCreditCardPaymentAction, initialActionState);
  const [walletId, setWalletId] = useState(wallets[0]?.id ?? "");
  const pockets = useMemo(() => pocketsByWallet[walletId] ?? [], [pocketsByWallet, walletId]);
  const today = new Date().toLocaleDateString("en-CA");
  const canSubmit = Boolean(walletId && pockets.length && Number(card.liability) > 0);

  return (
    <form action={action} className="flex flex-col gap-4 rounded-card bg-finance-surface-strong p-4 shadow-card">
      <input type="hidden" name="cardAccountId" value={card.accountId} />
      <div className="rounded-control bg-finance-primary-soft p-3 text-sm">
        <div className="flex justify-between gap-3 font-medium">
          <span>ยอดค้างชำระ</span>
          <span>{formatCurrency(card.liability, card.currency)}</span>
        </div>
        <p className="mt-2 text-xs text-finance-muted">
          เงินจะย้ายจาก Wallet ที่เลือกเข้าบัตร รายการนี้ไม่ถูกนับเป็นรายจ่ายซ้ำ
        </p>
      </div>

      {wallets.length ? (
        <>
          <Field label="จ่ายจาก Wallet" htmlFor="fromWalletId">
            <Select
              id="fromWalletId"
              name="fromWalletId"
              value={walletId}
              onChange={(event) => setWalletId(event.currentTarget.value)}
            >
              {wallets.map((wallet) => (
                <option key={wallet.id} value={wallet.id}>{wallet.name} · {wallet.currency}</option>
              ))}
            </Select>
          </Field>
          <Field label="จ่ายจาก Pocket" htmlFor="fromPocketId">
            <Select key={walletId} id="fromPocketId" name="fromPocketId" defaultValue={pockets[0]?.id ?? ""} required>
              {pockets.map((pocket) => <option key={pocket.id} value={pocket.id}>{pocket.name}</option>)}
            </Select>
          </Field>
        </>
      ) : (
        <p role="alert" className="rounded-control border border-danger/30 bg-danger/5 p-3 text-sm text-danger">
          ยังไม่มี Wallet {card.scope === "PERSONAL" ? "ส่วนตัว" : "ครอบครัว"}สกุล {card.currency} ที่ใช้จ่ายบัตรได้
        </p>
      )}

      <Field label="จำนวนเงินที่จ่าย" htmlFor="amount">
        <Input id="amount" name="amount" inputMode="decimal" placeholder="0.00" max={card.liability} required autoFocus />
      </Field>
      <Field label="วันที่จ่าย" htmlFor="occurredAt">
        <Input id="occurredAt" name="occurredAt" type="date" defaultValue={today} required />
      </Field>
      <Field label="ชื่อรายการ" htmlFor="title"><Input id="title" name="title" placeholder="เช่น จ่ายยอดบัตร" /></Field>
      <Field label="โน้ต" htmlFor="note"><Input id="note" name="note" /></Field>

      {state.error ? <p role="alert" className="text-sm text-danger">{state.error}</p> : null}
      <div className="sticky bottom-3 z-10">
        <SubmitButton size="lg" variant="financeTransfer" disabled={!canSubmit}>บันทึกการจ่ายบัตร</SubmitButton>
      </div>
    </form>
  );
}
