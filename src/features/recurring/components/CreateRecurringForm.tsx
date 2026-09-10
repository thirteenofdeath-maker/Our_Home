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

import { createRecurringAction } from "../actions";
import type { RecurringFrequency } from "../types";

export function CreateRecurringForm({
  hasHousehold,
  personalWallets,
  householdWallets,
  pocketsByWallet,
  personalIncomeCategories,
  personalExpenseCategories,
  householdIncomeCategories,
  householdExpenseCategories,
  personalTags,
  householdTags,
}: {
  hasHousehold: boolean;
  personalWallets: Wallet[];
  householdWallets: Wallet[];
  pocketsByWallet: Record<string, Pocket[]>;
  personalIncomeCategories: CategoryNode[];
  personalExpenseCategories: CategoryNode[];
  householdIncomeCategories: CategoryNode[];
  householdExpenseCategories: CategoryNode[];
  personalTags: TagOption[];
  householdTags: TagOption[];
}) {
  const [state, formAction] = useActionState(createRecurringAction, initialActionState);
  const [scope, setScope] = useState<"PERSONAL" | "HOUSEHOLD">("PERSONAL");
  const [transactionType, setTransactionType] = useState<"INCOME" | "EXPENSE">("EXPENSE");
  const [walletId, setWalletId] = useState<string>("");
  const [frequency, setFrequency] = useState<RecurringFrequency>("MONTHLY");
  const today = new Date().toLocaleDateString("en-CA");

  const wallets = scope === "PERSONAL" ? personalWallets : householdWallets;
  const pockets = useMemo(() => (walletId ? pocketsByWallet[walletId] ?? [] : []), [pocketsByWallet, walletId]);
  const categories =
    scope === "PERSONAL"
      ? transactionType === "INCOME"
        ? personalIncomeCategories
        : personalExpenseCategories
      : transactionType === "INCOME"
        ? householdIncomeCategories
        : householdExpenseCategories;
  const tags = scope === "PERSONAL" ? personalTags : householdTags;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium text-foreground-muted">ประเภทรายการประจำ</legend>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="scope"
            value="PERSONAL"
            checked={scope === "PERSONAL"}
            onChange={() => {
              setScope("PERSONAL");
              setWalletId("");
            }}
          />
          ส่วนตัว
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="scope"
            value="HOUSEHOLD"
            checked={scope === "HOUSEHOLD"}
            onChange={() => {
              setScope("HOUSEHOLD");
              setWalletId("");
            }}
            disabled={!hasHousehold}
          />
          ครอบครัว{!hasHousehold ? " (สร้างครอบครัวก่อน)" : ""}
        </label>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium text-foreground-muted">ประเภท</legend>
        <label className="flex items-center gap-2 text-sm">
          <input type="radio" name="transactionType" value="EXPENSE" checked={transactionType === "EXPENSE"} onChange={() => setTransactionType("EXPENSE")} />
          รายจ่าย
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="radio" name="transactionType" value="INCOME" checked={transactionType === "INCOME"} onChange={() => setTransactionType("INCOME")} />
          รายรับ
        </label>
      </fieldset>

      <Field label="ชื่อรายการประจำ" htmlFor="name">
        <Input id="name" name="name" type="text" placeholder="เช่น เงินเดือน" required autoFocus />
      </Field>

      <Field label="จำนวนเงิน" htmlFor="amount">
        <Input id="amount" name="amount" type="text" inputMode="decimal" placeholder="0.00" required />
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
          <Select id="pocketId" name="pocketId" defaultValue="">
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
        <CategorySelect categories={categories} defaultValue="" />
      </Field>

      <fieldset className="flex flex-col gap-3 rounded-card border border-border p-3">
        <legend className="mb-1 text-sm font-medium text-foreground-muted">รอบความถี่</legend>

        <Field label="เริ่มวันที่" htmlFor="startDate">
          <Input id="startDate" name="startDate" type="date" defaultValue={today} required />
        </Field>

        <Field label="ความถี่" htmlFor="frequency">
          <Select id="frequency" name="frequency" value={frequency} onChange={(e) => setFrequency(e.target.value as RecurringFrequency)}>
            <option value="WEEKLY">ทุกสัปดาห์</option>
            <option value="MONTHLY">ทุกเดือน</option>
            <option value="YEARLY">ทุกปี</option>
          </Select>
        </Field>

        <Field label={`ทุก [n] ${frequency === "WEEKLY" ? "สัปดาห์" : frequency === "MONTHLY" ? "เดือน" : "ปี"}`} htmlFor="intervalCount">
          <Input id="intervalCount" name="intervalCount" type="number" min={1} step={1} defaultValue={1} required />
        </Field>

        <Field label="สิ้นสุด (ถ้ามี)" htmlFor="endDate">
          <Input id="endDate" name="endDate" type="date" />
        </Field>
      </fieldset>

      <Field label="ชื่อรายการ (ถ้ามี)" htmlFor="title">
        <Input id="title" name="title" type="text" placeholder="เช่น เงินเดือนประจำเดือน" />
      </Field>

      <Field label="โน้ต (ถ้ามี)" htmlFor="note">
        <Input id="note" name="note" type="text" />
      </Field>

      <Field label="แท็ก (ถ้ามี)" htmlFor="tagIds">
        <TagPicker name="tagIds" tags={tags} walletId={walletId || undefined} personalScopeOnly={scope === "PERSONAL"} />
      </Field>

      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
      <SubmitButton size="lg">บันทึกรายการประจำ</SubmitButton>
    </form>
  );
}
