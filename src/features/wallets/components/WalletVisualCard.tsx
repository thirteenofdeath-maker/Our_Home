import Link from "next/link";

import { AppIcon } from "@/components/ui/AppIcon";
import { cn } from "@/lib/utils/cn";
import { formatCurrency } from "@/lib/utils/money";

/**
 * Deterministic accent cycle keyed by the wallet's position in its own
 * (stable, server-sorted) list — never random per render, and never a
 * new stored style field. Purely a small CSS/AppIcon decoration, no bank
 * trademarks or logos.
 */
const ACCENTS = [
  "bg-finance-primary-soft text-finance-primary-strong",
  "bg-finance-warning/20 text-finance-warning",
  "bg-finance-transfer/15 text-finance-transfer",
];

/**
 * `compact` — the /finance horizontal Wallet snapshot: a fixed, small
 * (~160x155px) card sized so two are visible (or nearly visible) on an
 * iPhone viewport at once.
 * `gallery` — the /wallets two-column grid: fills its grid cell, name
 * may wrap to two lines, otherwise the same shape/content.
 */
export function WalletVisualCard({
  id,
  name,
  currency,
  scopeLabel,
  balance,
  index,
  variant = "gallery",
  className,
}: {
  id: string;
  name: string;
  currency: string;
  scopeLabel: string;
  /** Already-derived decimal string (this wallet's own currency — never combined with another). */
  balance: string;
  index: number;
  variant?: "compact" | "gallery";
  className?: string;
}) {
  const accent = ACCENTS[index % ACCENTS.length];
  const isCompact = variant === "compact";

  return (
    <Link
      href={`/wallets/${id}`}
      className={cn(
        "flex flex-col justify-between rounded-[1.25rem] bg-finance-surface-strong shadow-[0_1px_2px_rgb(68_80_92_/_0.04),0_8px_20px_rgb(68_80_92_/_0.06)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-finance-primary",
        isCompact ? "h-[155px] w-[160px] p-3" : "h-[165px] p-4",
        className,
      )}
    >
      <span className={cn("flex items-center justify-center rounded-full", isCompact ? "size-9" : "size-10", accent)}>
        <AppIcon name="wallet" className={isCompact ? "size-4" : "size-5"} />
      </span>
      <div>
        <p className={cn("font-semibold text-finance-text", isCompact ? "truncate text-sm" : "line-clamp-2 text-base")}>{name}</p>
        <p className="truncate text-xs text-finance-muted">
          {currency} · {scopeLabel}
        </p>
      </div>
      <p className={cn("truncate font-semibold tabular-nums text-finance-text", isCompact ? "text-base" : "text-lg")}>{formatCurrency(balance, currency)}</p>
    </Link>
  );
}
