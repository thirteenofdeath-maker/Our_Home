"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { AppIcon } from "@/components/ui/AppIcon";
import { BottomSheet, CLOSE_TRANSITION_MS } from "@/components/ui/BottomSheet";
import { Input } from "@/components/ui/Field";
import { initialActionState } from "@/lib/types/action-state";

import { createTagAction } from "../actions";
import type { TagOption } from "../types";

type Stage = "pick" | "add";

/**
 * Multi-select chip picker for attaching Tags to a transaction. Selection
 * lives in local state; nothing is persisted until the surrounding form
 * (create or edit) actually submits — attaching tags always goes through
 * the transaction's own atomic RPC (create_* with p_tag_ids, or
 * set_transaction_tags for edit), never a separate round trip from here.
 *
 * A two-stage sheet — PICK_TAGS and ADD_TAG_FORM — sharing the SAME
 * BottomSheet instance and the SAME close/reopen transition
 * FinanceCreateFlow established (`transitionTo`), never a second dialog
 * opened on top of this one. "สร้างแท็กใหม่" is a real Create action, so
 * it gets this real stage transition rather than an instant in-place
 * swap. Uses the exact existing `createTagAction` — never a forked
 * writer; router.refresh() re-runs the parent Server Component so the
 * newly-created tag is present in `tags` once the picker stage is shown
 * again (the action returns no id, so — per its existing return shape —
 * the new tag becomes available/visible on return, not auto-selected).
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
  const [stage, setStage] = useState<Stage>("pick");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selected, setSelected] = useState<TagOption[]>(defaultSelected);
  const [query, setQuery] = useState("");
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? tags.filter((t) => t.name.toLowerCase().includes(q)) : tags;
  }, [tags, query]);

  function transitionTo(next: () => void) {
    setSheetOpen(false);
    setTimeout(next, CLOSE_TRANSITION_MS);
  }

  function openPicker() {
    setStage("pick");
    setSheetOpen(true);
  }

  function closeSheet() {
    setSheetOpen(false);
  }

  function toggle(tag: TagOption) {
    setSelected((prev) => (prev.some((t) => t.id === tag.id) ? prev.filter((t) => t.id !== tag.id) : [...prev, tag]));
  }

  function remove(id: string) {
    setSelected((prev) => prev.filter((t) => t.id !== id));
  }

  function openAddForm() {
    transitionTo(() => {
      setError(null);
      setStage("add");
      setSheetOpen(true);
    });
  }

  function backToPicker() {
    transitionTo(() => {
      setError(null);
      setStage("pick");
      setSheetOpen(true);
    });
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
      setNewName("");
      router.refresh();
      backToPicker();
    });
  }

  return (
    <div className="finance-ui-tone flex flex-col gap-2">
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
        <button type="button" onClick={openPicker} className="rounded-full border border-dashed border-border px-3 py-1 text-sm text-primary">
          + เพิ่ม Tag
        </button>
      </div>

      <BottomSheet
        open={sheetOpen}
        onClose={closeSheet}
        title={stage === "add" ? "สร้างแท็กใหม่" : "เลือกแท็ก"}
        size={stage === "add" ? "content" : "large"}
        tone="finance"
      >
        {stage === "add" ? (
          <button
            type="button"
            aria-label="ย้อนกลับไปเลือกแท็ก"
            onClick={backToPicker}
            className="mb-2 flex size-9 items-center justify-center rounded-full text-foreground-muted hover:bg-surface-muted"
          >
            <AppIcon name="chevron" className="size-4 rotate-180" />
          </button>
        ) : null}

        {stage === "pick" ? (
          <>
            {tags.length > 5 ? (
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ค้นหาแท็ก" className="mb-3" autoFocus />
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
              <div className="mt-4 border-t border-border pt-4">
                <button type="button" onClick={openAddForm} className="text-sm font-medium text-primary">
                  + สร้างแท็กใหม่
                </button>
              </div>
            ) : null}
          </>
        ) : (
          <div className="flex flex-col gap-2">
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="สร้างแท็กใหม่" autoFocus />
            {error ? <p className="text-sm text-danger">{error}</p> : null}
            <button
              type="button"
              disabled={isPending}
              onClick={submitNewTag}
              className="rounded-control bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              เพิ่ม
            </button>
          </div>
        )}
      </BottomSheet>
    </div>
  );
}
