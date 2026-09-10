"use client";

import { useActionState, useMemo, useState } from "react";

import { Field, Input, Select } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import type { CategoryNode } from "@/features/categories/types";
import type { Pocket } from "@/features/pockets/types";
import { CategorySelect } from "@/features/templates/components/CategorySelect";
import { TagPicker } from "@/features/tags/components/TagPicker";
import type { TagOption } from "@/features/tags/types";
import type { Wallet } from "@/features/wallets/types";
import { initialActionState } from "@/lib/types/action-state";

import { updateRecurringAction } from "../actions";
import type { RecurringFrequency, RecurringSummary } from "../types";

export function EditRecurringForm({
  rule,
  wallets,
  pocketsByWallet,
  categories,
  tags,
}: {
  rule: RecurringSummary;
  wallets: Wallet[];
  pocketsByWallet: Record<string, Pocket[]>;
  categories: CategoryNode[];
  tags: TagOption[];
}) {
  const [state, formAction] = useActionState(updateRecurringAction, initialActionState);
  const [walletId, setWalletId] = useState(rule.walletArchived ? "" : rule.walletId ?? "");
  const [frequency, setFrequency] = useState<RecurringFrequency>(rule.frequency);
  const pockets = useMemo(() => (walletId ? pocketsByWallet[walletId] ?? [] : []), [pocketsByWallet, walletId]);
  const currentActiveTags = rule.tags.filter((t) => !t.archivedAt);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={rule.recurringId} />

      <Field label="ชื่อรายการประจำ" htmlFor="name">
        <Input id="name" name="name" type="text" defaultValue={rule.name} required autoFocus />
      </Field>

      {rule.walletArchived ? <p className="text-sm text-danger">Wallet ที่บันทึกไว้ ({rule.walletName}) ถูกเก็บถาวรแล้ว กรุณาเลือก Wallet ใหม่</p> : null}
      {rule.pocketArchived ? <p className="text-sm text-danger">Pocket ที่บันทึกไว้ ({rule.pocketName}) ถูกเก็บถาวรแล้ว กรุณาเลือก Pocket ใหม่</p> : null}
      {rule.categoryArchived ? <p className="text-sm text-danger">หมวดหมู่ที่บันทึกไว้ ({rule.categoryName}) ถูกเก็บถาวรแล้ว กรุณาเลือกใหม่</p> : null}

      <Field label="จำนวนเงิน" htmlFor="amount">
        <Input id="amount" name="amount" type="text" inputMode="decimal" defaultValue={rule.amount} placeholder="0.00" required />
      </Field>

      <Field label="Wallet (ถ้ามี)" htmlFor="walletId">
        <Select id="walletId" name="walletId" value={walletId} onChange={(e) => setWalletId(e.target.value)}>
          <option value="">ไม่กำหนด — เลือกตอนบันทึกรายการ</option>
          {wallets.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </Select>
      </Field>

      {walletId ? (
        <Field label="Pocket (ถ้ามี)" htmlFor="pocketId">
          <Select id="pocketId" name="pocketId" defaultValue={walletId === rule.walletId ? rule.pocketId ?? "" : ""}>
            <option value="">ไม่กำหนด</option>
            {pockets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}

      <Field label="หมวดหมู่ (ถ้ามี)" htmlFor="categoryId">
        <CategorySelect categories={categories} defaultValue={rule.categoryArchived ? "" : rule.categoryId ?? ""} />
      </Field>

      <fieldset className="flex flex-col gap-3 rounded-card border border-border p-3">
        <legend className="mb-1 text-sm font-medium text-foreground-muted">รอบความถี่</legend>
        <p className="text-xs text-foreground-muted">
          การแก้ไขรอบความถี่จะสร้างรายการที่ยังไม่ถึงกำหนด (UPCOMING) ใหม่ทั้งหมด — ประวัติที่บันทึกแล้วหรือข้ามแล้วจะไม่เปลี่ยนแปลง
        </p>

        <Field label="เริ่มวันที่" htmlFor="startDate">
          <Input id="startDate" name="startDate" type="date" defaultValue={rule.startDate} required />
        </Field>

        <Field label="ความถี่" htmlFor="frequency">
          <Select id="frequency" name="frequency" value={frequency} onChange={(e) => setFrequency(e.target.value as RecurringFrequency)}>
            <option value="WEEKLY">ทุกสัปดาห์</option>
            <option value="MONTHLY">ทุกเดือน</option>
            <option value="YEARLY">ทุกปี</option>
          </Select>
        </Field>

        <Field label={`ทุก [n] ${frequency === "WEEKLY" ? "สัปดาห์" : frequency === "MONTHLY" ? "เดือน" : "ปี"}`} htmlFor="intervalCount">
          <Input id="intervalCount" name="intervalCount" type="number" min={1} step={1} defaultValue={rule.intervalCount} required />
        </Field>

        <Field label="สิ้นสุด (ถ้ามี)" htmlFor="endDate">
          <Input id="endDate" name="endDate" type="date" defaultValue={rule.endDate ?? ""} />
        </Field>
      </fieldset>

      <Field label="ชื่อรายการ (ถ้ามี)" htmlFor="title">
        <Input id="title" name="title" type="text" defaultValue={rule.title ?? ""} />
      </Field>

      <Field label="โน้ต (ถ้ามี)" htmlFor="note">
        <Input id="note" name="note" type="text" defaultValue={rule.note ?? ""} />
      </Field>

      <Field label="แท็ก (ถ้ามี)" htmlFor="tagIds">
        <TagPicker name="tagIds" tags={tags} walletId={walletId || undefined} personalScopeOnly={rule.scope === "PERSONAL"} defaultSelected={currentActiveTags} />
      </Field>

      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
      <SubmitButton size="lg">บันทึกการแก้ไข</SubmitButton>
    </form>
  );
}
