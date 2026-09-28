import Link from "next/link";

import { AppIcon, type AppIconName } from "@/components/ui/AppIcon";
import { cn } from "@/lib/utils/cn";

export type PlanView =
  | "calendar"
  | "tasks"
  | "reminders"
  | "notes"
  | "chores"
  | "shopping"
  | "inventory";

const views: Array<{ value: PlanView; label: string }> = [
  { value: "calendar", label: "ปฏิทิน" },
  { value: "tasks", label: "งาน" },
  { value: "reminders", label: "เตือน" },
  { value: "notes", label: "โน้ต" },
];

const householdViews: Array<{
  value: Extract<PlanView, "chores" | "shopping" | "inventory">;
  href: string;
  label: string;
  countKey: "chores" | "shopping" | "inventory";
  icon: AppIconName;
}> = [
  {
    value: "chores",
    href: "/calendar?view=chores",
    label: "งานบ้าน",
    countKey: "chores",
    icon: "chores",
  },
  {
    value: "shopping",
    href: "/calendar?view=shopping",
    label: "ซื้อของ",
    countKey: "shopping",
    icon: "shopping",
  },
  {
    value: "inventory",
    href: "/calendar?view=inventory",
    label: "คลังของ",
    countKey: "inventory",
    icon: "inventory",
  },
];

export function PlanTabs({
  active,
  householdCounts,
}: {
  active: PlanView;
  householdCounts: {
    chores: number;
    shopping: number;
    inventory: number;
  };
}) {
  return (
    <header
      aria-label="ศูนย์แผนงาน"
      className="rounded-[1.5rem] bg-finance-surface-strong p-3 shadow-card sm:p-4"
    >
      <div className="mb-3 flex items-center gap-2 px-1">
        <span className="flex size-9 items-center justify-center rounded-full bg-finance-primary-soft text-finance-primary-strong">
          <AppIcon name="calendar" className="size-5" />
        </span>
        <div>
          <p className="text-xs text-finance-muted">เลือกสิ่งที่ต้องจัดการ</p>
          <h2 className="font-semibold text-finance-text">ศูนย์แผนงาน</h2>
        </div>
      </div>

      <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <section className="min-w-0 rounded-[1.15rem] bg-finance-primary-soft/25 p-2">
          <p className="mb-1.5 px-2 text-xs font-medium text-finance-muted">
            วางแผน
          </p>
          <nav aria-label="มุมมองแผนงาน" className="grid grid-cols-4 gap-1">
            {views.map((view) => (
              <Link
                key={view.value}
                href={
                  view.value === "calendar"
                    ? "/calendar"
                    : `/calendar?view=${view.value}`
                }
                aria-current={active === view.value ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center justify-center rounded-[0.9rem] px-1.5 text-xs font-medium transition-colors sm:px-3 sm:text-sm",
                  active === view.value
                    ? "bg-finance-surface-strong text-finance-primary-strong shadow-sm"
                    : "text-finance-muted hover:bg-finance-surface-strong/60",
                )}
              >
                {view.label}
              </Link>
            ))}
          </nav>
        </section>

        <section className="min-w-0 rounded-[1.15rem] bg-finance-primary-soft/45 p-2">
          <p className="mb-1.5 px-2 text-xs font-medium text-finance-muted">
            ดูแลบ้าน
          </p>
          <nav aria-label="ดูแลบ้าน" className="grid grid-cols-3 gap-1">
            {householdViews.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active === item.value ? "page" : undefined}
                className={cn(
                  "flex min-h-16 min-w-0 flex-col items-center justify-center gap-1 rounded-[0.9rem] px-1 text-center transition-colors",
                  active === item.value
                    ? "bg-finance-surface-strong text-finance-primary-strong shadow-sm"
                    : "text-finance-text hover:bg-finance-surface-strong/75",
                )}
              >
                <span className="relative flex size-7 items-center justify-center text-finance-primary-strong">
                  <AppIcon name={item.icon} className="size-5" />
                  {householdCounts[item.countKey] > 0 ? (
                    <span className="absolute -right-2 -top-1 flex min-w-4 items-center justify-center rounded-full bg-finance-primary px-1 text-[9px] font-semibold leading-4 text-finance-primary-foreground">
                      {householdCounts[item.countKey] > 99
                        ? "99+"
                        : householdCounts[item.countKey]}
                    </span>
                  ) : null}
                </span>
                <span className="truncate text-xs font-medium">
                  {item.label}
                </span>
              </Link>
            ))}
          </nav>
        </section>
      </div>
    </header>
  );
}
