import { CreateTemplateForm } from "@/features/templates/components/CreateTemplateForm";
import { getTemplateSheetData } from "@/features/templates/quick-add-data";

export default async function NewTemplatePage({
  searchParams,
}: {
  searchParams: Promise<{ fromTransactionId?: string }>;
}) {
  const { fromTransactionId } = await searchParams;
  const data = await getTemplateSheetData(fromTransactionId);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">สร้าง Template</h1>
      <CreateTemplateForm
        hasHousehold={data.hasHousehold}
        personalWallets={data.personalWallets}
        householdWallets={data.householdWallets}
        pocketsByWallet={data.pocketsByWallet}
        personalIncomeCategories={data.personalIncomeCategories}
        personalExpenseCategories={data.personalExpenseCategories}
        householdIncomeCategories={data.householdIncomeCategories}
        householdExpenseCategories={data.householdExpenseCategories}
        personalTags={data.personalTags}
        householdTags={data.householdTags}
        initialScope={data.initialScope}
        initialTransactionType={data.initialTransactionType}
        initialName={data.initialName}
        initialWalletId={data.initialWalletId}
        initialPocketId={data.initialPocketId}
        initialCategoryId={data.initialCategoryId}
        initialAmount={data.initialAmount}
        initialTitle={data.initialTitle}
        initialNote={data.initialNote}
        initialTagIds={data.initialTagIds}
      />
    </div>
  );
}
