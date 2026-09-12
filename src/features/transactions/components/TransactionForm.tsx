"use client";

import { useActionState, useState, useTransition } from "react";

import { Field, Input, Select } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { CategoryPicker } from "@/features/categories/components/CategoryPicker";
import type { CategoryNode } from "@/features/categories/types";
import { getIncomeExpenseSheetData } from "@/features/finance/quick-add-data";
import type { Pocket } from "@/features/pockets/types";
import { TagPicker } from "@/features/tags/components/TagPicker";
import type { TagOption } from "@/features/tags/types";
import { initialActionState } from "@/lib/types/action-state";
import { cn } from "@/lib/utils/cn";

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
  variant = "page",
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
  /** Presentation only — the writer/action/fields/validation are
   * identical either way. "page": unchanged, a self-contained card
   * (rounded, surfaced, shadowed) for the existing full-page routes.
   * "sheet": no card chrome of its own, since BottomSheet already
   * provides the surface/rounding/safe-area for the Finance quick-add
   * flow (see FinanceCreateFlow.tsx) — a card-inside-a-card would look
   * wrong and double the padding. */
  variant?: "page" | "sheet";
}) {
  const [state, formAction] = useActionState(postOccurrence ? postRecurringOccurrenceAction : createIncomeExpenseAction, initialActionState);

  // In `variant="sheet"`, switching the wallet must never navigate away
  // (see TransactionWalletSelect's `onWalletChange`) — instead this form
  // owns re-fetching the new wallet's Pocket/Category/Tag data itself,
  // through the exact same selectors the full-page route/quick-add sheet
  // already use (getIncomeExpenseSheetData), and swaps them in locally.
  // `variant="page"` never triggers this (TransactionWalletSelect falls
  // back to its own router.replace when no onWalletChange is passed), so
  // this state is simply unused/inert there.
  const [activeWalletId, setActiveWalletId] = useState(walletId);
  const [sheetData, setSheetData] = useState({ pockets, categories, tags });
  const [walletSwitchError, setWalletSwitchError] = useState<string | null>(null);
  const [walletSwitchPending, startWalletSwitch] = useTransition();

  function handleWalletChange(nextWalletId: string) {
    setWalletSwitchError(null);
    startWalletSwitch(async () => {
      try {
        const data = await getIncomeExpenseSheetData(nextWalletId, transactionType);
        setActiveWalletId(nextWalletId);
        setSheetData({ pockets: data.pockets, categories: data.categories, tags: data.tags });
      } catch {
        setWalletSwitchError("โหลดข้อมูลกระเป๋าเงินไม่สำเร็จ กรุณาลองใหม่");
      }
    });
  }

  // Template/Recurring prefill (defaultPocketId/defaultCategoryId/
  // defaultTagIds) only ever applies to the ORIGINAL wallet this form
  // mounted with — once the user switches wallet in-sheet, a prefilled
  // id from the old wallet's Pocket/Category/Tag set has no guaranteed
  // meaning under the new one, so it's dropped rather than carried over
  // as a stale selected id.
  const onOriginalWallet = activeWalletId === walletId;

  // UI convenience only — pre-selects the first pocket in the (stable,
  // sort_order) list so the field isn't blank. No pocket is a domain
  // default; this selection is never persisted as one. A Template's
  // saved Pocket default (already validated by the caller to belong to
  // this Wallet and be active) takes priority when present.
  const initialPocketId = (onOriginalWallet ? defaultPocketId : null) ?? sheetData.pockets[0]?.id;
  const today = postOccurrence?.dueDate ?? new Date().toLocaleDateString("en-CA");

  return (
    <form
      action={formAction}
      className={cn("finance-ui-tone", variant === "sheet" ? "flex flex-col gap-4" : "flex flex-col gap-4 rounded-card bg-surface p-4 shadow-card")}
    >
      <input type="hidden" name="walletId" value={activeWalletId} />
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
        currentWalletId={activeWalletId}
        transactionType={transactionType}
        returnTo={returnTo}
        templateId={templateId}
        occurrenceId={occurrenceId}
        onWalletChange={variant === "sheet" ? handleWalletChange : undefined}
        disabled={walletSwitchPending}
      />
      {walletSwitchPending ? <p className="text-sm text-foreground-muted">กำลังโหลดข้อมูลกระเป๋าเงิน...</p> : null}
      {walletSwitchError ? <p className="text-sm text-danger">{walletSwitchError}</p> : null}

      <Field label="ช่องเงิน (Pocket)" htmlFor="pocketId">
        <Select key={activeWalletId} id="pocketId" name="pocketId" defaultValue={initialPocketId} required>
          {sheetData.pockets.map((pocket) => (
            <option key={pocket.id} value={pocket.id}>
              {pocket.name}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="หมวดหมู่" htmlFor="categoryId">
          <CategoryPicker
            key={activeWalletId}
            name="categoryId"
            categories={sheetData.categories}
            transactionType={transactionType}
            walletId={activeWalletId}
            defaultSelected={onOriginalWallet && defaultCategoryId ? { id: defaultCategoryId, label: defaultCategoryLabel ?? "" } : null}
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
        <TagPicker key={activeWalletId} name="tagIds" tags={sheetData.tags} walletId={activeWalletId} defaultSelected={onOriginalWallet ? defaultTagIds : undefined} />
      </Field>

      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
      <SubmitButton size="lg" variant={transactionType === "INCOME" ? "financeIncome" : "financeExpense"}>
        {postOccurrence ? "บันทึกรายการ" : transactionType === "INCOME" ? "บันทึกรายรับ" : "บันทึกรายจ่าย"}
      </SubmitButton>
    </form>
  );
}
