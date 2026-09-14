import Link from "next/link";
import type { ReactNode } from "react";

import {
  listBills,
  listBillOccurrences,
  materializeBills,
} from "@/features/bills/api";
import { AddBillTrigger } from "@/features/bills/components/AddBillTrigger";
import { BillCard } from "@/features/bills/components/BillCard";
import { BillOccurrenceCard } from "@/features/bills/components/BillOccurrenceCard";
import { FinanceEmptyState } from "@/features/finance/components/FinanceEmptyState";
import { getMyPrimaryHousehold } from "@/features/household/api";
import { requireUser } from "@/lib/auth/require-user";
import { cn } from "@/lib/utils/cn";
import { formatCurrency, sumMoney } from "@/lib/utils/money";

export default async function BillsPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string }>;
}) {
  const { supabase, user } = await requireUser();
  const query = await searchParams;
  const household = await getMyPrimaryHousehold(supabase, user.id);
  const scope =
    query.scope === "HOUSEHOLD" && household ? "HOUSEHOLD" : "PERSONAL";
  await materializeBills(supabase, { scope, householdId: household?.id });
  const bills = await listBills(supabase, {
    scope,
    householdId: household?.id,
    includeArchived: true,
  });
  const activeBills = bills.filter((bill) => !bill.archivedAt);
  const open = await listBillOccurrences(
    supabase,
    activeBills.map((bill) => bill.billId),
    { status: "OPEN", limit: 30 },
  );
  const urgent = [...open].sort((a, b) => {
    const rank = (value: string) =>
      value === "OVERDUE" ? 0 : value === "DUE" ? 1 : 2;
    return (
      rank(a.displayStatus) - rank(b.displayStatus) ||
      a.dueDate.localeCompare(b.dueDate)
    );
  });
  const totals = [...new Set(urgent.map((item) => item.currency))].map(
    (currency) => ({
      currency,
      amount: sumMoney(
        urgent
          .filter((item) => item.currency === currency)
          .map((item) => item.expectedAmount),
      ),
    }),
  );

  return (
    <div className="flex flex-col gap-4 pb-4">
      {household ? (
        <div className="grid grid-cols-2 rounded-[1.15rem] bg-finance-surface-strong p-1 shadow-sm">
          <Tab
            href="/finance/bills?scope=PERSONAL"
            active={scope === "PERSONAL"}
          >
            ส่วนตัว
          </Tab>
          <Tab
            href="/finance/bills?scope=HOUSEHOLD"
            active={scope === "HOUSEHOLD"}
          >
            ครอบครัว
          </Tab>
        </div>
      ) : null}

      <section className="rounded-[1.6rem] bg-[linear-gradient(135deg,#fde7df,#f8f1e7)] p-5 shadow-card">
        <p className="text-sm font-medium text-finance-muted">ยอดที่ต้องจ่าย</p>
        {totals.length ? (
          totals.map((total) => (
            <p
              key={total.currency}
              className="mt-1 text-3xl font-bold tabular-nums text-finance-text"
            >
              {formatCurrency(total.amount, total.currency)}
            </p>
          ))
        ) : (
          <p className="mt-1 text-3xl font-bold text-finance-text">฿0.00</p>
        )}
        <div className="mt-4 flex items-center justify-between rounded-2xl bg-white/65 px-3 py-2 text-sm">
          <span className="text-finance-muted">กำลังจะถึงและเลยกำหนด</span>
          <span className="font-semibold text-finance-expense">
            {urgent.length} รายการ
          </span>
        </div>
      </section>

      <AddBillTrigger />

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-finance-text">
            ต้องจ่ายเร็ว ๆ นี้
          </h2>
          <span className="text-sm text-finance-muted">เรียงตามกำหนด</span>
        </div>
        {urgent.length ? (
          urgent.map((item) => (
            <BillOccurrenceCard key={item.occurrenceId} item={item} />
          ))
        ) : (
          <FinanceEmptyState
            icon="calendar"
            title="ไม่มีบิลค้างจ่าย"
            description="รายการที่ใกล้ถึงกำหนดจะมาแสดงที่นี่"
          />
        )}
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-finance-text">
            บิลทั้งหมด
          </h2>
          <span className="text-sm text-finance-muted">
            {activeBills.length} บิล
          </span>
        </div>
        {activeBills.length ? (
          activeBills.map((item) => <BillCard key={item.billId} item={item} />)
        ) : (
          <p className="rounded-[1.25rem] bg-finance-surface-strong p-4 text-sm text-finance-muted shadow-sm">
            ยังไม่มีบิลที่บันทึกไว้
          </p>
        )}
      </section>

      {bills.some((item) => item.archivedAt) ? (
        <details className="rounded-[1.25rem] bg-finance-surface-strong px-4 py-3 shadow-sm">
          <summary className="cursor-pointer text-sm font-medium text-finance-muted">
            บิลที่เก็บถาวร
          </summary>
          <div className="mt-3 flex flex-col gap-2">
            {bills
              .filter((item) => item.archivedAt)
              .map((item) => (
                <BillCard key={item.billId} item={item} />
              ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}

function Tab({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex h-11 items-center justify-center rounded-[0.9rem] text-sm font-semibold",
        active
          ? "bg-finance-primary-soft text-finance-primary-strong"
          : "text-finance-muted",
      )}
    >
      {children}
    </Link>
  );
}
