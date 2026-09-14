import Link from "next/link";

import { AppIcon } from "@/components/ui/AppIcon";
import { getBudgetSummary } from "@/features/budgets/api";
import {
  listBills,
  listBillOccurrences,
  materializeBills,
} from "@/features/bills/api";
import { bangkokDateKey } from "@/features/calendar/domain/calendar";
import { listDebts } from "@/features/debts/api";
import {
  getFinanceSummary,
  listRecentFinanceTransactions,
} from "@/features/finance/api";
import { FinanceModuleTabs } from "@/features/finance/components/FinanceModuleTabs";
import { FinanceTrendCard } from "@/features/finance/components/FinanceTrendCard";
import {
  currentFinanceMonth,
  financeMonthRange,
  financeMonthToPeriodMonth,
  shiftFinanceMonth,
} from "@/features/finance/domain/finance";
import { getFinalHub } from "@/features/finance/final-api";
import { listGoals } from "@/features/goals/api";
import { TransactionHistoryList } from "@/features/transactions/components/TransactionHistoryList";
import { listMyWallets } from "@/features/wallets/api";
import { AddWalletTrigger } from "@/features/wallets/components/AddWalletTrigger";
import { WalletVisualCard } from "@/features/wallets/components/WalletVisualCard";
import { requireUser } from "@/lib/auth/require-user";
import { formatCurrency, subtractMoney, sumMoney } from "@/lib/utils/money";

const SHORTCUTS = [
  { href: "/categories", label: "หมวดหมู่", icon: "pocket" },
  { href: "/finance/installments", label: "ผ่อนชำระ", icon: "calendar" },
  { href: "/finance/recurring", label: "รายการประจำ", icon: "finance" },
  { href: "/finance/net-worth", label: "มูลค่าสุทธิ", icon: "wallet" },
  { href: "/finance/tags", label: "แท็ก", icon: "pocket" },
  { href: "/finance/import", label: "นำเข้า", icon: "transfer" },
  { href: "/finance/export", label: "ส่งออก", icon: "transfer" },
] as const;

export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { supabase } = await requireUser();
  const { month: rawMonth } = await searchParams;
  const month =
    rawMonth && /^\d{4}-\d{2}$/.test(rawMonth)
      ? rawMonth
      : currentFinanceMonth();
  const monthRange = financeMonthRange(month);
  const prevMonth = shiftFinanceMonth(month, -1);
  const nextMonth = shiftFinanceMonth(month, 1);
  const monthLabel = new Intl.DateTimeFormat("th-TH", {
    month: "long",
    year: "numeric",
    timeZone: "Asia/Bangkok",
  }).format(new Date(`${month}-01T00:00:00+07:00`));

  await materializeBills(supabase, { scope: "PERSONAL" });
  const trendStart = financeMonthRange(shiftFinanceMonth(month, -5)).start;
  const [wallets, summary, recent, budgets, bills, finalHub, goals, debts] =
    await Promise.all([
      listMyWallets(supabase),
      getFinanceSummary(supabase, monthRange),
      listRecentFinanceTransactions(supabase, 10),
      getBudgetSummary(supabase, {
        periodMonth: financeMonthToPeriodMonth(month),
        monthStart: monthRange.start,
        monthEnd: monthRange.end,
      }),
      listBills(supabase, { scope: "PERSONAL" }),
      getFinalHub(supabase, {
        start: trendStart,
        end: monthRange.end,
        today: bangkokDateKey(),
      }),
      listGoals(supabase, "PERSONAL"),
      listDebts(supabase, "PERSONAL"),
    ]);
  const billOccurrences = await listBillOccurrences(
    supabase,
    bills.filter((bill) => !bill.pausedAt).map((bill) => bill.billId),
    { status: "OPEN", limit: 3 },
  );
  const balanceByWallet = new Map(
    summary.walletBalances.map((item) => [item.walletId, item.amount]),
  );
  const initialWallet = wallets[0];
  const primaryBalance = summary.currencyTotals[0] ?? {
    currency: initialWallet?.currency ?? "THB",
    amount: "0.00",
  };
  const primaryMonth = summary.monthTotals.find(
    (item) => item.currency === primaryBalance.currency,
  ) ?? { currency: primaryBalance.currency, income: "0.00", expense: "0.00" };
  const remainingRows = budgets.active
    .filter((item) => item.currency === primaryBalance.currency)
    .map((item) => item.remaining);
  const remainingBudget = remainingRows.length
    ? sumMoney(remainingRows)
    : "0.00";
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
    <div className="finance-scope -mx-4 -mt-2 flex flex-col gap-5 px-4 pb-8 pt-3">
      <FinanceModuleTabs />

      <div className="flex items-center justify-between rounded-full bg-finance-surface-strong p-1 shadow-sm">
        <Link
          href={`/finance?month=${prevMonth}`}
          aria-label="เดือนก่อนหน้า"
          className="flex size-9 items-center justify-center rounded-full text-finance-text"
        >
          <AppIcon name="chevron" className="size-4 rotate-180" />
        </Link>
        <p className="text-sm font-semibold text-finance-text">{monthLabel}</p>
        <Link
          href={`/finance?month=${nextMonth}`}
          aria-label="เดือนถัดไป"
          className="flex size-9 items-center justify-center rounded-full text-finance-text"
        >
          <AppIcon name="chevron" className="size-4" />
        </Link>
      </div>

      {initialWallet ? (
        <Link
          href={`/finance/quick-add?walletId=${initialWallet.id}`}
          className="flex min-h-16 items-center justify-between rounded-[1.35rem] bg-[linear-gradient(110deg,var(--finance-expense),#f29a7d)] px-5 text-white shadow-[0_12px_28px_rgb(232_120_98_/_0.22)] transition-transform active:scale-[0.99]"
        >
          <span className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-full bg-white/20">
              <AppIcon name="plus" />
            </span>
            <span>
              <span className="block text-lg font-semibold">เพิ่มรายการ</span>
              <span className="block text-xs text-white/80">
                รายจ่าย · รายรับ · โอนเงิน · บัตร · ผ่อนชำระ
              </span>
            </span>
          </span>
          <AppIcon name="chevron" className="size-5" />
        </Link>
      ) : (
        <div className="rounded-[1.25rem] bg-finance-surface-strong p-4 shadow-sm">
          <p className="text-sm text-finance-muted">
            เพิ่มกระเป๋าเงินก่อนบันทึกรายการ
          </p>
          <AddWalletTrigger triggerClassName="mt-2 inline-flex min-h-11 items-center text-finance-primary-strong">
            เพิ่มกระเป๋าเงิน
          </AddWalletTrigger>
        </div>
      )}

      <section className="relative overflow-hidden rounded-[1.75rem] bg-[linear-gradient(145deg,#f5eadc,#f7f4e9_52%,#e8f1e5)] p-5 shadow-card">
        <div className="absolute -right-8 -top-10 size-32 rounded-full bg-white/45" />
        <div className="relative">
          <p className="text-sm font-medium text-finance-muted">
            ยอดเงินส่วนตัว
          </p>
          <p className="mt-1 text-3xl font-bold tabular-nums tracking-tight text-finance-text">
            {formatCurrency(primaryBalance.amount, primaryBalance.currency)}
          </p>
          {summary.currencyTotals.length > 1 ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {summary.currencyTotals.slice(1).map((total) => (
                <span
                  key={total.currency}
                  className="rounded-full bg-white/65 px-2.5 py-1 text-xs font-medium tabular-nums text-finance-muted"
                >
                  {formatCurrency(total.amount, total.currency)} ·{" "}
                  {total.currency}
                </span>
              ))}
            </div>
          ) : null}
          <div className="mt-5 grid grid-cols-3 divide-x divide-finance-primary/20 rounded-[1.15rem] bg-white/70 px-2 py-3 backdrop-blur-sm">
            <FinanceMetric
              label="รายรับเดือนนี้"
              value={formatCurrency(
                primaryMonth.income,
                primaryBalance.currency,
              )}
              tone="income"
            />
            <FinanceMetric
              label="ใช้จ่ายเดือนนี้"
              value={formatCurrency(
                primaryMonth.expense,
                primaryBalance.currency,
              )}
              tone="expense"
            />
            <FinanceMetric
              label="งบคงเหลือ"
              value={formatCurrency(remainingBudget, primaryBalance.currency)}
              tone="default"
            />
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <SectionTitle title="รายการล่าสุด" href="/finance/transactions" />
        <div className="rounded-[1.5rem] bg-finance-surface-strong p-2 shadow-card">
          <TransactionHistoryList
            items={recent.slice(0, 5)}
            variant="dashboard"
          />
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <SectionTitle title="กระเป๋าเงิน" href="/wallets" />
        {wallets.length ? (
          <div className="-mx-4 flex gap-3 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {wallets.map((wallet, index) => (
              <WalletVisualCard
                key={wallet.id}
                id={wallet.id}
                name={wallet.name}
                currency={wallet.currency}
                scopeLabel={
                  wallet.scope === "PERSONAL" ? "ส่วนตัว" : "ครอบครัว"
                }
                balance={balanceByWallet.get(wallet.id) ?? "0.00"}
                index={index}
                variant="compact"
                className="shrink-0"
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-finance-muted">ยังไม่มีกระเป๋าเงิน</p>
        )}
      </section>

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

      <section className="flex flex-col gap-3">
        <SectionTitle title="สรุปรายรับรายจ่าย" href="/finance/reports" />
        {summary.monthTotals.length ? (
          summary.monthTotals.map((total) => (
            <FinanceTrendCard
              key={total.currency}
              currency={total.currency}
              showCurrencyLabel={summary.monthTotals.length > 1}
              trend={finalHub.trend.filter(
                (point) => point.currency === total.currency,
              )}
              income={total.income}
              expense={total.expense}
              net={subtractMoney(total.income, total.expense)}
            />
          ))
        ) : (
          <FinanceTrendCard
            currency="THB"
            showCurrencyLabel={false}
            trend={[]}
            income="0.00"
            expense="0.00"
            net="0.00"
          />
        )}
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
  );
}

function SectionTitle({ title, href }: { title: string; href: string }) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="text-lg font-semibold text-finance-text">{title}</h2>
      <Link
        href={href}
        className="flex min-h-11 items-center text-sm font-medium text-finance-primary-strong"
      >
        ดูทั้งหมด
      </Link>
    </div>
  );
}

function FinanceMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "income" | "expense" | "default";
}) {
  return (
    <div className="min-w-0 px-2 text-center">
      <p className="truncate text-[11px] text-finance-muted">{label}</p>
      <p
        className={`mt-1 truncate text-sm font-semibold tabular-nums ${tone === "income" ? "text-finance-income" : tone === "expense" ? "text-finance-expense" : "text-finance-text"}`}
      >
        {value}
      </p>
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
