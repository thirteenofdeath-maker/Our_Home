import Link from "next/link";
import Image from "next/image";

import { AppIcon } from "@/components/ui/AppIcon";
import { FinanceEmptyState } from "@/features/finance/components/FinanceEmptyState";
import { AddInstallmentFab } from "@/features/installments/components/AddInstallmentFab";
import { listCardInstallmentPlans, listInstallmentPlans } from "@/features/installments/api";
import type { CardInstallmentPlanSummary, InstallmentPlanSummary } from "@/features/installments/types";
import { requireUser } from "@/lib/auth/require-user";
import { formatCurrency, sumMoney } from "@/lib/utils/money";

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
  const cardPlans = await listCardInstallmentPlans(supabase);
  const active = plans.filter((p) => !p.archivedAt);
  const archived = plans.filter((p) => p.archivedAt);
  const today = new Date().toLocaleDateString("en-CA");
  const activeCardPlans = cardPlans.filter((plan) => !plan.archivedAt);
  const overdueCount = activeCardPlans.filter((plan) => plan.nextDueDate && plan.nextDueDate < today).length;
  const dueAmountsByCurrency = new Map<string, string[]>();
  for (const plan of activeCardPlans) {
    if (!plan.nextDueDate || plan.nextDueDate > today) continue;
    dueAmountsByCurrency.set(plan.currency, [...(dueAmountsByCurrency.get(plan.currency) ?? []), plan.nextDueAmount ?? "0.00"]);
  }
  const dueLabel = dueAmountsByCurrency.size
    ? [...dueAmountsByCurrency].map(([currency, amounts]) => formatCurrency(sumMoney(amounts), currency)).join(" · ")
    : formatCurrency("0.00", "THB");

  return (
    <div className="finance-scope -mx-4 flex flex-col gap-4 px-4 pb-6">
      <div className="flex items-center justify-between gap-3">
        <div><h1 className="text-2xl font-bold text-[#352725]">ผ่อนชำระ</h1><p className="text-sm text-finance-muted">ค่อย ๆ ไป เราทำได้นะ</p></div>
        {active.length > 0 ? <AddInstallmentFab asEmptyStateCta /> : null}
      </div>

      <section className="relative overflow-hidden rounded-[1.75rem] border border-white/80 bg-finance-surface-strong p-5 pt-24 shadow-card">
        <Image src="/illustrations/finance/installment-cat.webp" alt="แมวพักอยู่ข้างต้นไม้" width={520} height={260} className="pointer-events-none absolute -right-6 -top-9 h-auto w-64" />
        <h2 className="relative text-lg font-bold text-finance-text">ภาพรวมการผ่อนชำระ</h2>
        <div className="relative mt-4 grid grid-cols-3 divide-x divide-finance-primary-soft text-center">
          <SummaryMetric label="แผนที่ผ่อนอยู่" value={`${activeCardPlans.length + active.length} แผน`} />
          <SummaryMetric label="ครบกำหนด" value={dueLabel} />
          <SummaryMetric label="ค้างชำระ" value={`${overdueCount} รายการ`} danger={overdueCount > 0} />
        </div>
      </section>

      {overdueCount > 0 ? <p className="rounded-[1.25rem] bg-[#ffe4df] px-4 py-3 text-sm font-medium text-[#9a3f32]">รายการค้างชำระจะแจ้งเตือนทุกวัน จนกว่าจะได้รับการแก้ไข</p> : null}

      {cardPlans.length ? <section className="flex flex-col gap-2"><h2 className="text-sm font-semibold text-finance-muted">ผ่อนผ่านบัตรเครดิต</h2>{cardPlans.map((plan)=><CardInstallmentPlanRow key={plan.planId} plan={plan}/>)}</section>:null}

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

function SummaryMetric({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  return <div className="px-2"><p className="text-xs text-finance-muted">{label}</p><p className={`mt-1 text-base font-bold tabular-nums ${danger ? "text-danger" : "text-finance-text"}`}>{value}</p></div>;
}

function CardInstallmentPlanRow({plan}:{plan:CardInstallmentPlanSummary}) {
  const progress = Math.round((plan.paidCount / plan.installmentCount) * 100);
  const overdue = Boolean(plan.nextDueDate && plan.nextDueDate < new Date().toLocaleDateString("en-CA"));
  return <Link href={`/finance/installments/card/${plan.planId}`} className={`grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-[1.5rem] border border-white/80 bg-finance-surface-strong p-4 shadow-card ${plan.archivedAt?"opacity-60":""}`}>
    <span className="flex size-14 items-center justify-center rounded-full bg-finance-primary-soft text-finance-primary-strong"><AppIcon name="finance" className="size-7" /></span>
    <div className="min-w-0"><div className="flex items-center justify-between gap-2"><p className="truncate font-bold text-finance-text">{plan.name}</p><span className="shrink-0 text-sm font-semibold">งวด {Math.min(plan.paidCount + 1, plan.installmentCount)}/{plan.installmentCount}</span></div><p className="text-sm text-finance-muted">บัตรเครดิต · {plan.cardName}</p><div className="mt-2 h-2 overflow-hidden rounded-full bg-[#e6e8e9]"><span className={`block h-full rounded-full ${overdue ? "bg-finance-expense" : "bg-finance-primary"}`} style={{width:`${progress}%`}} /></div>{plan.nextDueDate?<p className={`mt-2 text-xs ${overdue?"text-danger":"text-finance-muted"}`}>ครบกำหนด {plan.nextDueDate} · {formatCurrency(plan.nextDueAmount ?? "0",plan.currency)}/งวด</p>:<p className="mt-2 text-xs text-finance-income">ชำระครบแล้ว</p>}</div>
    <AppIcon name="chevron" className="size-5 text-finance-muted" />
  </Link>;
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
