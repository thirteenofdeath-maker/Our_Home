import { PageHeader } from "@/components/shared/PageHeader";
import { CreateHouseholdForm } from "@/features/household/components/CreateHouseholdForm";

export default function NewHouseholdPage() {
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="สร้างครอบครัว" backHref="/household" />
      <CreateHouseholdForm />
    </div>
  );
}
