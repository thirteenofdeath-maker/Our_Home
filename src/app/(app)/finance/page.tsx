import Link from "next/link";

import { Card } from "@/components/ui/Card";
import { AppIcon } from "@/components/ui/AppIcon";
import { getBudgetSummary } from "@/features/budgets/api";
import { BudgetCard } from "@/features/budgets/components/BudgetCard";
import { listBills, listBillOccurrences, materializeBills } from "@/features/bills/api";
import { BillOccurrenceCard } from "@/features/bills/components/BillOccurrenceCard";
import { listGoals } from "@/features/goals/api";
import { GoalCard } from "@/features/goals/components/GoalCard";
import { listDebts } from "@/features/debts/api";
import { getFinanceSummary, listRecentFinanceTransactions } from "@/features/finance/api";
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
import { bangkokDateKey } from "@/features/calendar/domain/calendar";
import { listUpcomingOccurrencesForScope, materializeRecurringOccurrences } from "@/features/recurring/api";
import { OccurrenceCard } from "@/features/recurring/components/OccurrenceCard";
import { TransactionHistoryList } from "@/features/transactions/components/TransactionHistoryList";
import { listMyWallets } from "@/features/wallets/api";
import { requireUser } from "@/lib/auth/require-user";
import { formatCurrency } from "@/lib/utils/money";

export default async function FinancePage() {
  const { supabase } = await requireUser();
  const month = currentFinanceMonth();
  const monthRange = financeMonthRange(month);
  // Personal-scope only on the Hub, matching Budget's compact section —
  // a household's upcoming items are visible in full on /finance/recurring.
  await materializeRecurringOccurrences(supabase, { scope: "PERSONAL" });
  await materializeBills(supabase, { scope: "PERSONAL" });
  const trendStart=financeMonthRange(shiftFinanceMonth(month,-5)).start;
  const [wallets, summary, recent, budgets, upcomingRecurring, bills, goals, debts, finalHub] = await Promise.all([
    listMyWallets(supabase),
    getFinanceSummary(supabase, monthRange),
    listRecentFinanceTransactions(supabase, 10),
    getBudgetSummary(supabase, { periodMonth: financeMonthToPeriodMonth(month), monthStart: monthRange.start, monthEnd: monthRange.end }),
    listUpcomingOccurrencesForScope(supabase, { scope: "PERSONAL", limit: 3 }),
    listBills(supabase, { scope: "PERSONAL" }),
    listGoals(supabase, "PERSONAL"),
    listDebts(supabase, "PERSONAL"),
    getFinalHub(supabase,{start:trendStart,end:monthRange.end,today:bangkokDateKey()}),
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
  const monthLabel = new Intl.DateTimeFormat("th-TH", { month: "long", year: "numeric", timeZone: "Asia/Bangkok" }).format(
    new Date(`${month}-01T00:00:00+07:00`),
  );

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <header>
        <p className="text-sm text-foreground-muted">{monthLabel}</p>
        <h1 className="text-xl font-semibold">การเงิน</h1>
      </header>

      <Card className="relative min-h-40 overflow-hidden rounded-[1.5rem] bg-finance-hero p-5 text-white shadow-card">
        <div className="relative z-[1] flex h-full flex-col justify-between gap-5">
          <div>
          <p className="text-sm font-medium text-white/75">ยอดเงินทั้งหมด</p>
          {/* One line per currency — never summed together (see docs/DOMAIN_RULES.md). */}
          <div className="mt-1 flex flex-col gap-2">
            {summary.currencyTotals.length ? (
              summary.currencyTotals.map((total) => (
                <p key={total.currency} className="text-3xl font-semibold tabular-nums text-white">
                  {formatCurrency(total.amount, total.currency)}
                </p>
              ))
            ) : (
              <p className="text-2xl font-semibold tabular-nums">฿0.00</p>
            )}
          </div>
          </div>
        <div className="flex flex-col gap-2 text-white">
          {summary.monthTotals.length ? (
            summary.monthTotals.map((total) => (
              <div key={total.currency} className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-white/70">รายรับเดือนนี้ ({total.currency})</p>
                  <p className="font-semibold tabular-nums">{formatCurrency(total.income, total.currency)}</p>
                </div>
                <div>
                  <p className="text-xs text-white/70">รายจ่ายเดือนนี้ ({total.currency})</p>
                  <p className="font-semibold tabular-nums">{formatCurrency(total.expense, total.currency)}</p>
                </div>
              </div>
            ))
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-white/70">รายรับเดือนนี้</p>
                <p className="font-semibold tabular-nums">฿0.00</p>
              </div>
              <div>
                <p className="text-xs text-white/70">รายจ่ายเดือนนี้</p>
                <p className="font-semibold tabular-nums">฿0.00</p>
              </div>
            </div>
          )}
        </div></div>
        <div aria-hidden="true" className="absolute -right-5 -top-5 flex size-32 items-center justify-center rounded-full bg-white/10 text-white/35"><AppIcon name="finance" className="size-16" /></div>
      </Card>

      {initialWallet ? (
        <Card className="flex flex-col gap-3">
          <div><h2 className="font-semibold">เพิ่มรายการ</h2><p className="text-sm text-foreground-muted">บันทึกรายรับ รายจ่าย หรือโอนเงิน</p></div>
          <section className="grid grid-cols-3 gap-2" aria-label="เพิ่มรายการด่วน">
            <Link href={financeIncomeHref(initialWallet.id)} className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-card bg-income/10 px-2 text-sm font-medium"><span className="flex size-11 items-center justify-center rounded-full bg-income/20 text-income"><AppIcon name="income" /></span><span>รายรับ</span></Link>
            <Link href={financeExpenseHref(initialWallet.id)} className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-card bg-expense/10 px-2 text-sm font-medium"><span className="flex size-11 items-center justify-center rounded-full bg-expense/20 text-expense"><AppIcon name="expense" /></span><span>รายจ่าย</span></Link>
            <Link href={financeTransferHref(initialWallet.id)} className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-card bg-secondary/70 px-2 text-sm font-medium"><span className="flex size-11 items-center justify-center rounded-full bg-transfer/15 text-transfer"><AppIcon name="transfer" /></span><span>โอนเงิน</span></Link>
          </section>
        </Card>
      ) : (
        <Card>
          <p className="text-sm text-foreground-muted">เพิ่มกระเป๋าเงินก่อนบันทึกรายการ</p>
          <Link href="/wallets/new" className="mt-2 inline-flex min-h-11 items-center text-primary">
            เพิ่มกระเป๋าเงิน
          </Link>
        </Card>
      )}

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">กระเป๋าเงิน</h2>
          <Link href="/wallets" className="flex min-h-11 items-center text-sm text-primary">
            จัดการกระเป๋าเงิน
          </Link>
        </div>
        {wallets.map((wallet) => (
          <Link key={wallet.id} href={`/wallets/${wallet.id}`}>
            <Card className="flex items-center justify-between">
              <div>
                <p className="font-medium">{wallet.name}</p>
                <p className="text-xs text-foreground-muted">{wallet.currency}</p>
              </div>
              <p className="tabular-nums">{formatCurrency(balanceByWallet.get(wallet.id) ?? "0.00", wallet.currency)}</p>
            </Card>
          </Link>
        ))}
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">รายการล่าสุด</h2>
          <Link href="/finance/transactions" className="flex min-h-11 items-center text-sm text-primary">
            ดูทั้งหมด
          </Link>
        </div>
        <TransactionHistoryList items={recent} />
      </section>

      {finalHub.netWorth.length?<section className="flex flex-col gap-2"><div className="flex justify-between"><h2 className="font-semibold">มูลค่าสุทธิ</h2><Link href="/finance/net-worth" className="text-primary">ดูรายละเอียด</Link></div><Card>{finalHub.netWorth.map(x=><p key={x.currency} className="text-lg font-semibold">{formatCurrency(x.amount,x.currency)}</p>)}</Card></section>:null}

      {finalHub.trend.length?<section className="flex flex-col gap-2"><div className="flex justify-between"><h2 className="font-semibold">แนวโน้ม 6 เดือน</h2><Link href="/finance/reports" className="text-primary">ดูรายงาน</Link></div>{finalHub.trend.slice(-3).map(x=><Card key={`${x.month}-${x.currency}`} className="flex justify-between"><span>{x.month} · {x.currency}</span><span className="text-sm">+{formatCurrency(x.income,x.currency)} / −{formatCurrency(x.expense,x.currency)}</span></Card>)}</section>:null}

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">หมวดหมู่รายจ่ายเดือนนี้</h2>
        {summary.categoryTotals.length ? (
          summary.categoryTotals.map((category) => (
            <Card key={`${category.categoryId ?? category.name}-${category.currency}`} className="flex items-center justify-between">
              <span>{category.name}</span>
              <span className="tabular-nums text-expense">{formatCurrency(category.amount, category.currency)}</span>
            </Card>
          ))
        ) : (
          <Card>
            <p className="text-sm text-foreground-muted">ยังไม่มีรายจ่ายเดือนนี้</p>
          </Card>
        )}
      </section>

      {budgets.active.length > 0 ? (
        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">งบประมาณเดือนนี้</h2>
            <Link href="/finance/budgets" className="flex min-h-11 items-center text-sm text-primary">
              ดูงบทั้งหมด
            </Link>
          </div>
          {budgets.active.slice(0, 3).map((item) => (
            <BudgetCard key={item.budgetId} item={item} compact />
          ))}
        </section>
      ) : null}

      {upcomingRecurring.length > 0 ? (
        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">รายการประจำที่กำลังจะถึง</h2>
            <Link href="/finance/recurring" className="flex min-h-11 items-center text-sm text-primary">
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
            <h2 className="font-semibold">บิลที่ต้องจ่าย</h2>
            <Link href="/finance/bills" className="flex min-h-11 items-center text-sm text-primary">ดูบิลทั้งหมด</Link>
          </div>
          {billOccurrences.map((item) => <BillOccurrenceCard key={item.occurrenceId} item={item} compact />)}
        </section>
      ) : null}

      {finalHub.installments.length?<section className="flex flex-col gap-2"><div className="flex justify-between"><h2 className="font-semibold">งวดผ่อนที่กำลังจะถึง</h2><Link href="/finance/installments" className="text-primary">ดูทั้งหมด</Link></div>{finalHub.installments.map(x=><Card key={x.id} className="flex justify-between"><span>{x.name} · {x.dueDate}</span><span>{formatCurrency(x.amount,x.currency)}</span></Card>)}</section>:null}

      {goals.some((goal) => !goal.archivedAt) ? <section className="flex flex-col gap-2"><div className="flex items-center justify-between"><h2 className="font-semibold">เป้าหมายการออม</h2><Link href="/finance/goals" className="text-sm text-primary">ดูทั้งหมด</Link></div>{goals.filter((goal) => !goal.archivedAt).slice(0, 3).map((goal) => <GoalCard key={goal.goalId} goal={goal} />)}</section> : null}

      {debts.some((debt) => !debt.archivedAt) ? <section className="flex flex-col gap-2"><div className="flex justify-between"><h2 className="font-semibold">หนี้และเงินยืม</h2><Link href="/finance/debts" className="text-sm text-primary">ดูทั้งหมด</Link></div>{debts.filter((debt) => !debt.archivedAt).slice(0,3).map((debt)=><Card key={debt.id} className="flex justify-between"><span>{debt.name}</span><span>{formatCurrency(debt.outstanding,debt.currency)}</span></Card>)}</section>:null}

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">เครื่องมือการเงิน</h2>
        {[
          { title: "จัดการเงิน", icon: "wallet" as const, items: [["/wallets", "กระเป๋าเงินและ Pocket"], ["/categories", "หมวดหมู่"], ["/finance/tags", "แท็ก"]] },
          { title: "วางแผน", icon: "calendar" as const, items: [["/finance/budgets", "งบประมาณ"], ["/finance/recurring", "รายการประจำ"], ["/finance/bills", "บิลและกำหนดจ่าย"], ["/finance/installments", "แผนผ่อนชำระ"], ["/finance/goals", "เป้าหมายการออม"], ["/finance/debts", "หนี้และเงินยืม"]] },
          { title: "วิเคราะห์", icon: "finance" as const, items: [["/finance/reports", "รายงานการเงิน"], ["/finance/net-worth", "มูลค่าสุทธิ"], ["/finance/insights", "ข้อมูลเชิงลึก"]] },
          { title: "ข้อมูล", icon: "transfer" as const, items: [["/finance/import", "นำเข้า CSV"], ["/finance/export", "ส่งออก CSV"]] },
        ].map((group) => (
          <div key={group.title}>
            <h3 className="mb-2 text-sm font-medium text-foreground-muted">{group.title}</h3>
            <Card className="divide-y divide-border p-0">
              {group.items.map(([href, label]) => <Link key={href} href={href} className="flex min-h-13 items-center gap-3 px-4"><span className="flex size-9 items-center justify-center rounded-full bg-primary-soft text-primary"><AppIcon name={group.icon} className="size-4" /></span><span className="flex-1 text-sm font-medium">{label}</span><AppIcon name="chevron" className="size-4 text-foreground-muted" /></Link>)}
            </Card>
          </div>
        ))}
      </section>
    </div>
  );
}
