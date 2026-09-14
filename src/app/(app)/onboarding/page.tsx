import { Card } from "@/components/ui/Card";
import { buttonClassName } from "@/components/ui/Button";
import { AddHouseholdTrigger } from "@/features/household/components/AddHouseholdTrigger";
import { AddWalletTrigger } from "@/features/wallets/components/AddWalletTrigger";

export default function OnboardingPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">ยินดีต้อนรับสู่ Our Home</h1>
        <p className="mt-1 text-sm text-foreground-muted">เริ่มต้นด้วยการสร้างกระเป๋าเงินส่วนตัว หรือสร้างครอบครัวเพื่อจัดการเงินร่วมกัน</p>
      </div>

      <Card className="flex flex-col gap-2">
        <h2 className="font-medium">การเงินส่วนตัว</h2>
        <p className="text-sm text-foreground-muted">สร้างกระเป๋าเงินของคุณเอง เช่น บัญชีธนาคารหรือเงินสด — ข้อมูลนี้เห็นเฉพาะคุณ</p>
        <AddWalletTrigger triggerClassName={buttonClassName("primary", "md")}>สร้างกระเป๋าเงินส่วนตัว</AddWalletTrigger>
      </Card>

      <Card className="flex flex-col gap-2">
        <h2 className="font-medium">การเงินครอบครัว</h2>
        <p className="text-sm text-foreground-muted">
          สร้างครอบครัว (คู่รัก คู่สมรส หรือสมาชิกในบ้าน) เพื่อแชร์กระเป๋าเงินร่วมกัน
        </p>
        <AddHouseholdTrigger triggerClassName={buttonClassName("secondary", "md")}>สร้างครอบครัว</AddHouseholdTrigger>
      </Card>
    </div>
  );
}
