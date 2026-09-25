import Link from "next/link";

import { AppIcon } from "@/components/ui/AppIcon";
import { getBudgetSummary } from "@/features/budgets/api";
import {
  listBills,
  listBillOccurrences,
  materializeBills,
} from "@/features/bills/api";
import { listDebts } from "@/features/debts/api";
import { FinanceTrendCard } from "@/features/finance/components/FinanceTrendCard";
import { FinanceSegmentedControl } from "@/features/finance/components/FinanceSegmentedControl";
import { FinanceCreateFlow } from "@/features/finance/components/FinanceCreateFlow";
import { FinanceMonthNavigator } from "@/features/finance/components/FinanceMonthNavigator";
import {
  currentFinanceDate,
  currentFinanceMonth,
  financeMonthRange,
  financeMonthToPeriodMonth,
  shiftFinanceMonth,
} from "@/features/finance/domain/finance";
import { buildCumulativeDailyTrend } from "@/features/finance/domain/finance-trend";
import { listGoals } from "@/features/goals/api";
import { getMyPrimaryHousehold } from "@/features/household/api";
import { getFinanceReport } from "@/features/reports/api";
import { listMyWallets } from "@/features/wallets/api";
import { AddWalletTrigger } from "@/features/wallets/components/AddWalletTrigger";
import { requireUser } from "@/lib/auth/require-user";
import { formatCurrency, subtractMoney } from "@/lib/utils/money";

const SHORTCUTS = [
  { href: "/categories", label: "หมวดหมู่", icon: "pocket" },
  { href: "/finance/installments", label: "ผ่อนชำระ", icon: "calendar" },
  { href: "/finance/recurring", label: "รายการประจำ", icon: "finance" },
  { href: "/finance/net-worth", label: "ทรัพย์สินสุทธิ", icon: "wallet" },
  { href: "/finance/tags", label: "แท็ก", icon: "pocket" },
  { href: "/finance/import", label: "นำเข้า", icon: "transfer" },
  { href: "/finance/export", label: "ส่งออก", icon: "transfer" },
] as const;

export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; scope?: string }>;
}) {
  const { supabase, user } = await requireUser();
  const { month: rawMonth, scope: rawScope } = await searchParams;
  const household = await getMyPrimaryHousehold(supabase, user.id);
  const scope =
    rawScope === "HOUSEHOLD" && household ? "HOUSEHOLD" : "PERSONAL";
  const householdId = scope === "HOUSEHOLD" ? (household?.id ?? null) : null;
  const month =
    rawMonth && /^\d{4}-\d{2}$/.test(rawMonth)
      ? rawMonth
      : currentFinanceMonth();
  const monthRange = financeMonthRange(month);
  const prevMonth = shiftFinanceMonth(month, -1);
  const prevMonthRange = financeMonthRange(prevMonth);
  const nextMonth = shiftFinanceMonth(month, 1);
  const currentMonth = currentFinanceMonth();
  const monthLabel = new Intl.DateTimeFormat("th-TH", {
    month: "long",
    year: "numeric",
    timeZone: "Asia/Bangkok",
  }).format(new Date(`${month}-01T00:00:00+07:00`));
  const chartMonthLabel = new Intl.DateTimeFormat("th-TH", {
    month: "long",
    timeZone: "Asia/Bangkok",
  }).format(new Date(`${month}-01T00:00:00+07:00`));
  const prevMonthLabel = new Intl.DateTimeFormat("th-TH", {
    month: "long",
    timeZone: "Asia/Bangkok",
  }).format(new Date(`${prevMonth}-01T00:00:00+07:00`));
  const currentDay =
    month === currentMonth ? Number(currentFinanceDate().slice(-2)) : undefined;

  // Materialization and the independent dashboard reads used to form a full
  // waterfall. Start them together; occurrences alone wait for both the bill
  // list and materialization to complete.
  const materialization = materializeBills(supabase, { scope, householdId });
  const [allWallets, budgets, bills, report, goals, debts] = await Promise.all([
    listMyWallets(supabase),
    getBudgetSummary(supabase, {
      periodMonth: financeMonthToPeriodMonth(month),
      monthStart: monthRange.start,
      monthEnd: monthRange.end,
      scope,
      householdId,
    }),
    listBills(supabase, { scope, householdId }),
    getFinanceReport(
      supabase,
      scope,
      householdId,
      prevMonthRange.start,
      monthRange.end,
    ),
    listGoals(supabase, scope, householdId),
    listDebts(supabase, scope, householdId),
  ]);
  await materialization;
  const billOccurrences = await listBillOccurrences(
    supabase,
    bills.filter((bill) => !bill.pausedAt).map((bill) => bill.billId),
    { status: "OPEN", limit: 3 },
  );
  const wallets = allWallets.filter(
    (wallet) =>
      wallet.scope === scope &&
      (scope === "PERSONAL" || wallet.household_id === householdId),
  );
  const currentMonthTotals = report.months.filter(
    (item) => item.month === month,
  );
  const previousMonthTotals = report.months.filter(
    (item) => item.month === prevMonth,
  );
  const initialWallet = wallets[0];
  const reportCurrencies = [
    ...new Set(report.months.map((item) => item.currency)),
  ];
  const summaryCurrencies = reportCurrencies.length
    ? reportCurrencies
    : ["THB"];
  const activeGoals = goals.filter(
    (goal) => !goal.archivedAt && !goal.isComplete,
  );
  const activeDebts = debts.filter(
    (debt) =>
      !debt.archivedAt &&
      debt.outstanding !== "0.00" &&
      debt.outstanding !== "-0.00",
  );

  return (
    <div className="flex min-w-0 flex-col gap-5">
      {household ? (
        <FinanceSegmentedControl
          ariaLabel="ขอบเขตข้อมูลการเงิน"
          activeValue={scope}
          options={[
            {
              value: "PERSONAL",
              label: "ส่วนตัว",
              href: `/finance?month=${month}`,
            },
            {
              value: "HOUSEHOLD",
              label: "ครอบครัว",
              href: `/finance?month=${month}&scope=HOUSEHOLD`,
            },
          ]}
        />
      ) : null}

      <div className="landscape-finance-grid flex min-w-0 flex-col gap-5">
        <section className="flex min-w-0 flex-col gap-3">
        <SectionTitle
          title="สรุปรายรับรายจ่าย"
          primary
          href={
            scope === "HOUSEHOLD"
              ? `/finance/reports?month=${month}&scope=HOUSEHOLD`
              : `/finance/reports?month=${month}`
          }
        />
        <FinanceMonthNavigator
          month={month}
          label={monthLabel}
          previousMonth={prevMonth}
          nextMonth={nextMonth}
          currentMonth={currentMonth}
          pathname="/finance"
          query={scope === "HOUSEHOLD" ? { scope: "HOUSEHOLD" } : undefined}
        />
        {summaryCurrencies.map((currency) => {
          const total = currentMonthTotals.find(
            (item) => item.currency === currency,
          ) ?? { income: "0.00", expense: "0.00" };
          return (
            <div
              key={`summary-${currency}`}
              className="grid min-w-0 grid-cols-3 overflow-hidden rounded-[1.5rem] bg-finance-surface-strong p-4 shadow-card"
            >
              <FinanceSummaryItem
                label="รายรับรวม"
                value={formatCurrency(total.income, currency)}
                tone="income"
              />
              <FinanceSummaryItem
                label="รายจ่ายรวม"
                value={formatCurrency(total.expense, currency)}
                tone="expense"
              />
              <FinanceSummaryItem
                label="คงเหลือ"
                value={formatCurrency(
                  subtractMoney(total.income, total.expense),
                  currency,
                )}
                tone="default"
              />
            </div>
          );
        })}
        {summaryCurrencies.map((currency) => {
          const total = currentMonthTotals.find(
            (item) => item.currency === currency,
          ) ?? { income: "0.00", expense: "0.00" };
          const previousTotal = previousMonthTotals.find(
            (item) => item.currency === currency,
          ) ?? { income: "0.00", expense: "0.00" };
          return (
            <FinanceTrendCard
              key={currency}
              currency={currency}
              showCurrencyLabel={summaryCurrencies.length > 1}
              trend={buildCumulativeDailyTrend(month, report.days, currency)}
              comparisonTrend={buildCumulativeDailyTrend(
                prevMonth,
                report.days,
                currency,
              )}
              monthLabel={chartMonthLabel}
              comparisonMonthLabel={prevMonthLabel}
              throughDay={currentDay}
              income={total.income}
              expense={total.expense}
              previousIncome={previousTotal.income}
              previousExpense={previousTotal.expense}
            />
          );
        })}
        </section>

        <div className="landscape-finance-side min-w-0">
          {initialWallet ? (
            <FinanceCreateFlow walletId={initialWallet.id} />
          ) : (
            <div className="rounded-[1.25rem] bg-finance-surface-strong p-4 text-center shadow-sm">
              <p className="text-sm text-finance-muted">
                เพิ่มกระเป๋าเงิน
                {scope === "HOUSEHOLD" ? "ครอบครัว" : "ส่วนตัว"}
                ก่อนบันทึกรายการ
              </p>
              <AddWalletTrigger
                defaultScope={scope}
                triggerClassName="mt-2 inline-flex min-h-11 items-center text-finance-primary-strong"
              >
                เพิ่มกระเป๋าเงิน
              </AddWalletTrigger>
            </div>
          )}

          <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold text-finance-text">
          วางแผนการเงิน
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <FinancePlanCard
            href="/finance/budgets"
            label="งบประมาณ"
            detail={
              budgets.active.length
                ? `${budgets.active.length} หมวดที่ติดตาม`
                : "เริ่มตั้งงบเดือนนี้"
            }
            icon="finance"
            tone="warning"
          />
          <FinancePlanCard
            href="/finance/goals"
            label="เป้าหมาย"
            detail={
              activeGoals.length
                ? `${activeGoals.length} เป้าหมายกำลังออม`
                : "สร้างเป้าหมายแรก"
            }
            icon="pocket"
            tone="income"
          />
          <FinancePlanCard
            href="/finance/bills"
            label="บิลที่ต้องจ่าย"
            detail={
              billOccurrences.length
                ? `${billOccurrences.length} รายการใกล้ถึง`
                : "ยังไม่มีบิลค้าง"
            }
            icon="calendar"
            tone="expense"
          />
          <FinancePlanCard
            href="/finance/debts"
            label="หนี้สินของฉัน"
            detail={
              activeDebts.length
                ? `${activeDebts.length} รายการคงค้าง`
                : "ไม่มีหนี้คงค้าง"
            }
            icon="wallet"
            tone="transfer"
          />
        </div>
          </section>

          <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-finance-muted">
          เครื่องมือเพิ่มเติม
        </h2>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {SHORTCUTS.map((shortcut) => (
            <Link
              key={shortcut.href}
              href={shortcut.href}
              className="flex h-11 shrink-0 items-center gap-2 rounded-full bg-finance-surface-strong px-4 text-sm font-medium text-finance-text shadow-sm"
            >
              <AppIcon
                name={shortcut.icon}
                className="size-4 text-finance-muted"
              />
              {shortcut.label}
            </Link>
          ))}
        </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function FinanceSummaryItem({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "income" | "expense" | "default";
}) {
  return (
    <div className="relative z-10 min-w-0 px-1 text-center first:pl-0 last:pr-0">
      <p className="truncate text-[11px] text-finance-muted">{label}</p>
      <p
        className={`mt-1 truncate text-sm font-semibold tabular-nums ${
          tone === "income"
            ? "text-finance-income"
            : tone === "expense"
              ? "text-finance-expense"
              : "text-finance-text"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function SectionTitle({
  title,
  href,
  primary = false,
}: {
  title: string;
  href: string;
  primary?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      {primary ? (
        <h1 className="text-lg font-semibold text-finance-text">{title}</h1>
      ) : (
        <h2 className="text-lg font-semibold text-finance-text">{title}</h2>
      )}
      <Link
        href={href}
        className="flex min-h-11 items-center text-sm font-medium text-finance-primary-strong"
      >
        ดูทั้งหมด
      </Link>
    </div>
  );
}

function FinancePlanCard({
  href,
  label,
  detail,
  icon,
  tone,
}: {
  href: string;
  label: string;
  detail: string;
  icon: "finance" | "pocket" | "calendar" | "wallet";
  tone: "warning" | "income" | "expense" | "transfer";
}) {
  const toneClass =
    tone === "warning"
      ? "bg-finance-warning/15 text-finance-warning"
      : tone === "income"
        ? "bg-finance-income/15 text-finance-income"
        : tone === "expense"
          ? "bg-finance-expense/15 text-finance-expense"
          : "bg-finance-transfer/15 text-finance-transfer";
  return (
    <Link
      href={href}
      className="flex min-h-32 flex-col justify-between rounded-[1.4rem] bg-finance-surface-strong p-4 shadow-card"
    >
      <span
        className={`flex size-10 items-center justify-center rounded-full ${toneClass}`}
      >
        <AppIcon name={icon} className="size-5" />
      </span>
      <span>
        <span className="block font-semibold text-finance-text">{label}</span>
        <span className="mt-0.5 block text-xs text-finance-muted">
          {detail}
        </span>
      </span>
    </Link>
  );
}
