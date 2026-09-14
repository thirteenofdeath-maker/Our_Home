import Link from "next/link";

import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { getMyPrimaryHousehold } from "@/features/household/api";
import { listHouseholdExpenseActivitySafe } from "@/features/household/activity-api";
import { requireUser } from "@/lib/auth/require-user";
import { formatCurrency } from "@/lib/utils/money";

/**
 * Phase U (0051): every personal-funded expense currently attributed to
 * this household, for every current member — wired to
 * get_household_expense_activity (SECURITY DEFINER, re-checks the
 * CALLING user's CURRENT membership itself; see the migration and
 * activity-api.ts). Never exposes the payer's personal wallet name, tags,
 * notes, or attachments — the RPC's own return shape (transaction id,
 * household category, currency, amount, occurred_at, payer display name
 * only) is the entire contract; there is nothing further to redact here
 * because nothing further is ever fetched.
 */
export default async function HouseholdActivityPage() {
  const { supabase, user } = await requireUser();
  const household = await getMyPrimaryHousehold(supabase, user.id);

  if (!household) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title="รายจ่ายครอบครัว" backHref="/household" />
        <EmptyState title="ยังไม่มีครอบครัว" description="เข้าร่วมหรือสร้างครอบครัวก่อนจึงจะดูรายการนี้ได้" />
      </div>
    );
  }

  // Last 90 days — a fixed, bounded window for V1 (no date-range picker
  // yet); every other bounded read model in this app (e.g. Recurring
  // occurrence generation) uses a similar fixed horizon rather than an
  // unbounded query.
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - 90);

  const activity = await listHouseholdExpenseActivitySafe(supabase, {
    householdId: household.id,
    from: from.toISOString(),
    to: to.toISOString(),
  });

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="รายจ่ายครอบครัว" backHref="/household" />
      <p className="text-sm text-foreground-muted">
        รายจ่ายที่สมาชิกจ่ายด้วยเงินส่วนตัวแทนครอบครัว {household.name} ในช่วง 90 วันที่ผ่านมา
      </p>

      {activity.length === 0 ? (
        <EmptyState title="ยังไม่มีรายจ่ายครอบครัวที่จ่ายด้วยเงินส่วนตัว" description="เมื่อมีสมาชิกจ่ายรายจ่ายครอบครัวด้วยกระเป๋าส่วนตัว รายการจะแสดงที่นี่" />
      ) : (
        <Card className="flex flex-col divide-y divide-border p-0">
          {activity.map((item) => (
            <Link
              key={item.transactionId}
              href={`/finance/transactions/${item.originalTransactionId}`}
              className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-surface-muted"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-foreground">
                  {item.categoryName}
                  {item.isAdjustment ? <span className="ml-2 text-xs font-normal text-income">คืน/เบิกคืน</span> : null}
                </span>
                <span className="block truncate text-xs text-foreground-muted">
                  จ่ายโดย {item.payerDisplayName} · {new Date(item.occurredAt).toLocaleDateString("th-TH", { dateStyle: "medium" })}
                </span>
              </span>
              <span className={`shrink-0 tabular-nums text-sm font-semibold ${item.amount.startsWith("-") ? "text-expense" : "text-income"}`}>
                {formatCurrency(item.amount, item.currency)}
              </span>
            </Link>
          ))}
        </Card>
      )}
    </div>
  );
}
