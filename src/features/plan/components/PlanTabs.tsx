import Link from "next/link";

import { cn } from "@/lib/utils/cn";

export type PlanView =
  "calendar" | "tasks" | "reminders" | "chores" | "shopping" | "inventory";

const views: Array<{ value: PlanView; label: string }> = [
  { value: "calendar", label: "ปฏิทิน" },
  { value: "tasks", label: "งาน" },
  { value: "reminders", label: "เตือน" },
];

const householdViews: Array<{
  value: Extract<PlanView, "chores" | "shopping" | "inventory">;
  href: string;
  label: string;
}> = [
  {
    value: "chores",
    href: "/calendar?view=chores",
    label: "งานบ้าน",
  },
  {
    value: "shopping",
    href: "/calendar?view=shopping",
    label: "ซื้อของ",
  },
  {
    value: "inventory",
    href: "/calendar?view=inventory",
    label: "คลังของ",
  },
];

export function PlanTabs({ active }: { active: PlanView }) {
  return (
    <header
      aria-label="ศูนย์แผนงาน"
      className="rounded-[1.5rem] bg-finance-surface-strong p-3 shadow-card sm:p-4"
    >
      <h2 className="mb-2 px-1 text-sm font-semibold text-finance-text">
        ศูนย์แผนงาน
      </h2>

      <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <section className="min-w-0 rounded-[1.15rem] bg-finance-primary-soft/25 p-2">
          <p className="mb-1.5 px-2 text-xs font-medium text-finance-muted">
            วางแผน
          </p>
          <nav aria-label="มุมมองแผนงาน" className="grid grid-cols-3 gap-1">
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
                  "flex min-h-11 min-w-0 items-center justify-center rounded-[0.9rem] px-2 text-center text-sm font-medium transition-colors",
                  active === item.value
                    ? "bg-finance-surface-strong text-finance-primary-strong shadow-sm"
                    : "text-finance-text hover:bg-finance-surface-strong/75",
                )}
              >
                <span className="truncate">{item.label}</span>
              </Link>
            ))}
          </nav>
        </section>
      </div>
    </header>
  );
}
