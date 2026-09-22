import Link from "next/link";

import { PageHeader } from "@/components/shared/PageHeader";
import { AppIcon } from "@/components/ui/AppIcon";
import { Card } from "@/components/ui/Card";
import { FormSheetButton } from "@/components/ui/FormSheetButton";
import { getMyPrimaryHousehold, listHouseholdMembers } from "@/features/household/api";
import { listShoppingItems } from "@/features/shopping/api";
import { ShoppingItemCard } from "@/features/shopping/components/ShoppingItemCard";
import { ShoppingItemForm } from "@/features/shopping/components/ShoppingItemForm";
import { requireUser } from "@/lib/auth/require-user";

export default async function ShoppingPage() {
  const { supabase, user } = await requireUser();
  const household = await getMyPrimaryHousehold(supabase, user.id);

  if (!household) {
    return (
      <div className="flex flex-col gap-4 pb-8">
        <PageHeader title="รายการซื้อของ" backHref="/" />
        <Card className="rounded-[1.5rem] text-center">
          <p className="font-medium">สร้างบ้านก่อนเริ่มรายการซื้อของร่วมกัน</p>
          <Link className="mt-3 inline-block text-primary" href="/household/new">
            สร้างบ้าน
          </Link>
        </Card>
      </div>
    );
  }

  const [items, members] = await Promise.all([
    listShoppingItems(supabase, household.id),
    listHouseholdMembers(supabase, household.id),
  ]);
  const pending = items.filter((item) => !item.purchased_at);
  const purchased = items.filter((item) => item.purchased_at);
  const canEdit = household.myRole !== "observer";

  return (
    <div className="finance-scope -mx-4 -mt-2 flex min-w-0 flex-col gap-5 px-4 pb-8 pt-3">
      <PageHeader title="รายการซื้อของ" backHref="/" />

      <section className="rounded-[1.65rem] bg-[linear-gradient(145deg,#eef4e9,#fffaf1_56%,#f8e5da)] p-5 shadow-card">
        <div className="flex items-center gap-4">
          <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-white/85 text-finance-primary-strong shadow-sm">
            <AppIcon name="shopping" className="size-7" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-finance-primary-strong">ของที่บ้านต้องใช้</p>
            <h1 className="mt-1 text-2xl font-semibold text-finance-text">ซื้อด้วยกัน ไม่ลืมกัน</h1>
            <p className="mt-1 text-sm text-finance-muted">
              เหลือ {pending.length} รายการ · ซื้อแล้ว {purchased.length} รายการ
            </p>
          </div>
        </div>
      </section>

      {canEdit ? (
        <FormSheetButton
          ariaLabel="เพิ่มของที่ต้องซื้อ"
          triggerClassName="fixed bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] right-[max(1.25rem,env(safe-area-inset-right))] z-20 flex size-14 items-center justify-center rounded-full bg-finance-primary text-white shadow-[0_8px_24px_rgb(79_112_88_/_0.3)] transition-transform active:scale-95"
          sheetTitle="เพิ่มของที่ต้องซื้อ"
          form={
            <ShoppingItemForm
              householdId={household.id}
              members={members.map((member) => ({
                id: member.id,
                label: member.profile?.display_name ?? member.profile?.email ?? "สมาชิก",
              }))}
            />
          }
          tone="finance"
        >
          <AppIcon name="plus" />
        </FormSheetButton>
      ) : (
        <p className="rounded-[1rem] bg-finance-primary-soft/60 px-4 py-3 text-sm text-finance-muted">
          ผู้สังเกตการณ์ดูรายการได้ แต่ไม่สามารถเพิ่มหรือเปลี่ยนแปลงรายการ
        </p>
      )}

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-finance-text">ต้องซื้อ</h2>
          <span className="text-sm text-finance-muted">{pending.length} รายการ</span>
        </div>
        {pending.length ? (
          pending.map((item) => (
            <ShoppingItemCard key={item.id} item={item} members={members} canEdit={canEdit} />
          ))
        ) : (
          <Card className="rounded-[1.35rem] bg-finance-surface-strong text-center">
            <p className="text-sm text-finance-muted">ซื้อครบแล้ว บ้านพร้อมมาก 🎉</p>
          </Card>
        )}
      </section>

      {purchased.length ? (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-finance-text">ซื้อแล้ว</h2>
            <span className="text-sm text-finance-muted">{purchased.length} รายการ</span>
          </div>
          {purchased.map((item) => (
            <ShoppingItemCard key={item.id} item={item} members={members} canEdit={canEdit} />
          ))}
        </section>
      ) : null}
    </div>
  );
}
