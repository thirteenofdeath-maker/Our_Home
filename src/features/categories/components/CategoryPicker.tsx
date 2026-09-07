"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { BottomSheet } from "@/components/ui/BottomSheet";
import { Input } from "@/components/ui/Field";
import { initialActionState } from "@/lib/types/action-state";

import { createCategoryAction } from "../actions";
import type { CategoryNode } from "../types";

/**
 * The category list can change (a new category gets created) without
 * leaving the transaction form, so "add category" is invoked imperatively
 * from a plain button rather than a nested <form> — a <form> can never be
 * nested inside the transaction form's own <form>. router.refresh() then
 * re-runs the parent Server Component so the newly created category shows
 * up in `categories` on the next render.
 */
export function CategoryPicker({
  name,
  categories,
  transactionType,
  scope,
}: {
  name: string;
  categories: CategoryNode[];
  transactionType: "INCOME" | "EXPENSE";
  scope: "PERSONAL" | "HOUSEHOLD";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<{ id: string; label: string } | null>(null);
  const [addingUnder, setAddingUnder] = useState<{ parentId: string | null } | null>(null);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function selectCategory(id: string, label: string) {
    setSelected({ id, label });
    setOpen(false);
  }

  function submitNewCategory() {
    if (!newName.trim()) return;
    const formData = new FormData();
    formData.set("name", newName.trim());
    formData.set("transactionType", transactionType);
    formData.set("scope", scope);
    if (addingUnder?.parentId) formData.set("parentId", addingUnder.parentId);

    startTransition(async () => {
      const result = await createCategoryAction(initialActionState, formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      setError(null);
      setNewName("");
      setAddingUnder(null);
      router.refresh();
    });
  }

  return (
    <div>
      <input type="hidden" name={name} value={selected?.id ?? ""} />
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="h-12 w-full rounded-control border border-border bg-surface px-3 text-left text-base"
      >
        {selected?.label ?? "เลือกหมวดหมู่"}
      </button>

      <BottomSheet open={open} onClose={() => setOpen(false)} title="เลือกหมวดหมู่">
        <div className="flex flex-col gap-1">
          {categories.length === 0 ? (
            <p className="py-4 text-center text-sm text-foreground-muted">ยังไม่มีหมวดหมู่ เพิ่มหมวดหมู่แรกด้านล่าง</p>
          ) : null}
          {categories.map((category) => (
            <div key={category.id}>
              <button
                type="button"
                onClick={() => selectCategory(category.id, category.name)}
                className="flex w-full items-center justify-between rounded-control px-3 py-2 text-left hover:bg-surface-muted"
              >
                {category.name}
              </button>
              <div className="ml-3 flex flex-col gap-1 border-l border-border pl-3">
                {category.children.map((child) => (
                  <button
                    key={child.id}
                    type="button"
                    onClick={() => selectCategory(child.id, `${category.name} > ${child.name}`)}
                    className="flex w-full items-center justify-between rounded-control px-3 py-2 text-left text-sm hover:bg-surface-muted"
                  >
                    {child.name}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setAddingUnder({ parentId: category.id })}
                  className="px-3 py-1 text-left text-sm text-primary"
                >
                  + เพิ่มหมวดหมู่ย่อยใน {category.name}
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 border-t border-border pt-4">
          {addingUnder ? (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-foreground-muted">
                {addingUnder.parentId ? "เพิ่มหมวดหมู่ย่อยใหม่" : "เพิ่มหมวดหมู่ใหม่"}
              </p>
              <div className="flex gap-2">
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="ชื่อหมวดหมู่"
                  autoFocus
                />
                <button
                  type="button"
                  disabled={isPending}
                  onClick={submitNewCategory}
                  className="rounded-control bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
                >
                  เพิ่ม
                </button>
              </div>
              {error ? <p className="text-sm text-danger">{error}</p> : null}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAddingUnder({ parentId: null })}
              className="text-sm font-medium text-primary"
            >
              + เพิ่มหมวดหมู่ใหม่
            </button>
          )}
        </div>
      </BottomSheet>
    </div>
  );
}
