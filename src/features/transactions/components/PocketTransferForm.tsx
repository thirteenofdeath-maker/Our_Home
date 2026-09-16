"use client";

import { useActionState, useState } from "react";

import { Field, Input } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { FinanceOptionField } from "@/features/finance/components/FinanceOptionField";
import type { Pocket } from "@/features/pockets/types";
import { TagPicker } from "@/features/tags/components/TagPicker";
import type { TagOption } from "@/features/tags/types";
import { initialActionState } from "@/lib/types/action-state";
import { cn } from "@/lib/utils/cn";

import { createPocketTransferAction } from "../actions";

export function PocketTransferForm({
  walletId,
  pockets,
  tags,
  variant = "page",
}: {
  walletId: string;
  pockets: Pocket[];
  tags: TagOption[];
  /** Presentation only — see TransactionForm.tsx's own `variant` doc. */
  variant?: "page" | "sheet";
}) {
  const [state, formAction] = useActionState(createPocketTransferAction, initialActionState);
  const today = new Date().toLocaleDateString("en-CA");
  const defaults = getPocketTransferDefaults(pockets);
  const [fromPocketId, setFromPocketId] = useState(defaults?.fromPocketId ?? "");
  const [toPocketId, setToPocketId] = useState(defaults?.toPocketId ?? "");
  const pocketOptions = pockets.map((pocket) => ({
    id: pocket.id,
    label: pocket.name,
    description: pocket.currency,
  }));

  return (
    <form
      action={formAction}
      className={cn("finance-ui-tone", variant === "sheet" ? "flex flex-col gap-4" : "flex flex-col gap-4 rounded-card bg-surface p-4 shadow-card")}
    >
      <input type="hidden" name="walletId" value={walletId} />

      <FinanceOptionField
        label="จากช่อง"
        title="เลือก Pocket ต้นทาง"
        name="fromPocketId"
        options={pocketOptions.map((option) => ({
          ...option,
          disabled: option.id === toPocketId,
        }))}
        value={fromPocketId}
        onChange={setFromPocketId}
      />

      <FinanceOptionField
        label="ไปยังช่อง"
        title="เลือก Pocket ปลายทาง"
        name="toPocketId"
        options={pocketOptions.map((option) => ({
          ...option,
          disabled: option.id === fromPocketId,
        }))}
        value={toPocketId}
        onChange={setToPocketId}
      />

      <Field label="จำนวนเงิน" htmlFor="amount">
        <Input id="amount" name="amount" type="text" inputMode="decimal" placeholder="0.00" required />
      </Field>

      <Field label="ชื่อรายการ (ถ้ามี)" htmlFor="title"><Input id="title" name="title" type="text" /></Field>
      <Field label="โน้ต (ถ้ามี)" htmlFor="note"><Input id="note" name="note" type="text" /></Field>
      <Field label="วันที่" htmlFor="occurredAt"><Input id="occurredAt" name="occurredAt" type="date" defaultValue={today} required /></Field>

      <Field label="แท็ก (ถ้ามี)" htmlFor="tagIds">
        <TagPicker name="tagIds" tags={tags} walletId={walletId} />
      </Field>

      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
      <SubmitButton size="lg" variant="financeTransfer">โอนเงิน</SubmitButton>
    </form>
  );
}

/**
 * UI convenience only — pre-selects the first two distinct pockets (by
 * the stable, sort_order-based list order) so the two pickers aren't both
 * blank. No pocket is a domain default; nothing here is persisted.
 * The Server Action independently re-validates source != destination.
 */
export function getPocketTransferDefaults(pockets: Pocket[]): { fromPocketId: string; toPocketId: string } | null {
  if (pockets.length < 2) return null;
  const [source, destination] = pockets;
  return { fromPocketId: source.id, toPocketId: destination.id };
}
