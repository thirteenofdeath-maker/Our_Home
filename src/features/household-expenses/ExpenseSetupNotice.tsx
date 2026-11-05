import { Card } from "@/components/ui/Card";

export function ExpenseSetupNotice() {
  return (
    <Card className="landscape-span-full grid gap-1">
      <h2 className="font-semibold">กำลังเตรียมระบบค่าใช้จ่ายบ้าน</h2>
      <p className="text-sm text-finance-muted">
        เวอร์ชันนี้ยังรออัปเดตฐานข้อมูลและย้ายรายการเดิม
        จึงยังดูยอดหรือเพิ่มค่าใช้จ่ายไม่ได้
      </p>
    </Card>
  );
}
