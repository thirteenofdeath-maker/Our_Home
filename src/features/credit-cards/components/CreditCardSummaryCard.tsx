import Link from "next/link";

import { formatCurrency } from "@/lib/utils/money";

import type { CreditCardAccount } from "../types";

export function CreditCardSummaryCard({ card }: { card: CreditCardAccount }) {
  return (
    <Link
      href={`/finance/cards/${card.accountId}`}
      className={`rounded-[1.5rem] border border-white/80 bg-[linear-gradient(135deg,#64866f,#82a78b)] p-5 text-white shadow-[0_14px_34px_rgb(84_116_94_/_0.22)] ${card.isArchived ? "opacity-60" : ""}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold">{card.name}</p>
          <p className="text-xs text-white/70">
            {[
              card.issuer,
              card.network,
              card.lastFour ? `•••• ${card.lastFour}` : null,
            ]
              .filter(Boolean)
              .join(" · ") || card.currency}
          </p>
        </div>
        <span className="rounded-full bg-white/15 px-2 py-1 text-xs">
          {card.scope === "PERSONAL" ? "ส่วนตัว" : "ครอบครัว"}
        </span>
      </div>
      <div className="mt-5">
        <p className="text-xs text-white/70">ยอดค้างชำระ</p>
        <p className="text-2xl font-semibold tabular-nums">
          {formatCurrency(card.liability, card.currency)}
        </p>
      </div>
      <div className="mt-3 flex justify-between text-xs">
        <span>วงเงินใช้ได้</span>
        <span>{formatCurrency(card.availableCredit, card.currency)}</span>
      </div>
    </Link>
  );
}
