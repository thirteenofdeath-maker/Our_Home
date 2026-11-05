import { Card } from "@/components/ui/Card";
import { buttonClassName } from "@/components/ui/Button";
import { AddHouseholdTrigger } from "@/features/household/components/AddHouseholdTrigger";

export default function OnboardingPage() {
  return (
    <Card className="flex flex-col gap-3">
      <h1 className="text-xl font-semibold">ยินดีต้อนรับสู่ Our Home</h1>
      <p className="text-sm text-foreground-muted">
        สร้างครอบครัวเพื่อแชร์แผนงาน รายการซื้อของ และค่าใช้จ่ายบ้าน
      </p>
      <AddHouseholdTrigger triggerClassName={buttonClassName("primary", "md")}>
        สร้างครอบครัว
      </AddHouseholdTrigger>
    </Card>
  );
}
