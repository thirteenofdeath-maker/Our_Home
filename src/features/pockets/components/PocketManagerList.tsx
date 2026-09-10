import { ActionButton } from "@/components/ui/ActionButton";
import { formatCurrency } from "@/lib/utils/money";

import { archivePocketAction, deletePocketAction, restorePocketAction } from "../actions";
import type { Pocket, PocketWithBalance } from "../types";
import { RenamePocketForm } from "./RenamePocketForm";

export function PocketManagerList({
  walletId,
  pockets,
  archivedPockets,
  currency,
}: {
  walletId: string;
  pockets: PocketWithBalance[];
  archivedPockets: Pocket[];
  currency: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <ul className="divide-y divide-border rounded-card border border-border bg-surface px-4">
        {pockets.map((pocket) => (
          <li key={pocket.id} className="flex min-h-20 items-center justify-between gap-3 py-3">
            <div className="min-w-0 flex-1">
              <p className="font-medium">{pocket.name}</p>
              <p className="tabular-nums text-sm text-foreground-muted">{formatCurrency(pocket.balance, currency)}</p>
              <div className="mt-2">
                <RenamePocketForm pocketId={pocket.id} walletId={walletId} currentName={pocket.name} />
              </div>
            </div>
            <ActionButton
              action={archivePocketAction}
              hiddenFields={{ pocketId: pocket.id, walletId }}
              label="เก็บถาวร"
              variant="danger"
            />
          </li>
        ))}
      </ul>

      {archivedPockets.length > 0 ? (
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
