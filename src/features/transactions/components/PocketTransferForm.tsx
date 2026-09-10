"use client";

import { useActionState } from "react";

import { Field, Input, Select } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import type { Pocket } from "@/features/pockets/types";
import { TagPicker } from "@/features/tags/components/TagPicker";
import type { TagOption } from "@/features/tags/types";
import { initialActionState } from "@/lib/types/action-state";

import { createPocketTransferAction } from "../actions";

export function PocketTransferForm({ walletId, pockets, tags }: { walletId: string; pockets: Pocket[]; tags: TagOption[] }) {
  const [state, formAction] = useActionState(createPocketTransferAction, initialActionState);
  const today = new Date().toLocaleDateString("en-CA");
  const defaults = getPocketTransferDefaults(pockets);

  return (
    <form action={formAction} className="flex flex-col gap-4 rounded-card bg-surface p-4 shadow-card">
      <input type="hidden" name="walletId" value={walletId} />

      <Field label="จากช่อง" htmlFor="fromPocketId">
        <Select id="fromPocketId" name="fromPocketId" required defaultValue={defaults?.fromPocketId}>
          {pockets.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="ไปยังช่อง" htmlFor="toPocketId">
        <Select id="toPocketId" name="toPocketId" required defaultValue={defaults?.toPocketId}>
          {pockets.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </Field>

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
      <SubmitButton size="lg">โอนเงิน</SubmitButton>
    </form>
  );
}

/**
 * UI convenience only — pre-selects the first two distinct pockets (by
 * the stable, sort_order-based list order) so the two <select>s aren't
 * both blank. No pocket is a domain default; nothing here is persisted.
 * The Server Action independently re-validates source != destination.
 */
export function getPocketTransferDefaults(pockets: Pocket[]): { fromPocketId: string; toPocketId: string } | null {
  if (pockets.length < 2) return null;
  const [source, destination] = pockets;
  return { fromPocketId: source.id, toPocketId: destination.id };
}
