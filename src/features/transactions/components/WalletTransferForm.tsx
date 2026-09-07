"use client";

import { useActionState, useMemo, useState } from "react";

import { Field, Input, Select } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import type { Pocket } from "@/features/pockets/types";
import type { Wallet } from "@/features/wallets/types";
import { initialActionState } from "@/lib/types/action-state";

import { createWalletTransferAction } from "../actions";

export function WalletTransferForm({
  fromWallet,
  fromPockets,
  otherWallets,
  pocketsByWallet,
}: {
  fromWallet: Wallet;
  fromPockets: Pocket[];
  otherWallets: Wallet[];
  pocketsByWallet: Record<string, Pocket[]>;
}) {
  const [state, formAction] = useActionState(createWalletTransferAction, initialActionState);
  const [toWalletId, setToWalletId] = useState(otherWallets[0]?.id ?? "");
  const toPockets = useMemo(() => pocketsByWallet[toWalletId] ?? [], [pocketsByWallet, toWalletId]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="fromWalletId" value={fromWallet.id} />

      <Field label="จากกระเป๋าเงิน" htmlFor="fromPocketId">
        <p className="text-sm text-foreground-muted">{fromWallet.name}</p>
        <Select id="fromPocketId" name="fromPocketId" required>
          {fromPockets.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="ไปยังกระเป๋าเงิน" htmlFor="toWalletId">
        <Select
          id="toWalletId"
          name="toWalletId"
          required
          value={toWalletId}
          onChange={(e) => setToWalletId(e.target.value)}
        >
          {otherWallets.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="ช่องปลายทาง" htmlFor="toPocketId">
        <Select key={toWalletId} id="toPocketId" name="toPocketId" required>
          {toPockets.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="จำนวนเงิน" htmlFor="amount">
        <Input id="amount" name="amount" type="text" inputMode="decimal" placeholder="0.00" required />
      </Field>

      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
      <SubmitButton size="lg">โอนเงิน</SubmitButton>
    </form>
  );
}
