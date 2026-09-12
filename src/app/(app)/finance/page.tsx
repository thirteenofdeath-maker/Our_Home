import Link from "next/link";

import { AppIcon } from "@/components/ui/AppIcon";
import { getBudgetSummary } from "@/features/budgets/api";
import { AddBudgetFab } from "@/features/budgets/components/AddBudgetFab";
import { BudgetCard } from "@/features/budgets/components/BudgetCard";
import { AddWalletTrigger } from "@/features/wallets/components/AddWalletTrigger";
import { listBills, listBillOccurrences, materializeBills } from "@/features/bills/api";
import { BillOccurrenceCard } from "@/features/bills/components/BillOccurrenceCard";
import { bangkokDateKey } from "@/features/calendar/domain/calendar";
import { getFinanceSummary, listRecentFinanceTransactions } from "@/features/finance/api";
import { FinanceModuleTabs } from "@/features/finance/components/FinanceModuleTabs";
import { FinanceTrendCard } from "@/features/finance/components/FinanceTrendCard";
import {
  currentFinanceMonth,
  financeExpenseHref,
  financeIncomeHref,
  financeMonthRange,
  financeMonthToPeriodMonth,
  financeTransferHref,
  shiftFinanceMonth,
} from "@/features/finance/domain/finance";
import { getFinalHub } from "@/features/finance/final-api";
import { listUpcomingOccurrencesForScope, materializeRecurringOccurrences } from "@/features/recurring/api";
import { OccurrenceCard } from "@/features/recurring/components/OccurrenceCard";
import { TransactionHistoryList } from "@/features/transactions/components/TransactionHistoryList";
import { listMyWallets } from "@/features/wallets/api";
import { WalletVisualCard } from "@/features/wallets/components/WalletVisualCard";
import { requireUser } from "@/lib/auth/require-user";
import { formatCurrency, subtractMoney } from "@/lib/utils/money";

const SHORTCUTS: Array<{ href: string; label: string; icon: "wallet" | "pocket" | "transfer" | "finance" }> = [
  { href: "/categories", label: "หมวดหมู่", icon: "pocket" },
  { href: "/finance/tags", label: "แท็ก", icon: "pocket" },
  { href: "/finance/templates", label: "Template", icon: "wallet" },
  { href: "/finance/recurring", label: "รายการประจำ", icon: "finance" },
  { href: "/finance/bills", label: "บิล", icon: "finance" },
  { href: "/finance/insights", label: "ข้อมูลเชิงลึก", icon: "finance" },
  { href: "/finance/import", label: "นำเข้า CSV", icon: "transfer" },
  { href: "/finance/export", label: "ส่งออก CSV", icon: "transfer" },
];

export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { supabase } = await requireUser();
  const { month: rawMonth } = await searchParams;
  const month = rawMonth && /^\d{4}-\d{2}$/.test(rawMonth) ? rawMonth : currentFinanceMonth();
  const monthRange = financeMonthRange(month);
  const prevMonth = shiftFinanceMonth(month, -1);
  const nextMonth = shiftFinanceMonth(month, 1);
  const monthLabel = new Intl.DateTimeFormat("th-TH", { month: "long", year: "numeric", timeZone: "Asia/Bangkok" }).format(
    new Date(`${month}-01T00:00:00+07:00`),
  );

  // Personal-scope only on the Hub, matching Budget's compact section —
  // a household's upcoming items are visible in full on /finance/recurring.
  await materializeRecurringOccurrences(supabase, { scope: "PERSONAL" });
  await materializeBills(supabase, { scope: "PERSONAL" });
  const trendStart = financeMonthRange(shiftFinanceMonth(month, -5)).start;
  const [wallets, summary, recent, budgets, upcomingRecurring, bills, finalHub] = await Promise.all([
    listMyWallets(supabase),
    getFinanceSummary(supabase, monthRange),
    listRecentFinanceTransactions(supabase, 10),
    getBudgetSummary(supabase, { periodMonth: financeMonthToPeriodMonth(month), monthStart: monthRange.start, monthEnd: monthRange.end }),
    listUpcomingOccurrencesForScope(supabase, { scope: "PERSONAL", limit: 3 }),
    listBills(supabase, { scope: "PERSONAL" }),
    getFinalHub(supabase, { start: trendStart, end: monthRange.end, today: bangkokDateKey() }),
  ]);
  const billOccurrences = await listBillOccurrences(supabase, bills.filter((b) => !b.pausedAt).map((b) => b.billId), { status: "OPEN", limit: 3 });
  billOccurrences.sort((a, b) => {
    const rank = (status: string) => (status === "OVERDUE" ? 0 : status === "DUE" ? 1 : 2);
    return rank(a.displayStatus) - rank(b.displayStatus) || a.dueDate.localeCompare(b.dueDate);
  });
  const balanceByWallet = new Map(summary.walletBalances.map((item) => [item.walletId, item.amount]));
  // Initial route convenience only. TransactionForm visibly exposes all active
  // wallets and persists no default-wallet preference.
  const initialWallet = wallets[0];

  return (
    <div className="finance-scope -mx-4 flex flex-col gap-4 px-4 pb-6 pt-2">
      <FinanceModuleTabs />

      <div className="flex items-center justify-between">
        <Link href={`/finance?month=${prevMonth}`} aria-label="เดือนก่อนหน้า" className="flex size-8 items-center justify-center rounded-full bg-finance-surface-strong text-finance-text shadow-sm">
          <AppIcon name="chevron" className="size-4 rotate-180" />
        </Link>
        <div className="flex flex-wrap items-baseline justify-center gap-x-3 gap-y-0.5">
          <p className="text-sm font-medium text-finance-text">{monthLabel}</p>
          {summary.currencyTotals.length ? (
            summary.currencyTotals.map((total) => (
              <p key={total.currency} className="text-lg font-semibold tabular-nums text-finance-text">
                {formatCurrency(total.amount, total.currency)}
                {summary.currencyTotals.length > 1 ? <span className="ml-1 text-xs font-normal text-finance-muted">{total.currency}</span> : null}
              </p>
            ))
          ) : (
            <p className="text-sm text-finance-muted">ยังไม่มียอดเงิน</p>
          )}
        </div>
        <Link href={`/finance?month=${nextMonth}`} aria-label="เดือนถัดไป" className="flex size-8 items-center justify-center rounded-full bg-finance-surface-strong text-finance-text shadow-sm">
          <AppIcon name="chevron" className="size-4" />
        </Link>
      </div>

      {initialWallet ? (
        <section className="flex flex-col gap-2">
          <div className="flex items-baseline gap-2">
            <h2 className="font-semibold text-finance-text">เพิ่มรายการ</h2>
            <p className="text-xs text-finance-muted">บันทึกรายรับ รายจ่าย หรือโอนเงิน</p>
          </div>
          <div className="grid grid-cols-3 gap-2" aria-label="เพิ่มรายการด่วน">
            <Link href={financeIncomeHref(initialWallet.id)} className="flex min-h-18 flex-col items-center justify-center gap-1.5 rounded-[1.25rem] bg-finance-surface-strong text-sm font-medium text-finance-text shadow-sm">
              <span className="flex size-9 items-center justify-center rounded-full bg-finance-income/15 text-finance-income"><AppIcon name="income" /></span>รายรับ
            </Link>
            <Link href={financeExpenseHref(initialWallet.id)} className="flex min-h-18 flex-col items-center justify-center gap-1.5 rounded-[1.25rem] bg-finance-surface-strong text-sm font-medium text-finance-text shadow-sm">
              <span className="flex size-9 items-center justify-center rounded-full bg-finance-expense/15 text-finance-expense"><AppIcon name="expense" /></span>รายจ่าย
            </Link>
            <Link href={financeTransferHref(initialWallet.id)} className="flex min-h-18 flex-col items-center justify-center gap-1.5 rounded-[1.25rem] bg-finance-surface-strong text-sm font-medium text-finance-text shadow-sm">
              <span className="flex size-9 items-center justify-center rounded-full bg-finance-transfer/15 text-finance-transfer"><AppIcon name="transfer" /></span>โอนเงิน
            </Link>
          </div>
        </section>
      ) : (
        <div className="rounded-[1.25rem] bg-finance-surface-strong p-4 shadow-sm">
          <p className="text-sm text-finance-muted">เพิ่มกระเป๋าเงินก่อนบันทึกรายการ</p>
          <AddWalletTrigger triggerClassName="mt-2 inline-flex min-h-11 items-center text-finance-primary-strong">
            เพิ่มกระเป๋าเงิน
          </AddWalletTrigger>
        </div>
      )}

      <section className="flex flex-col gap-3">
        {summary.monthTotals.length ? (
          summary.monthTotals.map((total) => (
            <FinanceTrendCard
              key={total.currency}
              currency={total.currency}
              showCurrencyLabel={summary.monthTotals.length > 1}
              trend={finalHub.trend.filter((point) => point.currency === total.currency)}
              income={total.income}
              expense={total.expense}
              net={subtractMoney(total.income, total.expense)}
            />
          ))
        ) : (
          <FinanceTrendCard currency="THB" showCurrencyLabel={false} trend={[]} income="0.00" expense="0.00" net="0.00" />
        )}
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-finance-text">งบประมาณเดือนนี้</h2>
          <Link href="/finance/budgets" className="flex min-h-11 items-center text-sm text-finance-primary-strong">
            ดูงบทั้งหมด
          </Link>
        </div>
        {budgets.active.length > 0 ? (
          <div className="flex flex-col gap-2">
            {budgets.active.slice(0, 3).map((item) => (
              <BudgetCard key={item.budgetId} item={item} compact />
            ))}
          </div>
        ) : (
          <AddBudgetFab periodMonth={financeMonthToPeriodMonth(month)} asHubCard />
        )}
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-finance-text">กระเป๋าเงิน</h2>
          <Link href="/wallets" className="flex min-h-11 items-center text-sm text-finance-primary-strong">
            ดูทั้งหมด
          </Link>
        </div>
        {wallets.length > 0 ? (
          <div className="-mx-4 flex gap-3 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {wallets.map((wallet, index) => (
              <WalletVisualCard
                key={wallet.id}
                id={wallet.id}
                name={wallet.name}
                currency={wallet.currency}
                scopeLabel={wallet.scope === "PERSONAL" ? "ส่วนตัว" : "ครอบครัว"}
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
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-finance-text">รายการล่าสุด</h2>
          <Link href="/finance/transactions" className="flex min-h-11 items-center text-sm text-finance-primary-strong">
            ดูทั้งหมด
          </Link>
        </div>
        <TransactionHistoryList items={recent.slice(0, 5)} variant="dashboard" />
      </section>

      {upcomingRecurring.length > 0 ? (
        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-finance-text">รายการประจำที่กำลังจะถึง</h2>
            <Link href="/finance/recurring" className="flex min-h-11 items-center text-sm text-finance-primary-strong">
              ดูทั้งหมด
            </Link>
          </div>
          {upcomingRecurring.map((item) => (
            <OccurrenceCard key={item.occurrenceId} item={item} compact />
          ))}
        </section>
      ) : null}

      {billOccurrences.length > 0 ? (
        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-finance-text">บิลที่ต้องจ่าย</h2>
            <Link href="/finance/bills" className="flex min-h-11 items-center text-sm text-finance-primary-strong">ดูบิลทั้งหมด</Link>
          </div>
          {billOccurrences.map((item) => <BillOccurrenceCard key={item.occurrenceId} item={item} compact />)}
        </section>
      ) : null}

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-finance-muted">เครื่องมือเพิ่มเติม</h2>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {SHORTCUTS.map((shortcut) => (
            <Link
              key={shortcut.href}
              href={shortcut.href}
              className="flex h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-full bg-finance-surface-strong px-4 text-sm font-medium text-finance-text shadow-sm"
            >
              <AppIcon name={shortcut.icon} className="size-4 text-finance-muted" />
              {shortcut.label}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
