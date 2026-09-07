import { CreateHouseholdForm } from "@/features/household/components/CreateHouseholdForm";

export default function NewHouseholdPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">สร้างครอบครัว</h1>
      <CreateHouseholdForm />
    </div>
  );
}
