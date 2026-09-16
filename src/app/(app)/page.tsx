import Link from "next/link";
import { redirect } from "next/navigation";

import { TopLevelCover } from "@/components/shared/TopLevelCover";
import { AppIcon, type AppIconName } from "@/components/ui/AppIcon";
import { getMyPrimaryHousehold } from "@/features/household/api";
import { getCurrentProfile } from "@/features/profile/api";
import { listMyWallets } from "@/features/wallets/api";
import { requireUser } from "@/lib/auth/require-user";
import { getDayCover } from "@/lib/presentation/day-cover";

const HOME_LINKS = [
  {
    href: "/finance",
    label: "การเงิน",
    description: "ยอดเงินและรายการล่าสุด",
    icon: "finance",
    className: "bg-[#f4eadc] text-[#5a493e]",
  },
  {
    href: "/calendar",
    label: "แผนงาน",
    description: "กิจกรรมและกำหนดชำระ",
    icon: "calendar",
    className: "bg-[#e6eef0] text-[#405560]",
  },
  {
    href: "/pets",
    label: "สัตว์เลี้ยง",
    description: "สมาชิกตัวน้อยของบ้าน",
    icon: "pets",
    className: "bg-[#f5e6df] text-[#684a43]",
  },
  {
    href: "/household",
    label: "ครอบครัว",
    description: "สมาชิกและการตั้งค่า",
    icon: "household",
    className: "bg-[#e4eee0] text-[#47604d]",
  },
] as const satisfies ReadonlyArray<{
  href: string;
  label: string;
  description: string;
  icon: AppIconName;
  className: string;
}>;

export default async function HomePage() {
  const { supabase, user } = await requireUser();

  const [wallets, household, profile] = await Promise.all([
    listMyWallets(supabase),
    getMyPrimaryHousehold(supabase, user.id),
    getCurrentProfile(supabase, user.id),
  ]);

  if (wallets.length === 0 && !household) {
    redirect("/onboarding");
  }

  const displayName = profile?.display_name?.trim().split(/\s+/)[0] || "นาย";
  const cover = getDayCover(new Date(), profile?.birthday, displayName);
  const todayLabel = new Intl.DateTimeFormat("th-TH", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Bangkok",
  }).format(new Date());

  return (
    <div className="flex flex-col gap-5">
      <TopLevelCover
        eyebrow="วันนี้"
        title={cover.title}
        description={cover.description}
        icon="home"
        tone={cover.tone}
      >
        <p className="text-xs font-medium opacity-70">{todayLabel}</p>
      </TopLevelCover>

      <section aria-labelledby="home-overview-heading">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-foreground-muted">ภาพรวม</p>
            <h2 id="home-overview-heading" className="text-lg font-semibold">
              บ้านของเรา
            </h2>
          </div>
          <p className="text-xs text-foreground-muted">
            {household ? household.name : "พื้นที่ส่วนตัว"}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {HOME_LINKS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`group min-h-32 rounded-[1.5rem] p-4 shadow-card transition-transform active:scale-[0.98] ${item.className}`}
            >
              <AppIcon name={item.icon} className="size-7" />
              <h3 className="mt-4 font-semibold">{item.label}</h3>
              <p className="mt-1 text-xs leading-4 opacity-70">
                {item.description}
              </p>
            </Link>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3" aria-label="สถานะบ้าน">
        <div className="rounded-[1.25rem] border border-border bg-surface p-4">
          <p className="text-xs text-foreground-muted">กระเป๋าเงิน</p>
          <p className="mt-1 text-xl font-semibold tabular-nums">
            {wallets.length}
          </p>
        </div>
        <div className="rounded-[1.25rem] border border-border bg-surface p-4">
          <p className="text-xs text-foreground-muted">พื้นที่ครอบครัว</p>
          <p className="mt-1 text-sm font-semibold">
            {household ? "เชื่อมต่อแล้ว" : "ยังไม่ได้สร้าง"}
          </p>
        </div>
      </section>
    </div>
  );
}
