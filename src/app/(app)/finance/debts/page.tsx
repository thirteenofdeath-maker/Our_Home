import Link from "next/link";

import { FinanceEmptyState } from "@/features/finance/components/FinanceEmptyState";
import { FinanceSegmentedControl } from "@/features/finance/components/FinanceSegmentedControl";
import { AddDebtFab } from "@/features/debts/components/AddDebtFab";
import { listDebts } from "@/features/debts/api";
import type { DebtSummary } from "@/features/debts/types";
import { requireUser } from "@/lib/auth/require-user";
import { formatCurrency, sumMoney } from "@/lib/utils/money";

type Direction = "LIABILITY" | "RECEIVABLE";
type StatusFilter = "ALL" | "OUTSTANDING" | "SETTLED";

// Exact string comparison against the normalized decimal amount — never
// Number(outstanding), since a float comparison must not be treated as
// financial truth. `outstanding` is always normalizeDatabaseMoney'd
// upstream into `-?\d+\.\d{2}`, so a zero balance is always exactly
// "0.00" (a "-0.00" from Postgres is not realistic here, but matched too).
function isSettled(debt: DebtSummary): boolean {
  return debt.outstanding === "0.00" || debt.outstanding === "-0.00";
}

function buildHref(params: Record<string, string | undefined>, overrides: Record<string, string | undefined>): string {
  const merged = { ...params, ...overrides };
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(merged)) if (value) query.set(key, value);
  const queryString = query.toString();
  return queryString ? `/finance/debts?${queryString}` : "/finance/debts";
}

export default async function DebtsPage({
  searchParams,
}: {
  searchParams: Promise<{ direction?: string; status?: string }>;
}) {
  const params = await searchParams;
  const direction: Direction = params.direction === "RECEIVABLE" ? "RECEIVABLE" : "LIABILITY";
  const status: StatusFilter = params.status === "OUTSTANDING" || params.status === "SETTLED" ? params.status : "ALL";
  const { supabase } = await requireUser();

  const rows = await listDebts(supabase, "PERSONAL");
  const active = rows.filter((d) => !d.archivedAt);
  const byDirection = active.filter((d) => d.debtType === direction);
  const visible = byDirection.filter((d) => (status === "OUTSTANDING" ? !isSettled(d) : status === "SETTLED" ? isSettled(d) : true));

  // Outstanding total per currency for the current direction — an exact
  // sum (never JS floating point) of already-loaded `outstanding`
  // figures, never combined across currencies. "Original principal" is
  // deliberately NOT shown here: the existing get_debt_summary read
  // model exposes only the live outstanding balance, not each debt's
  // original opening amount — see the Phase 2 report for why this was
  // left out rather than guessed at or backed by a new query.
  const outstanding = byDirection.filter((d) => !isSettled(d));
  const totalsByCurrency = new Map<string, string>();
  for (const currency of new Set(outstanding.map((d) => d.currency))) {
    totalsByCurrency.set(currency, sumMoney(outstanding.filter((d) => d.currency === currency).map((d) => d.outstanding)));
  }

  const commonParams = { direction, status: status === "ALL" ? undefined : status };

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-semibold text-finance-text">ยืม·ให้ยืม</h1>

      {/* One creation affordance at a time: when the visible list is
          empty, FinanceEmptyState below renders its own CTA, so this FAB
          is hidden rather than offering it twice. */}
      {visible.length > 0 ? <AddDebtFab /> : null}

      <FinanceSegmentedControl
        ariaLabel="ทิศทาง"
        activeValue={direction}
        options={[
          { value: "LIABILITY", label: "ยืมเงิน", href: buildHref(commonParams, { direction: "LIABILITY" }) },
          { value: "RECEIVABLE", label: "ให้ยืมเงิน", href: buildHref(commonParams, { direction: "RECEIVABLE" }) },
        ]}
      />

      <FinanceSegmentedControl
        ariaLabel="สถานะ"
        activeValue={status}
        options={[
          { value: "ALL", label: "ทั้งหมด", href: buildHref(commonParams, { status: undefined }) },
          { value: "OUTSTANDING", label: "ยังไม่ได้คืน", href: buildHref(commonParams, { status: "OUTSTANDING" }) },
          { value: "SETTLED", label: "คืนแล้ว", href: buildHref(commonParams, { status: "SETTLED" }) },
        ]}
      />

      {outstanding.length > 0 ? (
        <div className="flex flex-col gap-2 rounded-[1.25rem] bg-finance-surface-strong p-4">
          <p className="text-xs font-medium text-finance-muted">{direction === "LIABILITY" ? "ยอดที่ยังต้องคืนรวม" : "ยอดที่ยังไม่ได้รับคืนรวม"}</p>
          {[...totalsByCurrency.entries()].map(([currency, total]) => (
            <p key={currency} className="text-2xl font-semibold tabular-nums text-finance-text">
              {formatCurrency(total, currency)}
            </p>
          ))}
          <p className="text-xs text-finance-muted">{outstanding.length} รายการค้างอยู่</p>
        </div>
      ) : null}

      {visible.length === 0 ? (
        <FinanceEmptyState
          icon="finance"
          title={direction === "LIABILITY" ? "ยังไม่มีรายการเงินที่ยืมมา" : "ยังไม่มีรายการเงินที่ให้ยืม"}
          description="บันทึกยอดเงินต้นเพื่อติดตามยอดคงเหลือ"
          action={<AddDebtFab asEmptyStateCta />}
        />
      ) : (
        <div className="flex flex-col gap-2">
          {visible.map((debt) => {
            const settled = isSettled(debt);
            return (
              <Link key={debt.id} href={`/finance/debts/${debt.id}`} className="flex flex-col gap-1 rounded-[1.25rem] bg-finance-surface-strong p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-finance-text">{debt.counterparty ?? debt.name}</span>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                      settled ? "bg-finance-income/15 text-finance-income" : "bg-finance-warning/20 text-finance-warning"
                    }`}
                  >
                    {settled ? "คืนแล้ว" : "ค้างอยู่"}
                  </span>
                </div>
                {debt.name !== debt.counterparty ? <p className="text-xs text-finance-muted">{debt.name}</p> : null}
                <div className="flex items-baseline justify-between">
                  <span className="text-xs text-finance-muted">ยอดคงเหลือ</span>
                  <span className={`font-semibold tabular-nums ${direction === "LIABILITY" ? "text-finance-expense" : "text-finance-income"}`}>
                    {formatCurrency(debt.outstanding, debt.currency)}
                  </span>
                </div>
                {debt.dueDate ? <p className="text-xs text-finance-muted">ครบกำหนด {debt.dueDate}</p> : null}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
