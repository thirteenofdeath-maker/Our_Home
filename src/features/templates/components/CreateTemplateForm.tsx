"use client";

import { useActionState, useMemo, useState } from "react";

import { Field, Input } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import type { CategoryNode } from "@/features/categories/types";
import { FinanceOptionField } from "@/features/finance/components/FinanceOptionField";
import type { Pocket } from "@/features/pockets/types";
import { TagPicker } from "@/features/tags/components/TagPicker";
import type { TagOption } from "@/features/tags/types";
import type { Wallet } from "@/features/wallets/types";
import { initialActionState } from "@/lib/types/action-state";

import { createTemplateAction } from "../actions";
import { CategorySelect } from "./CategorySelect";

/**
 * `initial*` props back "สร้าง Template จากรายการนี้" — quick-saving a
 * Template from an existing Income/Expense transaction's detail page
 * (docs/FINANCE.md Phase F "Quick save"). Only the allowed defaults are
 * ever passed in: type/wallet/pocket/category/amount/title/note/active
 * tags — never occurred_at, created_at, void state, or adjustment
 * relationships, none of which are Template concepts at all.
 */
export function CreateTemplateForm({
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
  initialScope,
  initialTransactionType,
  initialName,
  initialWalletId,
  initialPocketId,
  initialCategoryId,
  initialAmount,
  initialTitle,
  initialNote,
  initialTagIds,
  variant = "page",
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
  initialScope?: "PERSONAL" | "HOUSEHOLD";
  initialTransactionType?: "INCOME" | "EXPENSE";
  initialName?: string;
  initialWalletId?: string;
  initialPocketId?: string;
  initialCategoryId?: string;
  initialAmount?: string;
  initialTitle?: string;
  initialNote?: string;
  initialTagIds?: TagOption[];
  /** Presentation only — no card chrome to strip either way; kept for API-consistency. */
  variant?: "page" | "sheet";
}) {
  void variant;
  const [state, formAction] = useActionState(
    createTemplateAction,
    initialActionState,
  );
  const [scope, setScope] = useState<"PERSONAL" | "HOUSEHOLD">(
    initialScope ?? "PERSONAL",
  );
  const [transactionType, setTransactionType] = useState<"INCOME" | "EXPENSE">(
    initialTransactionType ?? "EXPENSE",
  );
  const [walletId, setWalletId] = useState<string>(initialWalletId ?? "");
  const [pocketId, setPocketId] = useState<string>(initialPocketId ?? "");

  const wallets = scope === "PERSONAL" ? personalWallets : householdWallets;
  const pockets = useMemo(
    () => (walletId ? (pocketsByWallet[walletId] ?? []) : []),
    [pocketsByWallet, walletId],
  );
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
    <form action={formAction} className="finance-ui-tone flex flex-col gap-4">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium text-foreground-muted">
          ประเภท Template
        </legend>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="scope"
            value="PERSONAL"
            checked={scope === "PERSONAL"}
            onChange={() => {
              setScope("PERSONAL");
              setWalletId("");
              setPocketId("");
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
              setPocketId("");
            }}
            disabled={!hasHousehold}
          />
          ครอบครัว{!hasHousehold ? " (สร้างครอบครัวก่อน)" : ""}
        </label>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium text-foreground-muted">
          ประเภทรายการ
        </legend>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="transactionType"
            value="EXPENSE"
            checked={transactionType === "EXPENSE"}
            onChange={() => setTransactionType("EXPENSE")}
          />
          รายจ่าย
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="transactionType"
            value="INCOME"
            checked={transactionType === "INCOME"}
            onChange={() => setTransactionType("INCOME")}
          />
          รายรับ
        </label>
      </fieldset>

      <Field label="ชื่อ Template" htmlFor="name">
        <Input
          id="name"
          name="name"
          type="text"
          defaultValue={initialName ?? ""}
          placeholder="เช่น กาแฟตอนเช้า"
          required
          autoFocus
        />
      </Field>

      <Field label="จำนวน (ถ้ามี)" htmlFor="amount">
        <Input
          id="amount"
          name="amount"
          type="text"
          inputMode="decimal"
          defaultValue={initialAmount ?? ""}
          placeholder="0.00"
        />
      </Field>

      <FinanceOptionField
        label="Wallet (ถ้ามี)"
        title="เลือก Wallet"
        name="walletId"
        options={wallets.map((wallet) => ({ id: wallet.id, label: wallet.name }))}
        value={walletId}
        onChange={(nextWalletId) => {
          setWalletId(nextWalletId);
          setPocketId("");
        }}
        emptyChoice={{ label: "ไม่กำหนด" }}
      />

      {walletId ? (
        <FinanceOptionField
          label="Pocket (ถ้ามี)"
          title="เลือก Pocket"
          name="pocketId"
          options={pockets.map((pocket) => ({
            id: pocket.id,
            label: pocket.name,
            description: pocket.currency,
          }))}
          value={pocketId}
          onChange={setPocketId}
          emptyChoice={{ label: "ไม่กำหนด" }}
        />
      ) : null}

      <Field label="หมวดหมู่ (ถ้ามี)" htmlFor="categoryId">
        <CategorySelect
          key={`${scope}:${transactionType}`}
          categories={categories}
          transactionType={transactionType}
          walletId={walletId || undefined}
          defaultValue={initialCategoryId ?? ""}
        />
      </Field>

      <Field label="ชื่อรายการ (ถ้ามี)" htmlFor="title">
        <Input
          id="title"
          name="title"
          type="text"
          defaultValue={initialTitle ?? ""}
          placeholder="เช่น กาแฟ"
        />
      </Field>

      <Field label="โน้ต (ถ้ามี)" htmlFor="note">
        <Input
          id="note"
          name="note"
          type="text"
          defaultValue={initialNote ?? ""}
        />
      </Field>

      <Field label="แท็ก (ถ้ามี)" htmlFor="tagIds">
        <TagPicker
          name="tagIds"
          tags={tags}
          walletId={walletId || undefined}
          personalScopeOnly={scope === "PERSONAL"}
          defaultSelected={initialTagIds}
        />
      </Field>

      {state.error ? (
        <p className="text-sm text-danger">{state.error}</p>
      ) : null}
      <SubmitButton size="lg">บันทึก Template</SubmitButton>
    </form>
  );
}
