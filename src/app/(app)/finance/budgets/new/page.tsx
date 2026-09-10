import { listCategories } from "@/features/categories/api";
import { buildCategoryTree } from "@/features/categories/domain/tree";
import { CreateBudgetForm } from "@/features/budgets/components/CreateBudgetForm";
import { currentFinanceMonth, financeMonthToPeriodMonth } from "@/features/finance/domain/finance";
import { getMyPrimaryHousehold } from "@/features/household/api";
import { requireUser } from "@/lib/auth/require-user";

export default async function NewBudgetPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { supabase, user } = await requireUser();
  const { month: rawMonth } = await searchParams;
  const month = rawMonth && /^\d{4}-\d{2}$/.test(rawMonth) ? rawMonth : currentFinanceMonth();
  const periodMonth = financeMonthToPeriodMonth(month);

  const household = await getMyPrimaryHousehold(supabase, user.id);
  const [personalCategories, householdCategories] = await Promise.all([
    listCategories(supabase, { transactionType: "EXPENSE", scope: "PERSONAL" }),
    household ? listCategories(supabase, { transactionType: "EXPENSE", scope: "HOUSEHOLD" }) : Promise.resolve([]),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">สร้างงบประมาณ</h1>
      <CreateBudgetForm
        periodMonth={periodMonth}
        hasHousehold={Boolean(household)}
        personalCategories={buildCategoryTree(personalCategories)}
        householdCategories={buildCategoryTree(householdCategories)}
      />
    </div>
  );
}
