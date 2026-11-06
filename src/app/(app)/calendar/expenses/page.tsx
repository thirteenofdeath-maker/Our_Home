import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { PlanHeader } from "@/features/plan/components/PlanHeader";
import { AppIcon } from "@/components/ui/AppIcon";
import { APP_FAB_CLASSNAME } from "@/components/ui/fab";
import { Card } from "@/components/ui/Card";
import { FormSheetButton } from "@/components/ui/FormSheetButton";
import { monthKey, shiftMonth } from "@/features/calendar/domain/calendar";
import {
  getMyPrimaryHousehold,
  listHouseholdMembers,
} from "@/features/household/api";
import { listHouseholdExpenses } from "@/features/household-expenses/api";
import {
  expenseCategories,
  totalExpenseAmount,
} from "@/features/household-expenses/domain";
import { PlanTabs } from "@/features/plan/components/PlanTabs";
import { ExpenseSetupNotice } from "@/features/household-expenses/ExpenseSetupNotice";
import { ExpenseForm } from "@/features/household-expenses/ExpenseForm";
import { requireUser } from "@/lib/auth/require-user";
import { bangkokDateKey } from "@/lib/date/bangkok";
import { formatCurrency } from "@/lib/utils/money";

export default async function HouseholdExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; expense?: string }>;
}) {
  const { supabase, user } = await requireUser();
  const household = await getMyPrimaryHousehold(supabase, user.id);
  const query = await searchParams;
  const today = bangkokDateKey();

  if (!household) {
    return (
      <div className="finance-scope -mx-4 -mt-2 flex min-w-0 flex-col gap-5 px-4 pb-8 pt-3">
        <PlanHeader
          eyebrow="ดูแลค่าใช้จ่ายในบ้าน"
          title="ค่าใช้จ่ายบ้าน"
          subtitle="ติดตามรายจ่ายของบ้านไปด้วยกัน"
        />
        <PlanTabs active="expenses" />
        <Card>
          <Link href="/household/new">
            สร้างบ้านเพื่อเริ่มบันทึกค่าใช้จ่ายร่วมกัน
          </Link>
        </Card>
      </div>
    );
  }

  let month = monthKey(
    /^([1-9]\d{3})-(0[1-9]|1[0-2])$/.test(query.month ?? "")
      ? query.month
      : undefined,
  );
  const readyExpenses = await listHouseholdExpenses(
    supabase,
    household.id,
    month,
  );
  if (readyExpenses === null) {
    return (
      <div className="finance-scope -mx-4 -mt-2 flex min-w-0 flex-col gap-5 px-4 pb-8 pt-3">
        <PlanHeader
          eyebrow="ดูแลค่าใช้จ่ายในบ้าน"
          title="ค่าใช้จ่ายบ้าน"
          subtitle="ติดตามรายจ่ายของบ้านไปด้วยกัน"
        />
        <PlanTabs active="expenses" />
        <ExpenseSetupNotice />
      </div>
    );
  }
  if (query.expense) {
    if (!z.uuid().safeParse(query.expense).success) notFound();
    const { data, error } = await supabase
      .from("household_expenses")
      .select("paid_on")
      .eq("household_id", household.id)
      .eq("id", query.expense)
      .maybeSingle();
    if (error) throw error;
    if (!data) notFound();
    month = data.paid_on.slice(0, 7);
  }

  const [loadedExpenses, members] = await Promise.all([
    query.expense
      ? listHouseholdExpenses(supabase, household.id, month)
      : Promise.resolve(readyExpenses),
    listHouseholdMembers(supabase, household.id),
  ]);
  const expenses = loadedExpenses ?? [];
  const memberOptions = members
    .filter((member) => member.role !== "observer")
    .map((member) => ({
      id: member.user_id,
      label: member.profile?.display_name ?? member.profile?.email ?? "สมาชิก",
    }));
  const canEdit = household.myRole !== "observer";
  const formProps = {
    householdId: household.id,
    members: memberOptions,
    defaultPayer: user.id,
    defaultDate: today,
  };
  const monthLabel = new Intl.DateTimeFormat("th-TH", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${month}-01T12:00:00Z`));

  return (
    <div className="finance-scope -mx-4 -mt-2 flex min-w-0 flex-col gap-5 px-4 pb-8 pt-3">
      <PlanHeader
        eyebrow="ดูแลค่าใช้จ่ายในบ้าน"
        title="ค่าใช้จ่ายบ้าน"
        subtitle="ติดตามรายจ่ายของบ้านไปด้วยกัน"
        footer={
          <section
            aria-label="สรุปค่าใช้จ่ายเดือนที่เลือก"
            className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-[1.15rem] bg-finance-surface-strong/95 p-3 backdrop-blur-sm"
          >
            <div className="min-w-0 max-w-full flex-[1_1_auto]">
              <p className="text-xs text-finance-muted">รายจ่ายรวม</p>
              <p className="mt-1 max-w-full text-2xl font-semibold leading-tight tabular-nums text-finance-text [overflow-wrap:anywhere]">
                {formatCurrency(totalExpenseAmount(expenses), "THB")}
              </p>
            </div>
            <nav
              aria-label="เลือกเดือนค่าใช้จ่าย"
              className="grid min-w-0 max-w-full flex-[0_1_11rem] grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] items-center"
            >
              <Link
                aria-label="เดือนก่อน"
                href={`?month=${shiftMonth(month, -1)}`}
                className="flex size-11 items-center justify-center rounded-full text-finance-primary-strong hover:bg-finance-primary-soft/40"
              >
                <AppIcon name="chevron" className="size-4 rotate-180" />
              </Link>
              <p
                className="min-w-0 break-words text-center text-xs font-medium text-finance-text"
                aria-live="polite"
              >
                {monthLabel}
              </p>
              <Link
                aria-label="เดือนถัดไป"
                href={`?month=${shiftMonth(month, 1)}`}
                className="flex size-11 items-center justify-center rounded-full text-finance-primary-strong hover:bg-finance-primary-soft/40"
              >
                <AppIcon name="chevron" className="size-4" />
              </Link>
            </nav>
          </section>
        }
      />
      <PlanTabs active="expenses" />
      <div key="expenses" className="plan-content-transition contents">
        <div className="flex flex-wrap items-center gap-3">
          {canEdit ? (
            <FormSheetButton
              sheetTitle="เพิ่มค่าใช้จ่าย"
              tone="finance"
              ariaLabel="เพิ่มค่าใช้จ่าย"
              triggerClassName={APP_FAB_CLASSNAME}
              form={<ExpenseForm {...formProps} />}
            >
              <AppIcon name="plus" />
            </FormSheetButton>
          ) : null}
          <Link
            href="/calendar?view=shopping"
            className="px-2 py-2 text-sm font-medium text-finance-primary-strong"
          >
            รายการซื้อของ
          </Link>
        </div>
        <section aria-label="รายการค่าใช้จ่าย" className="grid gap-2">
          <div className="flex items-center justify-between gap-3 px-1">
            <h2 className="font-semibold text-finance-text">
              รายการค่าใช้จ่าย
            </h2>
            <span className="text-xs text-finance-muted">
              {expenses.length} รายการ
            </span>
          </div>
          {expenses.length > 0 ? (
            <details className="rounded-[1rem] bg-finance-surface-strong p-3">
              <summary className="min-h-11 content-center text-sm font-medium text-finance-primary-strong">
                สรุปตามหมวดหมู่
              </summary>
              <div className="mt-2 grid gap-2">
                {Object.entries(expenseCategories).map(([category, label]) => {
                  const entries = expenses.filter(
                    (expense) => expense.category === category,
                  );
                  return entries.length ? (
                    <div
                      key={category}
                      className="flex justify-between gap-3 text-sm"
                    >
                      <span>{label}</span>
                      <span>
                        {formatCurrency(totalExpenseAmount(entries), "THB")}
                      </span>
                    </div>
                  ) : null;
                })}
              </div>
            </details>
          ) : null}
          {expenses.length === 0 ? (
            <Card>เดือนนี้ยังไม่มีค่าใช้จ่ายบ้าน</Card>
          ) : null}
          {expenses.map((expense) => {
            const payer = memberOptions.find(
              (member) => member.id === expense.payer_id,
            );
            const highlighted = query.expense === expense.id;
            return (
              <Card
                key={expense.id}
                className={
                  highlighted ? "border-2 border-finance-primary" : undefined
                }
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words font-semibold">{expense.title}</p>
                    <p className="mt-1 text-xs text-finance-muted">
                      {expense.paid_on} ·{" "}
                      {
                        expenseCategories[
                          expense.category as keyof typeof expenseCategories
                        ]
                      }{" "}
                      · {payer?.label ?? "อดีตสมาชิก"}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-semibold tabular-nums">
                      {formatCurrency(expense.amount, "THB")}
                    </p>
                    {canEdit ? (
                      <FormSheetButton
                        sheetTitle="แก้ไขค่าใช้จ่าย"
                        tone="finance"
                        triggerClassName="mt-1 text-sm text-finance-primary-strong"
                        ariaLabel={`แก้ไข ${expense.title}`}
                        form={<ExpenseForm {...formProps} expense={expense} />}
                      >
                        แก้ไข
                      </FormSheetButton>
                    ) : null}
                  </div>
                </div>
              </Card>
            );
          })}
        </section>
      </div>
    </div>
  );
}
