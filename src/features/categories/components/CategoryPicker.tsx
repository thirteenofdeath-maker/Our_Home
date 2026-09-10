"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { BottomSheet } from "@/components/ui/BottomSheet";
import { Input } from "@/components/ui/Field";
import { AppIcon } from "@/components/ui/AppIcon";
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
  walletId,
  defaultSelected = null,
}: {
  name: string;
  categories: CategoryNode[];
  transactionType: "INCOME" | "EXPENSE";
  /** The wallet this transaction is for. A new inline category is scoped
   * to this wallet's owner/household — never to the client's own idea of
   * "current scope", since that can't be trusted and doesn't account for
   * a user belonging to more than one household. */
  walletId: string;
  /** Pre-selects an existing category — used when editing a transaction. */
  defaultSelected?: { id: string; label: string } | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<{ id: string; label: string } | null>(() =>
    defaultSelected?.label ? defaultSelected : findCategory(categories, defaultSelected?.id ?? null),
  );
  const [query, setQuery] = useState("");
  const [addingUnder, setAddingUnder] = useState<{ parentId: string | null } | null>(null);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const visibleCategories = useMemo(() => filterCategories(categories, query), [categories, query]);

  function selectCategory(id: string, label: string) {
    setSelected({ id, label });
    setOpen(false);
  }

  function submitNewCategory() {
    if (!newName.trim()) return;
    const formData = new FormData();
    formData.set("name", newName.trim());
    formData.set("transactionType", transactionType);
    formData.set("walletId", walletId);
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
        id={name}
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="flex h-13 w-full items-center rounded-control border border-border/70 bg-surface px-4 text-left text-base shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <span className={`min-w-0 flex-1 truncate ${selected ? "text-foreground" : "text-foreground-muted"}`}>{selected?.label ?? "เลือกหมวดหมู่"}</span>
        <AppIcon name="chevron" className="size-4 text-foreground-muted" />
      </button>

      <BottomSheet open={open} onClose={() => setOpen(false)} title="เลือกหมวดหมู่">
        <Input aria-label="ค้นหาหมวดหมู่" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ค้นหาหมวดหมู่..." autoFocus />
        <div className="mt-3 flex flex-col gap-2">
          {visibleCategories.length === 0 ? (
            <p className="py-4 text-center text-sm text-foreground-muted">{query ? "ไม่พบหมวดหมู่ที่ค้นหา" : "ยังไม่มีหมวดหมู่ เพิ่มหมวดหมู่แรกด้านล่าง"}</p>
          ) : null}
          {visibleCategories.map((category) => (
            <section key={category.id} className="border-b border-border pb-2 last:border-0">
              <button
                type="button"
                onClick={() => selectCategory(category.id, category.name)}
                className="flex min-h-11 w-full items-center justify-between rounded-control px-3 text-left font-semibold hover:bg-surface-muted"
              >
                {category.name}
              </button>
              <div className="ml-3 flex flex-col border-l border-border pl-3">
                {category.children.map((child) => (
                  <button
                    key={child.id}
                    type="button"
                    onClick={() => selectCategory(child.id, `${category.name} > ${child.name}`)}
                    className="flex min-h-11 w-full items-center rounded-control px-3 text-left text-sm hover:bg-surface-muted"
                  >
                    {child.name}
                  </button>
                ))}
                {!category.is_system && !query ? <button
                  type="button"
                  onClick={() => setAddingUnder({ parentId: category.id })}
                  className="px-3 py-1 text-left text-sm text-primary"
                >
                  + เพิ่มหมวดหมู่ย่อยใน {category.name}
                </button> : null}
              </div>
            </section>
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

function findCategory(categories: CategoryNode[], selectedId: string | null): { id: string; label: string } | null {
  if (!selectedId) return null;
  for (const category of categories) {
    if (category.id === selectedId) return { id: category.id, label: category.name };
    const child = category.children.find((item) => item.id === selectedId);
    if (child) return { id: child.id, label: `${category.name} > ${child.name}` };
  }
  return null;
}

export function filterCategories(categories: CategoryNode[], query: string): CategoryNode[] {
  const needle = query.trim().toLocaleLowerCase("th");
  if (!needle) return categories;
  return categories.flatMap((category) => {
    const rootMatches = category.name.toLocaleLowerCase("th").includes(needle);
    const children = rootMatches
      ? category.children
      : category.children.filter((child) => child.name.toLocaleLowerCase("th").includes(needle));
    return rootMatches || children.length ? [{ ...category, children }] : [];
  });
}
