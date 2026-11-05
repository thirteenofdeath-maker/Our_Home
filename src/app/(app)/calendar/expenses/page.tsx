import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { PageHeader } from "@/components/shared/PageHeader";
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
      <div className="grid gap-4 pb-8">
        <PageHeader title="ค่าใช้จ่ายบ้าน" backHref="/calendar" />
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

  const [expenses, members] = await Promise.all([
    listHouseholdExpenses(supabase, household.id, month),
    listHouseholdMembers(supabase, household.id),
  ]);
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
    <div className="finance-scope mx-auto grid w-full max-w-2xl gap-4 pb-8">
      <PageHeader title="ค่าใช้จ่ายบ้าน" backHref="/calendar" />
      <Card className="grid gap-3 rounded-[1.5rem] time-tinted-panel">
        <div className="flex items-center justify-between gap-2">
          <Link
            aria-label="เดือนก่อน"
            className="px-3 py-2"
            href={`?month=${shiftMonth(month, -1)}`}
          >
            ‹
          </Link>
          <h2 className="font-semibold">{monthLabel}</h2>
          <Link
            aria-label="เดือนถัดไป"
            className="px-3 py-2"
            href={`?month=${shiftMonth(month, 1)}`}
          >
            ›
          </Link>
        </div>
        <p className="text-sm text-finance-muted">จ่ายรวมเดือนนี้</p>
        <p className="text-2xl font-semibold tabular-nums">
          {formatCurrency(totalExpenseAmount(expenses), "THB")}
        </p>
        {Object.entries(expenseCategories).map(([category, label]) => {
          const entries = expenses.filter(
            (expense) => expense.category === category,
          );
          return entries.length ? (
            <div key={category} className="flex justify-between gap-3 text-sm">
              <span>{label}</span>
              <span>{formatCurrency(totalExpenseAmount(entries), "THB")}</span>
            </div>
          ) : null;
        })}
      </Card>
      <div className="flex flex-wrap items-center gap-3">
        {canEdit ? (
          <FormSheetButton
            sheetTitle="เพิ่มค่าใช้จ่าย"
            tone="finance"
            triggerClassName="rounded-xl bg-finance-primary px-4 py-2.5 font-medium text-finance-primary-foreground"
            form={<ExpenseForm {...formProps} />}
          >
            + เพิ่มค่าใช้จ่าย
          </FormSheetButton>
        ) : null}
        <Link
          href="/shopping"
          className="px-2 py-2 text-sm font-medium text-finance-primary-strong"
        >
          รายการซื้อของ
        </Link>
      </div>
      <section aria-label="รายการค่าใช้จ่าย" className="grid gap-2">
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
  );
}
