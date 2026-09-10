"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { BottomSheet } from "@/components/ui/BottomSheet";
import { Input } from "@/components/ui/Field";
import { initialActionState } from "@/lib/types/action-state";

import { createTagAction } from "../actions";
import type { TagOption } from "../types";

/**
 * Multi-select chip picker for attaching Tags to a transaction. Submits as
 * repeated hidden inputs sharing one `name` — FormData.getAll(name) on the
 * server reads them all (see transactions/actions.ts). Selection lives in
 * local state; nothing is persisted until the surrounding form (create or
 * edit) actually submits — attaching tags always goes through the
 * transaction's own atomic RPC (create_* with p_tag_ids, or
 * set_transaction_tags for edit), never a separate round trip from here.
 */
export function TagPicker({
  name,
  tags,
  walletId,
  personalScopeOnly = false,
  defaultSelected = [],
}: {
  name: string;
  tags: TagOption[];
  /** Wallet this transaction belongs to — scopes an inline "quick create" tag correctly (see actions.ts). */
  walletId?: string;
  /**
   * Set when there is no Wallet in context at all (e.g. a PERSONAL-scope
   * Template that hasn't picked a Wallet default) — quick-create resolves
   * scope=PERSONAL directly, same as the standalone /finance/tags screen.
   * Not offered for a HOUSEHOLD-scope Template with no Wallet selected:
   * createTagAction's scope-only path resolves to the caller's *primary*
   * household, which is not necessarily the Template's own household for
   * a user who belongs to more than one — quick-create is hidden in that
   * case rather than risk misattributing a new tag (selecting from the
   * already-correctly-scoped existing list still works either way).
   */
  personalScopeOnly?: boolean;
  defaultSelected?: TagOption[];
}) {
  const canQuickCreate = Boolean(walletId) || personalScopeOnly;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<TagOption[]>(defaultSelected);
  const [query, setQuery] = useState("");
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? tags.filter((t) => t.name.toLowerCase().includes(q)) : tags;
  }, [tags, query]);

  function toggle(tag: TagOption) {
    setSelected((prev) => (prev.some((t) => t.id === tag.id) ? prev.filter((t) => t.id !== tag.id) : [...prev, tag]));
  }

  function remove(id: string) {
    setSelected((prev) => prev.filter((t) => t.id !== id));
  }

  function submitNewTag() {
    if (!newName.trim() || !canQuickCreate) return;
    const formData = new FormData();
    formData.set("name", newName.trim());
    if (walletId) {
      formData.set("walletId", walletId);
    } else {
      formData.set("scope", "PERSONAL");
    }

    startTransition(async () => {
      const result = await createTagAction(initialActionState, formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      setError(null);
      setNewName("");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2">
      {selected.map((tag) => (
        <input key={tag.id} type="hidden" name={name} value={tag.id} />
      ))}

      <div className="flex flex-wrap gap-2">
        {selected.map((tag) => (
          <button
            key={tag.id}
            type="button"
            onClick={() => remove(tag.id)}
            className="flex items-center gap-1 rounded-full bg-surface-muted px-3 py-1 text-sm"
          >
            #{tag.name} <span aria-hidden>&times;</span>
          </button>
        ))}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-full border border-dashed border-border px-3 py-1 text-sm text-primary"
        >
          + เพิ่ม Tag
        </button>
      </div>

      <BottomSheet open={open} onClose={() => setOpen(false)} title="เลือกแท็ก">
        {tags.length > 5 ? (
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ค้นหาแท็ก"
            className="mb-3"
            autoFocus
          />
        ) : null}

        <div className="flex flex-col gap-1">
          {filtered.length === 0 ? <p className="py-4 text-center text-sm text-foreground-muted">ไม่พบแท็ก</p> : null}
          {filtered.map((tag) => {
            const isSelected = selected.some((t) => t.id === tag.id);
            return (
              <button
                key={tag.id}
                type="button"
                onClick={() => toggle(tag)}
                className={`flex w-full items-center justify-between rounded-control px-3 py-2 text-left hover:bg-surface-muted ${isSelected ? "bg-surface-muted" : ""}`}
              >
                #{tag.name}
                {isSelected ? <span aria-hidden>✓</span> : null}
              </button>
            );
          })}
        </div>

        {canQuickCreate ? (
          <div className="mt-4 flex gap-2 border-t border-border pt-4">
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="สร้างแท็กใหม่" />
            <button
              type="button"
              disabled={isPending}
              onClick={submitNewTag}
              className="rounded-control bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              เพิ่ม
            </button>
          </div>
        ) : null}
        {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
      </BottomSheet>
    </div>
  );
}
