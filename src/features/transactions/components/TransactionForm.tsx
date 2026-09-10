"use client";

import { useActionState, useEffect } from "react";

import { Field, Input, Select } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { CategoryPicker } from "@/features/categories/components/CategoryPicker";
import type { CategoryNode } from "@/features/categories/types";
import type { Pocket } from "@/features/pockets/types";
import { TagPicker } from "@/features/tags/components/TagPicker";
import type { TagOption } from "@/features/tags/types";
import { initialActionState } from "@/lib/types/action-state";

import { createIncomeExpenseAction } from "../actions";
import { TransactionWalletSelect, type TransactionWalletOption } from "./TransactionWalletSelect";
import { postRecurringOccurrenceAction } from "@/features/recurring/actions";

export function TransactionForm({
  walletId,
  wallets,
  transactionType,
  pockets,
  categories,
  tags,
  returnTo,
  defaultAmount,
  defaultPocketId,
  defaultCategoryId,
  defaultCategoryLabel,
  defaultTitle,
  defaultNote,
  defaultTagIds,
  staleNotices,
  postOccurrence,
  templateId,
  occurrenceId,
}: {
  walletId: string;
  wallets: TransactionWalletOption[];
  transactionType: "INCOME" | "EXPENSE";
  pockets: Pocket[];
  categories: CategoryNode[];
  tags: TagOption[];
  /** Where to redirect after a successful save — see transactions/actions.ts (whitelisted, e.g. Finance Hub's quick-add). Omit to keep the existing wallet-detail redirect. */
  returnTo?: string;
  /**
   * Prefill from a Template ("ใช้ Template" — docs/FINANCE.md Phase F)
   * or a Recurring occurrence ("บันทึกรายการ" — docs/FINANCE.md Phase
   * G). V1 deliberately does not persist which Template (if any) a
   * transaction came from — see the phase brief's "no need to store
   * template_id on the actual transaction" — these are prefill values
   * only, fully overridable, and the resulting transaction is
   * indistinguishable from a manually-entered one.
   */
  defaultAmount?: string | null;
  defaultPocketId?: string | null;
  defaultCategoryId?: string | null;
  defaultCategoryLabel?: string | null;
  defaultTitle?: string | null;
  defaultNote?: string | null;
  /** Already filtered to ACTIVE tags only by the caller — an archived Template/Recurring tag is never prefilled (docs/FINANCE.md Phase F "Tag rules"). */
  defaultTagIds?: TagOption[];
  /** e.g. "Pocket ที่บันทึกไว้ถูก Archive แล้ว กรุณาเลือก Pocket ใหม่ก่อนบันทึก" — surfaced, never silently resolved. */
  staleNotices?: string[];
  /**
   * When set, this form is posting a Recurring occurrence rather than
   * creating a plain new transaction: submits to
   * post_recurring_occurrence (atomic with marking the occurrence
   * POSTED — docs/FINANCE.md Phase G "Atomic posting") instead of
   * create_income_expense_transaction, and the date field defaults to
   * the occurrence's own due date rather than today — unlike a
   * Template, a Recurring occurrence DOES have a meaningful scheduled
   * date (docs/FINANCE.md Phase G "Date behavior").
   */
  postOccurrence?: { occurrenceId: string; dueDate: string };
  templateId?: string;
  occurrenceId?: string;
}) {
  const [state, formAction] = useActionState(postOccurrence ? postRecurringOccurrenceAction : createIncomeExpenseAction, initialActionState);
  // UI convenience only — pre-selects the first pocket in the (stable,
  // sort_order) list so the field isn't blank. No pocket is a domain
  // default; this selection is never persisted as one. A Template's
  // saved Pocket default (already validated by the caller to belong to
  // this Wallet and be active) takes priority when present.
  const initialPocketId = defaultPocketId ?? pockets[0]?.id;
  const today = postOccurrence?.dueDate ?? new Date().toLocaleDateString("en-CA");

  useEffect(() => {
    if (process.env.NODE_ENV !== "development" || transactionType !== "EXPENSE") return;
    console.log(
      "[TransactionForm] categories",
      categories.flatMap((category) => [category, ...category.children]).map((category) => ({
        id: category.id,
        name: category.name,
        parent_id: category.parent_id,
        transaction_type: category.transaction_type,
      })),
    );
  }, [categories, transactionType]);

  return (
    <form action={formAction} className="flex flex-col gap-4 rounded-card bg-surface p-4 shadow-card">
      <input type="hidden" name="walletId" value={walletId} />
      <input type="hidden" name="transactionType" value={transactionType} />
      {returnTo ? <input type="hidden" name="returnTo" value={returnTo} /> : null}
      {postOccurrence ? <input type="hidden" name="occurrenceId" value={postOccurrence.occurrenceId} /> : null}

      {staleNotices?.length ? (
        <div className="flex flex-col gap-1 rounded-card border border-danger/40 bg-danger/10 p-3">
          {staleNotices.map((notice) => (
            <p key={notice} className="text-sm text-danger">
              {notice}
            </p>
          ))}
        </div>
      ) : null}

      <Field label="จำนวนเงิน" htmlFor="amount">
        <Input id="amount" name="amount" type="text" inputMode="decimal" defaultValue={defaultAmount ?? ""} placeholder="0.00" required autoFocus />
      </Field>

      <TransactionWalletSelect
        wallets={wallets}
        currentWalletId={walletId}
        transactionType={transactionType}
        returnTo={returnTo}
        templateId={templateId}
        occurrenceId={occurrenceId}
      />

      <Field label="ช่องเงิน (Pocket)" htmlFor="pocketId">
        <Select id="pocketId" name="pocketId" defaultValue={initialPocketId} required>
          {pockets.map((pocket) => (
            <option key={pocket.id} value={pocket.id}>
              {pocket.name}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="หมวดหมู่" htmlFor="categoryId">
          <CategoryPicker
            name="categoryId"
            categories={categories}
            transactionType={transactionType}
            walletId={walletId}
            defaultSelected={defaultCategoryId ? { id: defaultCategoryId, label: defaultCategoryLabel ?? "" } : null}
          />
      </Field>

      <Field label="ชื่อรายการ (ถ้ามี)" htmlFor="title">
        <Input id="title" name="title" type="text" defaultValue={defaultTitle ?? ""} placeholder="เช่น กาแฟ" />
      </Field>

      <Field label="โน้ต (ถ้ามี)" htmlFor="note">
        <Input id="note" name="note" type="text" defaultValue={defaultNote ?? ""} />
      </Field>

      <Field label="วันที่" htmlFor="occurredAt">
        <Input id="occurredAt" name="occurredAt" type="date" defaultValue={today} required />
      </Field>

      <Field label="แท็ก (ถ้ามี)" htmlFor="tagIds">
        <TagPicker name="tagIds" tags={tags} walletId={walletId} defaultSelected={defaultTagIds} />
      </Field>

      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
      <SubmitButton size="lg" variant={transactionType === "INCOME" ? "primary" : "danger"}>
        {postOccurrence ? "บันทึกรายการ" : transactionType === "INCOME" ? "บันทึกรายรับ" : "บันทึกรายจ่าย"}
      </SubmitButton>
    </form>
  );
}
