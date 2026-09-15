import { PageHeader } from "@/components/shared/PageHeader";
import { CreateHouseholdForm } from "@/features/household/components/CreateHouseholdForm";

export default function NewHouseholdPage() {
  return (
    <div className="finance-scope -mx-4 -mt-2 flex min-w-0 flex-col gap-4 px-4 pb-8 pt-3">
      <PageHeader title="สร้างครอบครัว" backHref="/household" />
      <CreateHouseholdForm />
    </div>
  );
}
