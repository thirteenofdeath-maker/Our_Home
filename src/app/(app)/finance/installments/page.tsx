import Link from "next/link";

import { AppIcon } from "@/components/ui/AppIcon";
import { FinanceEmptyState } from "@/features/finance/components/FinanceEmptyState";
import { AddInstallmentFab } from "@/features/installments/components/AddInstallmentFab";
import { listInstallmentPlans } from "@/features/installments/api";
import type { InstallmentPlanSummary } from "@/features/installments/types";
import { requireUser } from "@/lib/auth/require-user";
import { formatCurrency } from "@/lib/utils/money";

/**
 * Deliberately reads ONLY `listInstallmentPlans` — no per-plan
 * `listInstallmentOccurrences` loop. That function is a genuine,
 * existing selector (still used, correctly, by the plan DETAIL page,
 * which loads occurrences for exactly the one plan it's showing) — but
 * calling it once per plan from THIS list page is an N+1 query pattern,
 * which is why paid-count/remaining/next-due/completion are not shown
 * here at all. Showing only what `listInstallmentPlans` itself
 * authoritatively returns keeps this list truthful without a new query.
 */
export default async function InstallmentsPage() {
  const { supabase } = await requireUser();
  const plans = await listInstallmentPlans(supabase, "PERSONAL");
  const active = plans.filter((p) => !p.archivedAt);
  const archived = plans.filter((p) => p.archivedAt);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-semibold text-finance-text">แผนผ่อนชำระ</h1>

      {/* One creation affordance at a time: when the list is empty,
          FinanceEmptyState below renders its own CTA, so this FAB is
          hidden rather than offering the same action twice. */}
      {active.length > 0 ? <AddInstallmentFab /> : null}

      {active.length === 0 ? (
        <FinanceEmptyState
          icon="finance"
          title="ยังไม่มีแผนผ่อนชำระ"
          description="สร้างแผนผ่อนชำระเพื่อบันทึกยอดรวมและจำนวนงวด"
          action={<AddInstallmentFab asEmptyStateCta />}
        />
      ) : (
        <div className="flex flex-col gap-2">
          {active.map((plan) => (
            <InstallmentPlanRow key={plan.id} plan={plan} />
          ))}
        </div>
      )}

      {archived.length > 0 ? (
        <details className="rounded-[1.25rem] bg-finance-surface-strong px-4 py-2 shadow-sm">
          <summary className="cursor-pointer text-sm font-medium text-finance-muted">แผนที่เก็บถาวร ({archived.length})</summary>
          <div className="mt-2 flex flex-col gap-2">
            {archived.map((plan) => (
              <InstallmentPlanRow key={plan.id} plan={plan} />
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}

function InstallmentPlanRow({ plan }: { plan: InstallmentPlanSummary }) {
  return (
    <Link
      href={`/finance/installments/${plan.id}`}
      className={`flex items-center justify-between gap-3 rounded-[1.25rem] bg-finance-surface-strong p-4 shadow-sm ${plan.archivedAt ? "opacity-60" : ""}`}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="truncate font-medium text-finance-text">{plan.name}</span>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-xs text-finance-muted">
          <span>
            ยอดรวม <span className="font-medium tabular-nums text-finance-text">{formatCurrency(plan.totalAmount, plan.currency)}</span>
          </span>
          <span>จำนวนงวด {plan.installmentCount} งวด</span>
          <span>เริ่ม {plan.startDate}</span>
          <span>ทุก {plan.intervalMonths} เดือน</span>
        </div>
      </div>
      <AppIcon name="chevron" className="size-4 shrink-0 text-finance-muted" />
    </Link>
  );
}
