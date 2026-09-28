import { FormSheetButton } from "@/components/ui/FormSheetButton";
import { AppIcon, type AppIconName } from "@/components/ui/AppIcon";
import { EmptyState } from "@/components/ui/EmptyState";
import { listChoreWorkspace } from "@/features/chores/api";
import { listRecentFinanceTransactions } from "@/features/finance/api";
import {
  getMyPrimaryHousehold,
  listHouseholdMembers,
} from "@/features/household/api";
import { AddHouseholdTrigger } from "@/features/household/components/AddHouseholdTrigger";
import { AddMemberForm } from "@/features/household/components/AddMemberForm";
import { HouseholdOverview } from "@/features/household/components/HouseholdOverview";
import {
  canInviteRole,
  countFamilyMembers,
} from "@/features/household/domain/member";
import { listInventoryItems } from "@/features/inventory/api";
import {
  inventoryQuantityLabel,
  isDateWithinDays,
  isLowStock,
} from "@/features/inventory/types";
import { listPetCareRecords, listPets } from "@/features/pets/api";
import { PET_CARE_RECORD_LABEL } from "@/features/pets/domain/care-record";
import { listShoppingItems } from "@/features/shopping/api";
import { requireUser } from "@/lib/auth/require-user";
import { bangkokDateKey } from "@/lib/date/bangkok";
import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";

export default async function HouseholdPage() {
  const { supabase, user } = await requireUser();
  const household = await getMyPrimaryHousehold(supabase, user.id);

  if (!household) {
    return (
      <EmptyState
        title="ยังไม่มีครอบครัว"
        description="สร้างครอบครัวเพื่อแชร์กระเป๋าเงินและหมวดหมู่ร่วมกัน"
        action={
          <AddHouseholdTrigger triggerClassName="flex h-11 items-center justify-center rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground">
            สร้างครอบครัว
          </AddHouseholdTrigger>
        }
      />
    );
  }

  const today = bangkokDateKey();
  const [members, pets, recentTransactions, chores, shopping, inventory] =
    await Promise.all([
      listHouseholdMembers(supabase, household.id, { includeObservers: true }),
      listPets(supabase, household.id),
      listRecentFinanceTransactions(supabase, {
        limit: 5,
        scope: "HOUSEHOLD",
        householdId: household.id,
      }),
      listChoreWorkspace(supabase, household.id),
      listShoppingItems(supabase, household.id),
      listInventoryItems(supabase, household.id),
    ]);
  const petRecords = (
    await Promise.all(pets.map((pet) => listPetCareRecords(supabase, pet.id)))
  )
    .flat()
    .toSorted((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 5);
  // Same permission rule that already gates the "เพิ่มสมาชิก" AddMemberForm
  // on /household/members (canInviteRole(role, "member") is true for
  // owner/admin) — reused here, not a new authorization rule. The full
  // manage/remove-members flow stays on /household/members (still linked
  // from HouseholdOverview below) — this FAB is only the single-creation-
  // type "add a member" shortcut, so its form slides up directly.
  const canManageMembers = canInviteRole(household.myRole, "member");
  const choreTemplates = new Map(
    chores.templates.map((template) => [template.id, template]),
  );
  const openChores = chores.occurrences
    .filter((item) => !item.completed_at)
    .toSorted((a, b) => a.due_date.localeCompare(b.due_date));
  const pendingShopping = shopping.filter((item) => !item.purchased_at);
  const attentionInventory = inventory.filter(
    (item) =>
      isLowStock(item) ||
      isDateWithinDays(item.expiry_date, today, 30) ||
      isDateWithinDays(item.warranty_expires_on, today, 30),
  );
  return (
    <div className="landscape-household-grid finance-scope -mx-4 -mt-2 flex min-w-0 flex-col gap-6 px-4 pb-8 pt-3">
      {canManageMembers ? (
        <FormSheetButton
          ariaLabel="เพิ่มสมาชิก"
          triggerClassName="app-fab fixed z-20 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_8px_24px_rgb(0_0_0_/_0.24)] transition-transform active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary bottom-[calc(env(safe-area-inset-bottom)+5.5rem)]"
          sheetTitle="เพิ่มสมาชิก"
          tone="finance"
          form={
            <AddMemberForm
              householdId={household.id}
              canInviteAdmin={household.myRole === "owner"}
              variant="sheet"
            />
          }
        >
          <AppIcon name="plus" />
        </FormSheetButton>
      ) : null}
      <section className="app-cover app-cover-household light-cover-copy time-cover relative h-48 overflow-hidden rounded-[1.75rem] p-5 shadow-card sm:h-52 sm:p-6">
        <Image
          src="/art/family-garden.webp"
          alt="สมาชิกในบ้านใช้เวลาร่วมกันในสวน"
          fill
          priority
          sizes="(orientation: landscape) and (min-width: 1024px) calc(100vw - 7rem), (min-width: 700px) calc(100vw - 3rem), 100vw"
          className="app-cover-image time-cover-image object-cover object-center"
        />
        <div
          aria-hidden="true"
          className="time-cover-overlay absolute inset-0"
        />
        <div className="relative flex h-full max-w-[62%] flex-col">
          <p className="text-xs font-medium text-finance-primary-strong">
            บ้านของเรา
          </p>
          <h1 className="mt-1 text-3xl font-semibold leading-tight text-finance-text">
            {household.name}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-finance-muted">
            อยู่ด้วยกัน มีความสุขเสมอ
          </p>
          <div className="mt-auto flex w-fit items-center gap-1.5 rounded-full bg-white/80 px-2.5 py-1.5 text-xs font-semibold text-finance-text backdrop-blur-sm">
            <AppIcon
              name="household"
              className="size-4 text-finance-primary-strong"
            />
            {countFamilyMembers(members)} คน
          </div>
        </div>
      </section>

      <section
        aria-label="การจัดการบ้าน"
        className="landscape-span-full grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
      >
        <HouseholdModuleCard
          title="งานบ้าน"
          href="/chores"
          icon="chores"
          summary={
            openChores.length
              ? `เหลือ ${openChores.length} งานที่ยังไม่เสร็จ`
              : "งานบ้านเรียบร้อยแล้ว"
          }
        >
          {openChores.slice(0, 2).map((chore) => (
            <HouseholdModuleItem
              key={chore.id}
              href="/chores"
              label={chore.due_date < today ? "ค้าง" : "งานถัดไป"}
              title={choreTemplates.get(chore.template_id)?.title ?? "งานบ้าน"}
              detail={chore.due_date}
            />
          ))}
          {openChores.length === 0 ? (
            <HouseholdModuleEmpty text="ไม่มีงานบ้านค้างอยู่" />
          ) : null}
        </HouseholdModuleCard>

        <HouseholdModuleCard
          title="รายการซื้อของ"
          href="/shopping"
          icon="shopping"
          summary={
            pendingShopping.length
              ? `รอซื้อ ${pendingShopping.length} รายการ`
              : "ซื้อครบตามรายการแล้ว"
          }
        >
          {pendingShopping.slice(0, 2).map((item) => (
            <HouseholdModuleItem
              key={item.id}
              href="/shopping"
              label="ต้องซื้อ"
              title={item.name}
              detail={`${item.quantity}${item.unit ? ` ${item.unit}` : ""}`}
            />
          ))}
          {pendingShopping.length === 0 ? (
            <HouseholdModuleEmpty text="ยังไม่มีของที่ต้องซื้อ" />
          ) : null}
        </HouseholdModuleCard>

        <HouseholdModuleCard
          title="คลังของในบ้าน"
          href="/inventory"
          icon="inventory"
          summary={
            attentionInventory.length
              ? `มี ${attentionInventory.length} รายการที่ควรตรวจดู`
              : `ของในคลัง ${inventory.length} รายการอยู่ในสถานะปกติ`
          }
        >
          {attentionInventory.slice(0, 2).map((item) => (
            <HouseholdModuleItem
              key={item.id}
              href={`/inventory/${item.id}`}
              label={isLowStock(item) ? "ใกล้หมด" : "ใกล้กำหนด"}
              title={item.name}
              detail={inventoryQuantityLabel(item)}
            />
          ))}
          {attentionInventory.length === 0 ? (
            <HouseholdModuleEmpty text="ยังไม่มีของใกล้หมดหรือใกล้กำหนด" />
          ) : null}
        </HouseholdModuleCard>
      </section>

      <div className="landscape-household-columns flex min-w-0 flex-col gap-6">
        <div className="landscape-household-column flex min-w-0 flex-col gap-6">
          <HouseholdOverview
            members={members}
            userId={user.id}
            role={household.myRole}
          />
        </div>
        <div className="landscape-household-column flex min-w-0 flex-col gap-6">
          <section className="landscape-household-info grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-[1.4rem] bg-finance-surface-strong p-4 shadow-card">
              <div className="flex items-center gap-2">
                <AppIcon
                  name="info"
                  className="size-5 text-finance-primary-strong"
                />
                <h2 className="font-semibold text-finance-text">
                  ข้อมูลส่วนตัว
                </h2>
              </div>
              <p className="mt-1 text-sm text-finance-muted">
                มีเพียงคุณที่ดูและแก้ไขได้ เหมาะกับโน้ต งาน และการเงินส่วนตัว
              </p>
            </div>
            <div className="rounded-[1.4rem] bg-finance-primary-soft p-4 shadow-card">
              <div className="flex items-center gap-2">
                <AppIcon
                  name="household"
                  className="size-5 text-finance-primary-strong"
                />
                <h2 className="font-semibold text-finance-text">
                  ข้อมูลของบ้าน
                </h2>
              </div>
              <p className="mt-1 text-sm text-finance-muted">
                สมาชิกในบ้านเห็นข้อมูลร่วมกันตามบทบาทของตน
              </p>
            </div>
          </section>
          <section className="landscape-household-activity flex flex-col gap-3">
            <div>
              <p className="text-sm text-finance-muted">ความเคลื่อนไหวในบ้าน</p>
              <h2 className="font-semibold text-finance-text">กิจกรรมล่าสุด</h2>
            </div>
            {[
              ...recentTransactions.map((item) => ({
                id: `finance-${item.transactionId}`,
                href: `/finance/transactions/${item.transactionId}`,
                title: item.title ?? item.categoryName ?? "รายการการเงิน",
                detail: `${item.creatorName ?? "สมาชิก"} · การเงิน`,
                at: item.occurredAt,
              })),
              ...petRecords.map((record) => ({
                id: `pet-${record.id}`,
                href: `/pets/${record.pet_id}`,
                title: record.title,
                detail: `${members.find((member) => member.user_id === record.created_by)?.profile?.display_name ?? "สมาชิก"} · ${PET_CARE_RECORD_LABEL[record.record_type]}`,
                at: record.created_at,
              })),
            ]
              .toSorted((a, b) => b.at.localeCompare(a.at))
              .slice(0, 6)
              .map((activity) => (
                <Link
                  key={activity.id}
                  href={activity.href}
                  className="rounded-[1.25rem] bg-finance-surface-strong p-4 shadow-card"
                >
                  <p className="font-medium text-finance-text">
                    {activity.title}
                  </p>
                  <p className="text-sm text-finance-muted">
                    {activity.detail}
                  </p>
                </Link>
              ))}
            {recentTransactions.length === 0 && petRecords.length === 0 ? (
              <div className="rounded-[1.25rem] bg-finance-surface-strong p-4 shadow-card">
                <p className="text-sm text-finance-muted">
                  ยังไม่มีกิจกรรมล่าสุด
                </p>
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );
}

function HouseholdModuleCard({
  title,
  href,
  icon,
  summary,
  children,
}: {
  title: string;
  href: string;
  icon: AppIconName;
  summary: string;
  children: ReactNode;
}) {
  return (
    <section className="min-w-0 rounded-[1.5rem] bg-finance-surface-strong p-4 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-finance-primary-soft text-finance-primary-strong">
            <AppIcon name={icon} className="size-5" />
          </span>
          <h2 className="truncate font-semibold text-finance-text">{title}</h2>
        </div>
        <Link
          href={href}
          className="shrink-0 text-sm font-medium text-finance-primary-strong"
        >
          ดูทั้งหมด
        </Link>
      </div>
      <p className="mb-3 mt-2 text-sm text-finance-muted">{summary}</p>
      <div className="flex min-w-0 flex-col gap-2">{children}</div>
    </section>
  );
}

function HouseholdModuleItem({
  href,
  label,
  title,
  detail,
}: {
  href: string;
  label: string;
  title: string;
  detail: string;
}) {
  return (
    <Link
      href={href}
      className="flex min-w-0 items-center gap-2 rounded-[1rem] bg-finance-primary-soft/30 px-3 py-2.5 transition-colors hover:bg-finance-primary-soft/55"
    >
      <span className="shrink-0 rounded-full bg-finance-primary-soft px-2 py-0.5 text-[10px] font-medium text-finance-primary-strong">
        {label}
      </span>
      <p className="min-w-0 flex-1 truncate text-sm font-medium text-finance-text">
        {title}
      </p>
      <p className="max-w-[34%] shrink-0 truncate text-xs text-finance-muted">
        {detail}
      </p>
    </Link>
  );
}

function HouseholdModuleEmpty({ text }: { text: string }) {
  return (
    <p className="rounded-[1rem] bg-finance-primary-soft/30 px-3 py-3 text-sm text-finance-muted">
      {text}
    </p>
  );
}
