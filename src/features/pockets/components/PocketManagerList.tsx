import { ActionButton } from "@/components/ui/ActionButton";
import { AppIcon } from "@/components/ui/AppIcon";
import { formatCurrency } from "@/lib/utils/money";
import Link from "next/link";

import { archivePocketAction, deletePocketAction, restorePocketAction } from "../actions";
import type { Pocket, PocketWithBalance } from "../types";
import { RenamePocketForm } from "./RenamePocketForm";

export function PocketManagerList({
  walletId,
  pockets,
  archivedPockets,
  currency,
  compact = false,
}: {
  walletId: string;
  pockets: PocketWithBalance[];
  archivedPockets: Pocket[];
  currency: string;
  compact?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col gap-3">
        {pockets.map((pocket) => (
          <li key={pocket.id} id={`pocket-${pocket.id}`} className="rounded-card bg-surface shadow-card">
            {compact ? (
              <Link href={`/wallets/${walletId}/manage#pocket-${pocket.id}`} className="flex min-h-18 items-center gap-3 p-4">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary"><AppIcon name="pocket" /></span>
                <span className="min-w-0 flex-1 truncate font-medium">{pocket.name}</span>
                <span className="shrink-0 tabular-nums font-semibold">{formatCurrency(pocket.balance, currency)}</span>
                <AppIcon name="chevron" className="size-4 text-foreground-muted" />
              </Link>
            ) : (
            <div className="flex min-h-20 items-center justify-between gap-3 p-4">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary"><AppIcon name="pocket" /></span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2"><p className="truncate font-medium">{pocket.name}</p><p className="shrink-0 tabular-nums font-semibold">{formatCurrency(pocket.balance, currency)}</p></div>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <RenamePocketForm pocketId={pocket.id} walletId={walletId} currentName={pocket.name} />
                <ActionButton action={archivePocketAction} hiddenFields={{ pocketId: pocket.id, walletId }} label="เก็บถาวร" variant="ghost" className="w-auto px-3 text-xs text-danger shadow-none" />
              </div>
            </div>
            </div>
            )}
          </li>
        ))}
      </ul>

      {compact && archivedPockets.length > 0 ? (
        <Link href={`/wallets/${walletId}/manage`} className="flex min-h-11 items-center justify-between px-2 text-sm text-foreground-muted">
          Pocket ที่เก็บถาวร ({archivedPockets.length})
          <AppIcon name="chevron" className="size-4" />
        </Link>
      ) : archivedPockets.length > 0 ? (
        <details className="rounded-card border border-border bg-surface-muted px-4 py-2">
          <summary className="cursor-pointer text-sm text-foreground-muted">
            Pocket ที่เก็บถาวร ({archivedPockets.length})
          </summary>
          <ul className="mt-2 divide-y divide-border">
            {archivedPockets.map((pocket) => (
              <li key={pocket.id} className="flex items-center justify-between gap-3 py-2">
                <span className="text-foreground-muted line-through">{pocket.name}</span>
                <div className="flex items-center gap-2">
                  <form action={restorePocketAction}>
                    <input type="hidden" name="pocketId" value={pocket.id} />
                    <input type="hidden" name="walletId" value={walletId} />
                    <button type="submit" className="text-xs font-medium text-primary">
                      กู้คืน
                    </button>
                  </form>
                  <ActionButton
                    action={deletePocketAction}
                    hiddenFields={{ pocketId: pocket.id, walletId }}
                    label="ลบถาวร"
                    variant="danger"
                  />
                </div>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
