import { notFound, redirect } from "next/navigation";
import { z } from "zod";

import { PageHeader } from "@/components/shared/PageHeader";
import { Card } from "@/components/ui/Card";
import {
  getMyPrimaryHousehold,
  listHouseholdMembers,
} from "@/features/household/api";
import {
  ExpenseForm,
  MarkReceiptPurchasedForm,
} from "@/features/household-expenses/ExpenseForm";
import { requireUser } from "@/lib/auth/require-user";
import { bangkokDateKey } from "@/lib/date/bangkok";

export default async function ShoppingReceiptPage({
  searchParams,
}: {
  searchParams: Promise<{ item?: string | string[] }>;
}) {
  const { item } = await searchParams;
  const ids = [...new Set(typeof item === "string" ? [item] : (item ?? []))];
  if (!ids.length || !z.array(z.uuid()).max(100).safeParse(ids).success)
    redirect("/calendar?view=shopping");

  const { supabase, user } = await requireUser();
  const household = await getMyPrimaryHousehold(supabase, user.id);
  if (!household || household.myRole === "observer") notFound();

  const [{ data: items, error }, members] = await Promise.all([
    supabase
      .from("shopping_items")
      .select("id, name, household_expense_id, purchased_at")
      .eq("household_id", household.id)
      .is("archived_at", null)
      .in("id", ids),
    listHouseholdMembers(supabase, household.id),
  ]);
  if (error) throw error;
  if (items.length !== ids.length) notFound();
  if (items.length === 1 && items[0].household_expense_id) {
    redirect(`/calendar/expenses?expense=${items[0].household_expense_id}`);
  }

  return (
    <div className="finance-scope mx-auto grid w-full max-w-xl gap-4 pb-8">
      <PageHeader
        title="ลงค่าใช้จ่ายจากบิล"
        backHref="/calendar?view=shopping"
      />
      <Card>
        <ul className="list-disc space-y-1 pl-5">
          {items.map((entry) => (
            <li key={entry.id}>{entry.name}</li>
          ))}
        </ul>
        <p className="mt-2 text-sm text-finance-muted">
          ใส่ยอดรวมของบิลหนึ่งครั้งสำหรับรายการเหล่านี้
        </p>
      </Card>
      {items.some((entry) => entry.household_expense_id) ? (
        <Card>บางรายการลงค่าใช้จ่ายแล้ว กรุณากลับไปตรวจสอบรายการที่เลือก</Card>
      ) : (
        <ExpenseForm
          householdId={household.id}
          defaultPayer={user.id}
          defaultDate={
            items[0].purchased_at
              ? bangkokDateKey(new Date(items[0].purchased_at))
              : bangkokDateKey()
          }
          items={items}
          members={members
            .filter((member) => member.role !== "observer")
            .map((member) => ({
              id: member.user_id,
              label:
                member.profile?.display_name ??
                member.profile?.email ??
                "สมาชิก",
            }))}
        />
      )}
      {items.some((entry) => !entry.purchased_at) &&
      !items.some((entry) => entry.household_expense_id) ? (
        <MarkReceiptPurchasedForm itemIds={ids} />
      ) : null}
    </div>
  );
}
