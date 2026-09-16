import type { ReactNode } from "react";

import { BackButton } from "./BackButton";

/**
 * Back is an explicit per-page opt-in (`backHref`), not a global default —
 * the five BottomNav root destinations (/wallets, /finance, /calendar,
 * /pets, /household) never pass it, every deep/secondary page does. Superseded
 * decision: an earlier pass removed a Back arrow entirely in favor of
 * BottomNav + the system gesture alone; persistent BottomNav across deep
 * routes reintroduced the need for an explicit in-app Back — hierarchy
 * Back to the caller's own semantic parent, not browser-history Back (see
 * BackButton.tsx for why history length can never be trusted for this).
 *
 * The title is centered against the FULL header width via `justify-center`
 * on the header itself; both `backHref` (left) and `rightAction` (right)
 * are positioned `absolute` so neither ever claims flow space or needs a
 * matching fake placeholder on the opposite side — the title stays
 * centered regardless of which, both, or neither is present.
 */
export function PageHeader({ title, rightAction, backHref }: { title: string; rightAction?: ReactNode; backHref?: string }) {
  return (
    <header className="relative flex h-14 items-center justify-center">
      {backHref ? (
        <div className="absolute left-0 flex size-11 items-center justify-center">
          <BackButton backHref={backHref} />
        </div>
      ) : null}
      <h1 className="truncate px-12 text-center text-lg font-semibold">{title}</h1>
      {rightAction ? <div className="absolute right-0 flex size-11 items-center justify-center">{rightAction}</div> : null}
    </header>
  );
}
