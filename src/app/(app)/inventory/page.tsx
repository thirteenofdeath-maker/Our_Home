import Link from "next/link";

import { PageHeader } from "@/components/shared/PageHeader";
import { AppIcon } from "@/components/ui/AppIcon";
import { Card } from "@/components/ui/Card";
import { FormSheetButton } from "@/components/ui/FormSheetButton";
import { getMyPrimaryHousehold } from "@/features/household/api";
import { listInventoryItems } from "@/features/inventory/api";
import { InventoryItemCard } from "@/features/inventory/components/InventoryItemCard";
import { InventoryItemForm } from "@/features/inventory/components/InventoryItemForm";
import { isDateWithinDays, isLowStock } from "@/features/inventory/types";
import { bangkokDateKey } from "@/features/calendar/domain/calendar";
import { requireUser } from "@/lib/auth/require-user";

export default async function InventoryPage() {
  const { supabase, user } = await requireUser();
  const household = await getMyPrimaryHousehold(supabase, user.id);
  if (!household)
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title="คลังของในบ้าน" />
        <Card className="text-center">
          <p>สร้างบ้านก่อนเริ่มใช้คลังของร่วมกัน</p>
          <Link
            href="/household/new"
            className="mt-3 inline-block text-primary"
          >
            สร้างบ้าน
          </Link>
        </Card>
      </div>
    );
  const items = await listInventoryItems(supabase, household.id);
  const today = bangkokDateKey();
  const low = items.filter(isLowStock).length;
  const expiring = items.filter(
    (item) =>
      isDateWithinDays(item.expiry_date, today, 30) ||
      isDateWithinDays(item.warranty_expires_on, today, 30),
  ).length;
  const canEdit = household.myRole !== "observer";
  return (
    <div className="finance-scope -mx-4 -mt-2 flex min-w-0 flex-col gap-5 px-4 pb-8 pt-3">
      <PageHeader title="คลังของในบ้าน" />
      <section className="rounded-[1.65rem] time-tinted-panel p-5 shadow-card">
        <div className="flex items-center gap-4">
          <span className="flex size-14 items-center justify-center rounded-full bg-white/85 text-finance-primary-strong shadow-sm">
            <AppIcon name="inventory" className="size-7" />
          </span>
          <div>
            <p className="text-xs font-medium text-finance-primary-strong">
              ของที่บ้านมีอยู่
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-finance-text">
              รู้ก่อนหมด ไม่ซื้อซ้ำ
            </h1>
            <p className="mt-1 text-sm text-finance-muted">
              ทั้งหมด {items.length} · ควรเติม {low} · หมดอายุ/ใกล้กำหนด{" "}
              {expiring}
            </p>
          </div>
        </div>
      </section>
      {canEdit ? (
        <FormSheetButton
          ariaLabel="เพิ่มของในคลัง"
          triggerClassName="app-fab fixed bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] z-20 flex size-14 items-center justify-center rounded-full bg-finance-primary text-finance-primary-foreground shadow-[0_8px_24px_rgb(79_112_88_/_0.3)] active:scale-95"
          sheetTitle="เพิ่มของในคลัง"
          form={<InventoryItemForm householdId={household.id} />}
          tone="finance"
        >
          <AppIcon name="plus" />
        </FormSheetButton>
      ) : (
        <p className="rounded-[1rem] bg-finance-primary-soft/60 px-4 py-3 text-sm text-finance-muted">
          ผู้สังเกตการณ์ดูคลังได้ แต่ไม่สามารถเปลี่ยนแปลงข้อมูล
        </p>
      )}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-finance-text">รายการทั้งหมด</h2>
          <span className="text-sm text-finance-muted">
            {items.length} รายการ
          </span>
        </div>
        {items.length ? (
          items.map((item) => (
            <InventoryItemCard
              key={item.id}
              item={item}
              canEdit={canEdit}
              today={today}
            />
          ))
        ) : (
          <Card className="rounded-[1.35rem] text-center text-sm text-finance-muted">
            ยังไม่มีของในคลัง กด + เพื่อเริ่มบันทึก
          </Card>
        )}
      </section>
    </div>
  );
}
