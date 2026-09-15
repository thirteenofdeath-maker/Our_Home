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

import { updateTemplateAction } from "../actions";
import type { TemplateSummary } from "../types";
import { CategorySelect } from "./CategorySelect";

export function EditTemplateForm({
  template,
  wallets,
  pocketsByWallet,
  categories,
  tags,
}: {
  template: TemplateSummary;
  wallets: Wallet[];
  pocketsByWallet: Record<string, Pocket[]>;
  categories: CategoryNode[];
  tags: TagOption[];
}) {
  const [state, formAction] = useActionState(
    updateTemplateAction,
    initialActionState,
  );
  const [walletId, setWalletId] = useState(
    template.walletArchived ? "" : (template.walletId ?? ""),
  );
  const [pocketId, setPocketId] = useState(
    template.pocketArchived ? "" : (template.pocketId ?? ""),
  );
  const pockets = useMemo(
    () => (walletId ? (pocketsByWallet[walletId] ?? []) : []),
    [pocketsByWallet, walletId],
  );
  const currentActiveTags = template.tags.filter((t) => !t.archivedAt);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={template.templateId} />

      <Field label="ชื่อ Template" htmlFor="name">
        <Input
          id="name"
          name="name"
          type="text"
          defaultValue={template.name}
          required
          autoFocus
        />
      </Field>

      {template.walletArchived ? (
        <p className="text-sm text-danger">
          Wallet ที่บันทึกไว้ ({template.walletName}) ถูกเก็บถาวรแล้ว กรุณาเลือก
          Wallet ใหม่
        </p>
      ) : null}
      {template.pocketArchived ? (
        <p className="text-sm text-danger">
          Pocket ที่บันทึกไว้ ({template.pocketName}) ถูกเก็บถาวรแล้ว กรุณาเลือก
          Pocket ใหม่
        </p>
      ) : null}
      {template.categoryArchived ? (
        <p className="text-sm text-danger">
          หมวดหมู่ที่บันทึกไว้ ({template.categoryName}) ถูกเก็บถาวรแล้ว
          กรุณาเลือกใหม่
        </p>
      ) : null}

      <Field label="จำนวน (ถ้ามี)" htmlFor="amount">
        <Input
          id="amount"
          name="amount"
          type="text"
          inputMode="decimal"
          defaultValue={template.amount ?? ""}
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
          categories={categories}
          transactionType={template.transactionType}
          walletId={walletId || undefined}
          defaultValue={
            template.categoryArchived ? "" : (template.categoryId ?? "")
          }
        />
      </Field>

      <Field label="ชื่อรายการ (ถ้ามี)" htmlFor="title">
        <Input
          id="title"
          name="title"
          type="text"
          defaultValue={template.title ?? ""}
          placeholder="เช่น กาแฟ"
        />
      </Field>

      <Field label="โน้ต (ถ้ามี)" htmlFor="note">
        <Input
          id="note"
          name="note"
          type="text"
          defaultValue={template.note ?? ""}
        />
      </Field>

      <Field label="แท็ก (ถ้ามี)" htmlFor="tagIds">
        <TagPicker
          name="tagIds"
          tags={tags}
          walletId={walletId || undefined}
          personalScopeOnly={template.scope === "PERSONAL"}
          defaultSelected={currentActiveTags}
        />
      </Field>

      {state.error ? (
        <p className="text-sm text-danger">{state.error}</p>
      ) : null}
      <SubmitButton size="lg">บันทึกการแก้ไข</SubmitButton>
    </form>
  );
}
