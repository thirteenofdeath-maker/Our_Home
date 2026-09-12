import Link from "next/link";

import { FinanceEmptyState } from "@/features/finance/components/FinanceEmptyState";
import { FinanceSegmentedControl } from "@/features/finance/components/FinanceSegmentedControl";
import { AddGoalFab } from "@/features/goals/components/AddGoalFab";
import { getMyPrimaryHousehold } from "@/features/household/api";
import { listGoals } from "@/features/goals/api";
import type { SavingGoalSummary } from "@/features/goals/types";
import { requireUser } from "@/lib/auth/require-user";
import { formatCurrency } from "@/lib/utils/money";

export default async function GoalsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status: rawStatus } = await searchParams;
  const status = rawStatus === "done" ? "done" : "active";
  const { supabase, user } = await requireUser();
  const household = await getMyPrimaryHousehold(supabase, user.id);
  const [personal, shared] = await Promise.all([
    listGoals(supabase, "PERSONAL"),
    household ? listGoals(supabase, "HOUSEHOLD", household.id) : Promise.resolve([]),
  ]);
  const all = [...personal, ...shared].filter((g) => !g.archivedAt);

  // "กำลังออม" / "สำเร็จ" reads the RPC's own `isComplete` flag directly
  // — already ledger/Pocket-derived server-side, never a client
  // recomputation and never a mutable saved-progress field.
  const active = all.filter((g) => !g.isComplete);
  const done = all.filter((g) => g.isComplete);
  const visible = status === "done" ? done : active;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-semibold text-finance-text">เป้าหมายการออม</h1>

      {/* One creation affordance at a time: the empty state below only
          ever renders its own CTA on the "active" tab (see `action`
          below) — hide this FAB in exactly that case rather than
          offering the same action twice. */}
      {!(status === "active" && visible.length === 0) ? <AddGoalFab /> : null}

      <FinanceSegmentedControl
        ariaLabel="สถานะเป้าหมาย"
        activeValue={status}
        options={[
          { value: "active", label: `กำลังออม (${active.length})`, href: "/finance/goals?status=active" },
          { value: "done", label: `สำเร็จ (${done.length})`, href: "/finance/goals?status=done" },
        ]}
      />

      {visible.length === 0 ? (
        <FinanceEmptyState
          icon="finance"
          title={status === "done" ? "ยังไม่มีเป้าหมายที่สำเร็จ" : "ยังไม่มีเป้าหมายการออม"}
          description="ผูกเป้าหมายกับ Pocket เพื่อติดตามความคืบหน้าอัตโนมัติ"
          action={status === "active" ? <AddGoalFab asEmptyStateCta /> : undefined}
        />
      ) : (
        <div className="flex flex-col gap-2">
          {visible.map((goal) => (
            <GoalCard key={goal.goalId} goal={goal} />
          ))}
        </div>
      )}
    </div>
  );
}

function GoalCard({ goal }: { goal: SavingGoalSummary }) {
  return (
    <Link href={`/finance/goals/${goal.goalId}`} className="flex flex-col gap-2 rounded-[1.25rem] bg-finance-surface-strong p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="font-medium text-finance-text">{goal.name}</span>
        <span className={`text-sm font-semibold tabular-nums ${goal.isComplete ? "text-finance-income" : "text-finance-text"}`}>{goal.progressPercent}%</span>
      </div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="tabular-nums text-finance-text">{formatCurrency(goal.progressAmount, goal.currency)}</span>
        <span className="text-finance-muted"> / {formatCurrency(goal.targetAmount, goal.currency)}</span>
      </div>
      {/* progressPercent is an authoritative decimal STRING from the RPC
          — interpolated directly into the CSS expression, never routed
          through Number() first. */}
      <div className="h-2 w-full overflow-hidden rounded-full bg-finance-background">
        <div className={`h-full ${goal.isComplete ? "bg-finance-income" : "bg-finance-primary"}`} style={{ width: `min(max(${goal.progressPercent}%, 0%), 100%)` }} />
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-finance-muted">
        <span>เหลือ {formatCurrency(goal.remainingAmount, goal.currency)}</span>
        {goal.targetDate ? <span>เป้าหมาย {goal.targetDate}</span> : null}
        <span>· {goal.pocketName}</span>
      </div>
      {goal.pocketArchived || goal.walletArchived ? <p className="text-xs text-finance-expense">Pocket/Wallet ที่ผูกไว้ถูกเก็บถาวร</p> : null}
    </Link>
  );
}
